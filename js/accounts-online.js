/* ===== v4: ONLINE ACCOUNTS (needs server.js; falls back to this-device accounts) + ADMIN CONSOLE ===== */
(function(){
  const API=(window.DZ_API||'')+'/api/'; let online=false, tok=localStorage.getItem('dz_tok')||'';
  function call(p,b){ try{ const x=new XMLHttpRequest(); x.open('POST',API+p,false); x.setRequestHeader('Content-Type','application/json'); x.send(JSON.stringify(Object.assign({token:tok},b||{}))); return {s:x.status,j:JSON.parse(x.responseText||'{}')}; }catch(e){ return null; } }
  const ping=call('ping'); online=!!(ping&&ping.s===200&&ping.j.ok); if(online){ try{ localStorage.setItem('dz_wasOnline','1'); }catch(e){} }
  const oLogin=AUTH.login, oSign=AUTH.signup, oGive=AUTH.giveMod, oRem=AUTH.removeMod, oOutRaw=AUTH.logout;
  const rd=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
  const wr=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function mirror(name,pw){ const ln=name.toLowerCase(); if(ln==='abdicrez') return; const a=rd('dz_accounts')||{}; if(!a[ln]){ const e=oSign(name,pw,pw); if(e&&e.indexOf('taken')<0) return e; AUTH.logout(); } }
  function after(r,name,pw){
    tok=r.j.token; localStorage.setItem('dz_tok',tok);
    const e=mirror(r.j.name||name,pw); if(e) return e;
    if(Array.isArray(r.j.mods)) wr('dz_mods',r.j.mods);
    const err=oLogin(r.j.name||name,pw); if(err) return err;
    if(r.j.prof) ECON.load(r.j.prof);
    const ch=mergeProg(r.j.prog); push(); if(ch) setTimeout(()=>location.reload(),150);
    return null;
  }
  const PK=['dojoBest','dojoBlitz','dojoDaily','dojoBossRec','dojoStyle','dojoStory','dojoSet'];
  const snap=()=>{ const o={}; PK.forEach(k=>{ const v=rd(k); if(v!==null) o[k]=v; }); return o; };
  const mx=(a,b)=>{ if(typeof a==='number'&&typeof b==='number') return Math.max(a,b); if(a&&b&&typeof a==='object'&&typeof b==='object'){ const o=Array.isArray(a)?[]:{}; for(const k of new Set([...Object.keys(a),...Object.keys(b)])) o[k]=k in a&&k in b?mx(a[k],b[k]):(k in a?a[k]:b[k]); return o; } return b!==undefined?b:a; };
  function mergeProg(sv){ if(!sv) return false; let ch=false; for(const k of PK){ if(!(k in sv)) continue; const l=rd(k), m=(k==='dojoSet'||l===null)?sv[k]:mx(l,sv[k]); if(JSON.stringify(m)!==JSON.stringify(l)){ wr(k,m); ch=true; } } return ch; }
  let t=0, last=''; function push(now){ clearTimeout(t); const go=()=>{ const d=ECON.dump(); if(!(online&&tok&&d)) return; const g=snap(); last=JSON.stringify(g)+JSON.stringify(d); const r=call('save',{prof:d,prog:g}); if(r&&r.j&&r.j.corrected&&r.j.prof){ ECON.load(r.j.prof); last=''; } }; if(now) go(); else t=setTimeout(go,800); }
  if(online){ setInterval(()=>{ if(AUTH.user&&JSON.stringify(snap())+JSON.stringify(ECON.dump())!==last) push(); },10000);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden&&AUTH.user) push(true); }); addEventListener('pagehide',()=>{ try{ const d=ECON.dump(); if(AUTH.user&&tok&&d) navigator.sendBeacon(API+'save',new Blob([JSON.stringify({token:tok,prof:d,prog:snap()})],{type:'application/json'})); }catch(e){} });
    const oOut=AUTH.logout; AUTH.logout=()=>{ if(AUTH.user){ push(true); call('logout'); } oOut(); PK.forEach(k=>localStorage.removeItem(k)); localStorage.removeItem('dz_tok'); tok=''; setTimeout(()=>location.reload(),100); }; }
  if(online){
    AUTH.login=(n,pw)=>{ n=(n||'').trim(); if(!n||!pw) return 'Enter your username and password.'; const r=call('login',{name:n,pw}); if(!r) return oLogin(n,pw); if(r.s===401&&n.toLowerCase()!=='abdicrez'&&(rd('dz_accounts')||{})[n.toLowerCase()]){ /* account made on this device earlier: register it online now */ const le=oLogin(n,pw); if(le) return r.j.err||'Login failed.'; const s=call('signup',{name:n,pw}); if(s&&s.s===200) return after(s,n,pw); oOutRaw(); return 'This device account could not be registered online ('+((s&&s.j&&s.j.err)||'server unreachable')+') Try again or use another username.'; }
    if(r.s!==200) return r.j.err||'Login failed.'; return after(r,n,pw); };
    AUTH.signup=(n,pw,pw2)=>{ n=(n||'').trim(); if(pw!==pw2) return 'Passwords do not match.'; const r=call('signup',{name:n,pw}); if(!r) return oSign(n,pw,pw2); if(r.s!==200) return r.j.err||'Sign up failed.'; return after(r,n,pw); };
    AUTH.giveMod=n=>{ const r=oGive(n); if(r.ok) call('mod',{target:n,on:1}); return r; };
    AUTH.removeMod=n=>{ const r=oRem(n); if(r.ok) call('mod',{target:n,on:0}); return r; };
    const oc=ECON.onChange; ECON.onChange=()=>{ if(oc) oc(); push(); };
  }
  if(!online&&(window.DZ_API||localStorage.getItem('dz_wasOnline'))){ AUTH.signup=()=>'Cannot reach the server, so a new account would not be saved permanently. Check your connection and try again.'; }
  const note=document.createElement('div'); note.id='netTag'; note.textContent=online?'● ONLINE':'○ OFFLINE (this device)'; note.className=online?'on':''; document.body.appendChild(note);
  /* ---- leaderboard ---- */
  const lb=document.createElement('div'); lb.id='lbScreen'; document.body.appendChild(lb);
  const CATS=[['coins','🪙 Coins'],['stars','⭐ Story stars'],['wave','🌊 Best wave'],['blitz','⚡ Blitz'],['daily','🌀 Daily Rift'],['fighters','🥋 Fighters']];
  function lbShow(by){
    by=by||'coins';
    lb.innerHTML='<div class="lb-box"><h2>🏆 LEADERBOARD</h2><div class="lb-tabs">'+CATS.map(c=>'<button data-by="'+c[0]+'" class="'+(c[0]===by?'on':'')+'">'+c[1]+'</button>').join('')+'</div><div id="lbList" class="lb-list">'+(online?'Loading...':'The leaderboard needs the online server (run node server.js). Offline accounts only exist on this device.')+'</div><button class="tbtn" id="lbX" type="button">Close</button></div>';
    lb.classList.add('on'); if(!online) return;
    if(AUTH.user) push(true);
    const r=call('top',{by}); const L=document.getElementById('lbList'); const me=AUTH.user?AUTH.user.name.toLowerCase():'';
    L.innerHTML=r&&r.j.top&&r.j.top.length?r.j.top.map((u,i)=>'<div class="lb-row'+(u.name.toLowerCase()===me?' me':'')+'"><b>'+(['🥇','🥈','🥉'][i]||(i+1))+'</b><span>'+u.name.replace(/[<>&]/g,'')+'</span><em>'+u.v.toLocaleString('en-US')+'</em></div>').join(''):'No scores yet. Be the first!';
  }
  lb.addEventListener('click',e=>{ if(e.target.id==='lbX'||e.target===lb) lb.classList.remove('on'); const b=e.target.closest('button[data-by]'); if(b) lbShow(b.dataset.by); });
  lb.addEventListener('keydown',e=>e.stopPropagation());
  const row=document.querySelector('.ttl-row'); if(row){ const b=document.createElement('button'); b.className='tbtn'; b.type='button'; b.textContent='🏆 Leaderboard'; b.onclick=()=>lbShow(); row.insertBefore(b,document.getElementById('btnLogout')); }
  /* ---- admin console ---- */
  const box=document.getElementById('admBox'); if(!box) return;
  const ex=document.createElement('div'); ex.className='mod-sec';
  ex.innerHTML='<small>COMMANDS</small><div class="cg"><button data-c="god">God mode</button><button data-c="x10">Dmg x10</button><button data-c="heal">Heal</button><button data-c="ult">Full ult</button><button data-c="freeze">Freeze foes</button><button data-c="kill">Kill all</button><button data-c="coins">+10k coins</button><button data-c="unlock">Unlock all</button><button data-c="done">Finish missions</button><button data-c="new">New missions</button></div><input id="cmdIn" placeholder="/help  (type a command)" autocomplete="off" autocapitalize="none"><div id="cmdOut"></div>';
  const cl=box.querySelector('button[data-k=close]'); if(cl) box.insertBefore(ex,cl); else box.appendChild(ex);
  const out=m=>{ document.getElementById('cmdOut').textContent=m; }, A=()=>window.__dzAdmin;
  function run(line){
    const a=line.trim().replace(/^\//,'').split(/\s+/), c=(a[0]||'').toLowerCase(), v=a[1];
    switch(c){
      case 'god': ADM.god=!ADM.god; return 'God mode '+(ADM.god?'ON':'OFF');
      case 'x10': ADM.mult=ADM.mult?0:10; return 'Damage x10 '+(ADM.mult?'ON':'OFF');
      case 'mult': ADM.mult=+v||0; return 'Damage multiplier: '+(ADM.mult||'off');
      case 'heal': A().heal(); return 'Healed.';
      case 'ult': A().ult(); return 'Ultimate charged.';
      case 'freeze': A().freeze(); return 'Enemies frozen.';
      case 'kill': A().clear(); return 'Cleared.';
      case 'coins': ECON.give(+v||10000); return 'Coins added.';
      case 'unlock': ECON.unlockAll(); return 'All fighters unlocked.';
      case 'done': ECON.finishMissions(); return 'Missions finished.';
      case 'new': ECON.newMissions(); return 'New missions rolled.';
      case 'fighter': A().fighter(+v||0); return 'Fighter set.';
      case 'tp': A().tp(+v||500); return 'Teleported.';
      case 'mod': { const r=AUTH.giveMod(v); return r.msg; }
      case 'unmod': { const r=AUTH.removeMod(v); return r.msg; }
      case 'mods': return 'Mods: '+(AUTH.mods().join(', ')||'none');
      default: return 'Commands: /god /x10 /mult N /heal /ult /freeze /kill /coins N /unlock /done /new /fighter N /tp X /mod NAME /unmod NAME /mods';
    }
  }
  box.addEventListener('click',e=>{ const b=e.target.closest('button[data-c]'); if(!b) return; const m={coins:'coins 10000'}[b.dataset.c]||b.dataset.c; try{ out(run(m)); }catch(x){ out('Not available here.'); } });
  document.getElementById('cmdIn').addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ try{ out(run(e.target.value)); }catch(x){ out('Not available here.'); } e.target.value=''; } });
})();
