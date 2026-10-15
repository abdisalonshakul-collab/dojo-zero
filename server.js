'use strict';
// Dojo Zero online server (no dependencies). Run: node server.js -> http://localhost:3000
// Env: PORT, DB_FILE, ALLOWED_ORIGIN (default *), TRUST_PROXY=1, OWNER_HASH (see make-owner-hash.js)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ECON = require('./economy.js');
const ROOT = __dirname;
const PORT = +process.env.PORT || 3000;
const DB = process.env.DB_FILE || path.join(ROOT, 'dojo-data.json');
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const TOKEN_TTL = 30 * 24 * 3600 * 1000, MAX_TOKENS = 5;
const OWNER = 'abdicrez';
const LEGACY_OWNER_SHA = '21539f532a6b191d3d29775f2d0d9da10cdf18fdc857db66d7c6609dd7c43ff3';

/* ---------- storage: in memory, debounced + atomic writes ---------- */
let db = { users: {}, mods: [], tokens: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB, 'utf8'))); } catch (e) {}
if (!db.tokens || typeof db.tokens !== 'object') db.tokens = {};
for (const k of Object.keys(db.tokens)) { const t = db.tokens[k]; if (!t || typeof t !== 'object' || !t.exp) delete db.tokens[k]; }   // keep hashed sessions across restarts, drop old plaintext ones
let dirty = false, timer = null, lastBak = 0;
// Live duel rooms are intentionally memory-only; account/progress data remains on disk.
const duelRooms = new Map(); let publicQueue = null;
function roomCode(){ let c; do { c=crypto.randomBytes(3).toString('hex').toUpperCase(); } while(duelRooms.has(c)); return c; }
function roomView(r, me){ return {ok:1, code:r.code, private:r.private, status:r.players.length===2?'matched':'waiting', players:r.players.map(x=>({name:x.name, fighter:x.fighter||0, ready:!!x.ready})), you:r.players.findIndex(x=>x.name===me), created:r.created}; }
function cleanupRooms(){ const now=Date.now(); for(const [c,r] of duelRooms) if(now-r.updated>30*60*1000) { duelRooms.delete(c); if(publicQueue===c) publicQueue=null; } }
setInterval(cleanupRooms,60000).unref();
function save() { dirty = true; if (!timer) timer = setTimeout(flush, 500); }
function flush() {
  timer = null; if (!dirty) return; dirty = false;
  const tmp = DB + '.tmp';
  try {
    if (Date.now() - lastBak > 6 * 3600000 && fs.existsSync(DB)) { fs.copyFileSync(DB, DB + '.bak'); lastBak = Date.now(); }   // rolling backup of all accounts
    fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB);
  } catch (e) { console.error('save failed:', e.message); dirty = true; }
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
process.on('exit', flush);

/* ---------- helpers ---------- */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const eq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const scr = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 32, (e, k) => e ? no(e) : ok(k.toString('hex'))));
const NAME_RE = /^[a-z0-9_]{3,16}$/;
const isPriv = ln => ln === OWNER || db.mods.includes(ln);
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Vary': 'Origin' };
const send = (r, c, o) => { r.writeHead(c, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS)); r.end(JSON.stringify(o)); };
const ipOf = req => (process.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

/* ---------- rate limiting (in memory) ---------- */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); let h = hits.get(key);
  if (!h || now > h.t) { h = { n: 0, t: now + windowMs }; hits.set(key, h); }
  return h.n >= max;
}
function hit(key, windowMs) { const now = Date.now(); let h = hits.get(key); if (!h || now > h.t) { h = { n: 0, t: now + windowMs }; hits.set(key, h); } h.n++; }
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.t) hits.delete(k); for (const k in db.tokens) if (db.tokens[k].exp < n) delete db.tokens[k]; }, 600000).unref();

/* ---------- sessions ---------- */
function newToken(ln) {
  const t = crypto.randomBytes(24).toString('hex'), now = Date.now();
  const mine = Object.keys(db.tokens).filter(k => db.tokens[k].u === ln).sort((a, b) => db.tokens[a].exp - db.tokens[b].exp);
  while (mine.length >= MAX_TOKENS) delete db.tokens[mine.shift()];
  db.tokens[sha(t)] = { u: ln, exp: now + TOKEN_TTL };
  return t;
}
function who(t) { const s = db.tokens[sha(String(t || ''))]; if (!s) return null; if (s.exp < Date.now()) { delete db.tokens[sha(t)]; return null; } return s.u; }

async function ownerPw(pw) {
  const env = process.env.OWNER_HASH;
  if (env) { const [salt, h] = env.split(':'); return !!salt && !!h && eq(await scr(pw, salt), h); }
  return eq(sha('dojozero-owner:' + OWNER + ':' + pw), LEGACY_OWNER_SHA);
}

/* ---------- validation of what the client uploads ---------- */
const num = (v, lo, hi) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : 0; };
function cleanProf(p, u, priv) {
  if (!p || typeof p !== 'object' || JSON.stringify(p).length > 20000) return null;
  let owned = [...new Set((Array.isArray(p.owned) ? p.owned : []).map(Number).filter(i => Number.isInteger(i) && (i === 0 || ECON.sellable(i) || (priv && ECON.isAdminId(i)))))];
  if (!owned.includes(0)) owned.unshift(0);
  const out = { coins: num(p.coins, 0, priv ? Number.MAX_SAFE_INTEGER : ECON.MAX_COINS), owned };
  if (p.m && typeof p.m === 'object' && Array.isArray(p.m.list) && p.m.list.length <= 3) out.m = p.m;
  let corrected = false;
  if (!priv) {                       // lifetime coins (balance + value of owned fighters) may only grow at a believable rate
    const now = Date.now(), spent = ECON.spent(owned), life = out.coins + spent;
    const allowed = u.life == null ? ECON.FIRST_SYNC_CAP : u.life + ECON.BURST + ECON.EARN_PER_SEC * Math.min(30 * 86400, Math.max(0, (now - (u.lifeAt || now)) / 1000));
    if (life > allowed) { out.coins = Math.max(0, Math.floor(allowed - spent)); corrected = true; }
    u.life = out.coins + spent; u.lifeAt = now;
  }
  return { prof: out, corrected };
}
const PROG_KEYS = ['dojoBest', 'dojoBlitz', 'dojoDaily', 'dojoBossRec', 'dojoStyle', 'dojoStory', 'dojoSet'];
function cleanProg(g, priv) {
  if (!g || typeof g !== 'object' || JSON.stringify(g).length > 60000) return null;
  const o = {};
  for (const k of PROG_KEYS) if (k in g) o[k] = g[k];
  if (priv) return o;
  if ('dojoBest' in o) o.dojoBest = num(o.dojoBest, 0, 500);
  if ('dojoBlitz' in o) o.dojoBlitz = num(o.dojoBlitz, 0, 1000);
  if (o.dojoDaily && typeof o.dojoDaily === 'object') { o.dojoDaily = Object.assign({}, o.dojoDaily); if ('best' in o.dojoDaily) o.dojoDaily.best = num(o.dojoDaily.best, 0, 200000); } else delete o.dojoDaily;
  if (o.dojoStory && typeof o.dojoStory === 'object') {
    const st = Object.assign({}, o.dojoStory), d = {};
    if (st.d && typeof st.d === 'object') for (const k of Object.keys(st.d).slice(0, 400)) d[k] = num(st.d[k], 0, 3);
    st.d = d; o.dojoStory = st;
  } else delete o.dojoStory;
  return o;
}

/* ---------- API ---------- */
async function api(p, b, res, req) {
  const ln = String(b.name || '').toLowerCase(), ip = ipOf(req);
  if (p === '/api/ping') return send(res, 200, { ok: 1 });
  if (p === '/api/signup' || p === '/api/login') {
    const k1 = 'f:' + ip + ':' + ln;
    if (limited(k1, 8, 15 * 60000) || limited('f:' + ip, 40, 15 * 60000)) return send(res, 429, { err: 'Too many attempts. Try again in a few minutes.' });
    const fail = (c, m) => { hit(k1, 15 * 60000); hit('f:' + ip, 15 * 60000); return send(res, c, { err: m }); };
    const pw = typeof b.pw === 'string' ? b.pw.slice(0, 200) : '';
    if (p === '/api/signup') {
      if (limited('s:' + ip, 5, 3600000)) return send(res, 429, { err: 'Too many new accounts from this network. Try later.' });
      if (!NAME_RE.test(ln)) return send(res, 400, { err: 'Username: 3-16 letters, numbers or _.' });
      if (ln === OWNER || db.users[ln]) return send(res, 400, { err: 'That username is already taken.' });
      if (pw.length < 6) return send(res, 400, { err: 'Password must be at least 6 characters.' });
      const salt = crypto.randomBytes(8).toString('hex');
      db.users[ln] = { name: String(b.name), salt, hash: await scr(pw, salt), prof: null }; hit('s:' + ip, 3600000); save();
    } else {
      let ok = false;
      if (ln === OWNER) ok = await ownerPw(pw);
      else { const u = db.users[ln]; ok = !!u && eq(await scr(pw, u.salt), u.hash); }
      if (!ok) return fail(401, 'Wrong username or password.');
    }
    const t = newToken(ln); save(); if (p === '/api/signup') flush();   // new accounts hit the disk immediately
    const u = db.users[ln] || {};
    return send(res, 200, { token: t, prof: u.prof || null, prog: u.prog || null, mods: db.mods, name: u.name || 'Abdicrez', owner: ln === OWNER, mod: db.mods.includes(ln) });
  }
  if (p === '/api/top') {
    const by = String(b.by || 'coins');
    const val = u => { const f = u.prof || {}, g = u.prog || {}, st = g.dojoStory && g.dojoStory.d ? g.dojoStory.d : {}, dl = g.dojoDaily || {};
      return by === 'coins' ? (f.coins | 0) : by === 'stars' ? Object.values(st).reduce((a, c) => a + (c | 0), 0) : by === 'wave' ? (+g.dojoBest | 0) : by === 'blitz' ? (+g.dojoBlitz | 0) : by === 'daily' ? (dl.best | 0) : by === 'fighters' ? (f.owned || []).length : 0; };
    const rows = Object.keys(db.users).filter(n => !isPriv(n)).map(n => ({ name: String(db.users[n].name).replace(/[<>&"']/g, ''), v: val(db.users[n]) })).filter(x => x.v > 0).sort((a, c) => c.v - a.v).slice(0, 25);
    return send(res, 200, { top: rows });
  }
  const me = who(b.token); if (!me) return send(res, 401, { err: 'Session expired. Log in again.' });
  // Public matchmaking and private room-code API. Clients poll status for cross-device compatibility.
  if (p === '/api/duel/create') {
    for (const [c,r] of duelRooms) if (r.players.some(x=>x.name===me)) { r.players=r.players.filter(x=>x.name!==me); if(!r.players.length) duelRooms.delete(c); }
    const code=roomCode(), r={code,private:true,players:[{name:me,fighter:num(b.fighter,0,999),ready:true}],created:Date.now(),updated:Date.now()}; duelRooms.set(code,r);
    return send(res,200,roomView(r,me));
  }
  if (p === '/api/duel/join') {
    const code=String(b.code||'').trim().toUpperCase(); const r=duelRooms.get(code);
    if(!r || (r.private && !b.code)) return send(res,404,{err:'Room code not found.'});
    if(r.players.some(x=>x.name===me)) return send(res,200,roomView(r,me));
    if(r.players.length>=2) return send(res,409,{err:'That room is full.'});
    r.players.push({name:me,fighter:num(b.fighter,0,999),ready:true}); r.updated=Date.now();
    return send(res,200,roomView(r,me));
  }
  if (p === '/api/duel/public') {
    cleanupRooms();
    for (const [c,r] of duelRooms) if(r.players.some(x=>x.name===me)){ r.players=r.players.filter(x=>x.name!==me); if(!r.players.length) duelRooms.delete(c); }
    let r=publicQueue && duelRooms.get(publicQueue);
    if(!r || r.players.length!==1 || r.players[0].name===me){ const code=roomCode(); r={code,private:false,players:[{name:me,fighter:num(b.fighter,0,999),ready:true}],created:Date.now(),updated:Date.now()}; duelRooms.set(code,r); publicQueue=code; }
    else { r.players.push({name:me,fighter:num(b.fighter,0,999),ready:true}); r.updated=Date.now(); publicQueue=null; }
    return send(res,200,roomView(r,me));
  }
  if (p === '/api/duel/state') {
    const code=String(b.code||'').toUpperCase(), r=duelRooms.get(code);
    if(!r || !r.players.some(x=>x.name===me)) return send(res,404,{err:'Room closed or you left.'});
    const idx=r.players.findIndex(x=>x.name===me), raw=b.state&&typeof b.state==='object'?b.state:{};
    if(!r.fight) r.fight={states:[null,null],hp:[200,200],lastHit:[0,0]};
    r.fight.states[idx]={x:num(raw.x,40,960),y:num(raw.y,80,440),face:num(raw.face,-1,1)||1,fighter:num(raw.fighter,0,999),name:me,stamp:Date.now()};
    r.updated=Date.now();
    return send(res,200,{ok:1,you:idx,youHp:r.fight.hp[idx],opponent:r.fight.states[1-idx]?Object.assign({},r.fight.states[1-idx],{hp:r.fight.hp[1-idx]}):null,status:r.players.length===2?'matched':'waiting'});
  }
  if (p === '/api/duel/hit') {
    const code=String(b.code||'').toUpperCase(), r=duelRooms.get(code);
    if(!r || !r.players.some(x=>x.name===me)) return send(res,404,{err:'Room closed or you left.'});
    const idx=r.players.findIndex(x=>x.name===me), f=r.fight;
    if(!f || r.players.length!==2 || !f.states[idx] || !f.states[1-idx]) return send(res,409,{err:'Opponent not ready.'});
    const now=Date.now(), a=f.states[idx], t=f.states[1-idx], kind=String(b.kind||'hit');
    const cd=kind==='ult'?1400:kind==='skill'?650:260, reach=kind==='hit'?112:kind==='ult'?270:170;
    if(now-f.lastHit[idx]<cd) return send(res,429,{err:'Move is cooling down.'});
    if(Math.abs(a.x-t.x)>reach || Math.abs(a.y-t.y)>115 || Math.sign(t.x-a.x)!==a.face) return send(res,200,{ok:1,hit:false,hp:f.hp[1-idx]});
    f.lastHit[idx]=now; f.hp[1-idx]=Math.max(0,f.hp[1-idx]-(kind==='hit'?12:kind==='ult'?38:22));
    return send(res,200,{ok:1,hit:true,hp:f.hp[1-idx],youHp:f.hp[idx]});
  }
  if (p === '/api/duel/status') {
    const code=String(b.code||'').toUpperCase(), r=duelRooms.get(code);
    if(!r || !r.players.some(x=>x.name===me)) return send(res,404,{err:'Room closed or you left.'});
    r.updated=Date.now(); return send(res,200,roomView(r,me));
  }
  if (p === '/api/duel/leave') {
    const code=String(b.code||'').toUpperCase(), r=duelRooms.get(code);
    if(r){ r.players=r.players.filter(x=>x.name!==me); r.updated=Date.now(); if(!r.players.length){duelRooms.delete(code);if(publicQueue===code)publicQueue=null;} }
    return send(res,200,{ok:1});
  }
  if (p === '/api/me') return send(res, 200, { name: (db.users[me] || {}).name || 'Abdicrez', owner: me === OWNER, mod: db.mods.includes(me) });
  if (p === '/api/logout') { delete db.tokens[sha(b.token)]; save(); return send(res, 200, { ok: 1 }); }
  if (p === '/api/save') {
    const u = db.users[me]; if (!u) return send(res, 200, { ok: 1 });
    if (limited('v:' + me, 120, 60000)) return send(res, 429, { err: 'Saving too fast.' }); hit('v:' + me, 60000);
    const priv = isPriv(me); let corrected = false;
    if (b.prof) { const c = cleanProf(b.prof, u, priv); if (c) { u.prof = c.prof; corrected = c.corrected; } }
    if (b.prog) { const g = cleanProg(b.prog, priv); if (g) u.prog = g; }
    save(); return send(res, 200, corrected ? { ok: 1, corrected: true, prof: u.prof } : { ok: 1 });
  }
  if (p === '/api/mods') return send(res, 200, { mods: db.mods });
  if (p === '/api/mod') {
    if (me !== OWNER) return send(res, 403, { err: 'Owner only.' });
    const t = String(b.target || '').toLowerCase(); if (!NAME_RE.test(t) || t === OWNER) return send(res, 400, { err: 'Bad username.' });
    db.mods = db.mods.filter(x => x !== t); if (b.on) db.mods.push(t); save(); return send(res, 200, { mods: db.mods });
  }
  send(res, 404, { err: 'Not found' });
}

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const HIDDEN = /(^|\/)(\.|dojo-data|server\.js$|make-owner-hash\.js$|package\.json$)/;
http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (u.startsWith('/api/')) {
    let d = '', big = false;
    req.on('data', c => { d += c; if (d.length > 2e5 && !big) { big = true; send(res, 413, { err: 'Too large.' }); req.destroy(); } });
    req.on('end', () => { if (big) return; let b = {}; try { b = JSON.parse(d || '{}'); } catch (e) {} if (!b || typeof b !== 'object') b = {}; api(u, b, res, req).catch(e => { console.error(e); if (!res.headersSent) send(res, 500, { err: 'Server error.' }); }); });
    return;
  }
  let rel; try { rel = decodeURIComponent(u === '/' ? '/index.html' : u); } catch (e) { res.writeHead(400); return res.end(); }
  const f = path.resolve(ROOT, '.' + rel);
  if ((f !== ROOT && !f.startsWith(ROOT + path.sep)) || HIDDEN.test(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(f);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': /\.(html|js|css)$/.test(ext) ? 'no-cache' : 'public, max-age=3600' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('Dojo Zero online at http://localhost:' + PORT));
