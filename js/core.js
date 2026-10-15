/* ===== CORE: sha256 + accounts + economy (must load before the game) ===== */
function sha256(str){
  str=unescape(encodeURIComponent(str));
  const rr=(v,a)=>(v>>>a)|(v<<(32-a)), mw=4294967296, words=[], bits=str.length*8;
  let hash=[], k=[], pc=0; const comp={};
  for(let c=2;pc<64;c++){ if(!comp[c]){ for(let i=0;i<313;i+=c) comp[i]=c; if(pc<8) hash[pc]=(Math.pow(c,.5)*mw)|0; k[pc++]=(Math.pow(c,1/3)*mw)|0; } }
  str+='\x80'; while(str.length%64-56) str+='\x00';
  for(let i=0;i<str.length;i++) words[i>>2]|=str.charCodeAt(i)<<((3-i)%4)*8;
  words[words.length]=(bits/mw)|0; words[words.length]=bits;
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16), old=hash; hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15], w2=w[i-2], a=hash[0], e=hash[4];
      const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^(~e&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10))|0));
      const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash); hash[4]=(hash[4]+t1)|0;
    }
    for(let i=0;i<8;i++) hash[i]=(hash[i]+old[i])|0;
  }
  let out=''; for(let i=0;i<8;i++) for(let j=3;j+1;j--){ const b=(hash[i]>>(j*8))&255; out+=(b<16?'0':'')+b.toString(16); }
  return out;
}
const ADM={cd:false,one:false,jump:false,god:false,mult:0};
const BIGSTAT=999999999999999;
/* Secure owner mode: when config.js sets DZ_OWNER_ONLINE_ONLY=true the owner is only accepted if the server confirms the session. */
window.__dzOwnerCheck=function(){ try{ const t=localStorage.getItem('dz_tok'); if(!t) return false; const x=new XMLHttpRequest(); x.open('POST',(window.DZ_API||'')+'/api/me',false); x.setRequestHeader('Content-Type','application/json'); x.send(JSON.stringify({token:t})); const j=JSON.parse(x.responseText||'{}'); return x.status===200&&j.owner===true; }catch(e){ return false; } };
const AUTH=(function(){
  const OWNER={name:'Abdicrez',salt:'dojozero-owner',hash:'21539f532a6b191d3d29775f2d0d9da10cdf18fdc857db66d7c6609dd7c43ff3'};
  const KA='dz_accounts', KS='dz_session', KM='dz_mods';
  let user=null;
  const rd=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
  const wr=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
  const hp=(n,salt,pw)=>sha256(salt+':'+n.toLowerCase()+':'+pw);
  const accts=()=>rd(KA)||{};
  const mods=()=>{ const m=rd(KM); return Array.isArray(m)?m:[]; };
  const isOwner=()=>!!user&&user.owner===true;
  const isMod=()=>!!user&&!user.owner&&mods().includes(user.name.toLowerCase());
  const privileged=()=>isOwner()||isMod();
  const NAME_RE=/^[A-Za-z0-9_]{3,16}$/;
  const ownerOK=()=>!window.DZ_OWNER_ONLINE_ONLY||window.__dzOwnerCheck();
  function login(name,pw){
    name=(name||'').trim(); if(!name||!pw) return 'Enter your username and password.';
    const ln=name.toLowerCase();
    if(ln===OWNER.name.toLowerCase()){
      if(window.DZ_OWNER_ONLINE_ONLY){ if(!ownerOK()) return 'Owner login needs the online server.'; }
      else if(hp(OWNER.name,OWNER.salt,pw)!==OWNER.hash) return 'Wrong username or password.';
      user={name:OWNER.name,owner:true}; wr(KS,{name:OWNER.name,tok:window.DZ_OWNER_ONLINE_ONLY?'server':OWNER.hash}); return null;
    }
    const a=accts()[ln];
    if(!a||hp(a.name,a.salt,pw)!==a.hash) return 'Wrong username or password.';
    user={name:a.name,owner:false}; wr(KS,{name:a.name,tok:a.hash}); return null;
  }
  function signup(name,pw,pw2){
    name=(name||'').trim();
    if(!NAME_RE.test(name)) return 'Username: 3-16 letters, numbers or _.';
    if(name.toLowerCase()===OWNER.name.toLowerCase()) return 'That username is reserved.';
    if((pw||'').length<6) return 'Password must be at least 6 characters.';
    if(pw!==pw2) return 'Passwords do not match.';
    const all=accts(), ln=name.toLowerCase();
    if(all[ln]) return 'That username is already taken.';
    const salt=Math.random().toString(36).slice(2)+Date.now().toString(36);
    all[ln]={name:name,salt:salt,hash:hp(name,salt,pw)}; wr(KA,all);
    return login(name,pw);
  }
  function restore(){
    const s=rd(KS); if(!s) return false;
    if(s.name&&s.name.toLowerCase()===OWNER.name.toLowerCase()&&(window.DZ_OWNER_ONLINE_ONLY?ownerOK():s.tok===OWNER.hash)){ user={name:OWNER.name,owner:true}; return true; }
    const a=s.name&&accts()[s.name.toLowerCase()];
    if(a&&a.hash===s.tok){ user={name:a.name,owner:false}; return true; }
    return false;
  }
  function logout(){ user=null; try{ localStorage.removeItem(KS); }catch(e){} ADM.cd=ADM.one=ADM.jump=ADM.god=false; ADM.mult=0; }
  /* mod management (owner only) */
  function giveMod(name){
    if(!isOwner()) return {ok:false,msg:'Only the owner can give mod.'};
    name=(name||'').trim();
    if(!NAME_RE.test(name)) return {ok:false,msg:'Enter a valid username (3-16 letters, numbers or _).'};
    const ln=name.toLowerCase();
    if(ln===OWNER.name.toLowerCase()) return {ok:false,msg:'The owner already has every power.'};
    const m=mods(); if(m.includes(ln)) return {ok:false,msg:name+' is already a mod.'};
    m.push(ln); wr(KM,m);
    const exists=!!accts()[ln];
    return {ok:true,msg:name+' is now a mod.'+(exists?'':' (No account with that name on this device yet. It applies as soon as they sign up.)')};
  }
  function removeMod(name){
    if(!isOwner()) return {ok:false,msg:'Only the owner can remove mod.'};
    const ln=(name||'').trim().toLowerCase(); const m=mods(); const i=m.indexOf(ln);
    if(i<0) return {ok:false,msg:'That user is not a mod.'};
    m.splice(i,1); wr(KM,m); return {ok:true,msg:name+' is no longer a mod.'};
  }
  return {login,signup,restore,logout,isOwner,isMod,privileged,giveMod,removeMod,mods,get user(){ return user; }};
})();

/* ===== ECONOMY: coins, shop, hourly missions (per account, stored on this device) ===== */
const ECON=(function(){
  const KP='dz_prof', PX=window.DZ_ECON||{priceOf:()=>500}, PRICE=500, HOUR=3600000;
  const rd=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
  const wr=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
  const key=()=>AUTH.user?AUTH.user.name.toLowerCase():null;
  const E={PRICE,priceOf:i=>PX.priceOf(i),onChange:null,onReward:null};
  function prof(){ const k=key(); if(!k) return null; const all=rd(KP)||{}; let q=all[k]; if(!q){ q={coins:0,owned:[0]}; all[k]=q; wr(KP,all); } if(!Array.isArray(q.owned)) q.owned=[0]; if(!q.owned.includes(0)) q.owned.push(0); return q; }
  function save(q){ const k=key(); if(!k||!q) return; const all=rd(KP)||{}; all[k]=q; wr(KP,all); if(E.onChange) E.onChange(); }
  E.unlimited=()=>AUTH.privileged();
  E.big=()=>AUTH.isOwner();
  E.coins=()=>{ const q=prof(); return q?q.coins:0; };
  E.coinText=()=>E.unlimited()?'∞':(E.coins().toLocaleString('en-US'));
  /* normal fighters are indexes 0-18; index 0 is free. Admin fighters (19+) are handled by the admin menu. */
  E.owns=i=>{ const q=prof(); return !!q&&(i===0||q.owned.includes(i)); };
  E.buy=i=>{
    const q=prof(); if(!q) return 'Log in first.';
    if(i<=0||(i>18&&i<30)||i>34) return 'This fighter is not for sale.';
    if(q.owned.includes(i)) return 'You already own this fighter.';
    const pr=E.priceOf(i); if(!E.unlimited()){ if(q.coins<pr) return 'Not enough coins. You need '+pr.toLocaleString('en-US')+'.'; q.coins-=pr; }
    q.owned.push(i); save(q); return null;
  };
  /* ---- missions: 3 per hour (easy / medium / hard), same set for everyone, reset on the hour ---- */
  const POOL={
    easy:[{t:'kills',g:25,r:60,x:'Defeat 25 enemies'},{t:'skills',g:20,r:60,x:'Use 20 skills'},{t:'jumps',g:60,r:60,x:'Jump 60 times'},{t:'dashes',g:25,r:60,x:'Dash 25 times'},{t:'damage',g:900,r:60,x:'Deal 900 damage'},{t:'ults',g:1,r:75,x:'Use your ultimate once'},{t:'kills',g:15,r:50,x:'Defeat 15 enemies'},{t:'skills',g:12,r:50,x:'Use 12 skills'},{t:'jumps',g:30,r:50,x:'Jump 30 times'},{t:'dashes',g:15,r:50,x:'Dash 15 times'},{t:'damage',g:400,r:50,x:'Deal 400 damage'}],
    med:[{t:'kills',g:70,r:120,x:'Defeat 70 enemies'},{t:'wave',g:7,r:130,x:'Reach wave 7 in Waves'},{t:'combo',g:12,r:125,x:'Land a 12-hit combo'},{t:'ults',g:5,r:140,x:'Use your ultimate 5 times'},{t:'damage',g:4000,r:130,x:'Deal 4,000 damage'},{t:'blitz',g:20,r:140,x:'Score 20 kills in Blitz'},{t:'kills',g:40,r:100,x:'Defeat 40 enemies'},{t:'wave',g:5,r:100,x:'Reach wave 5 in Waves'},{t:'combo',g:8,r:100,x:'Land an 8-hit combo'},{t:'ults',g:3,r:125,x:'Use your ultimate 3 times'},{t:'story',g:2,r:125,x:'Clear 2 Story levels'},{t:'damage',g:2500,r:100,x:'Deal 2,500 damage'}],
    hard:[{t:'kills',g:180,r:200,x:'Defeat 180 enemies'},{t:'wave',g:12,r:220,x:'Reach wave 12 in Waves'},{t:'combo',g:30,r:200,x:'Land a 30-hit combo'},{t:'bosses',g:3,r:250,x:'Defeat 3 bosses'},{t:'tourn',g:5,r:220,x:'Win 5 Tournament rounds'},{t:'damage',g:15000,r:210,x:'Deal 15,000 damage'},{t:'kills',g:100,r:150,x:'Defeat 100 enemies'},{t:'wave',g:9,r:175,x:'Reach wave 9 in Waves'},{t:'combo',g:20,r:150,x:'Land a 20-hit combo'},{t:'tourn',g:3,r:175,x:'Win 3 Tournament rounds'},{t:'bosses',g:2,r:200,x:'Defeat 2 bosses in Boss Rush'},{t:'blitz',g:1200,r:175,x:'Score 1,200 in Blitz'},{t:'daily',g:1,r:200,x:'Clear a Daily Rift'}]
  };
  const MAXT={wave:1,combo:1,blitz:1};
  const hourKey=()=>Math.floor(Date.now()/HOUR);
  function rng(seed){ let s=(seed>>>0)||1; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
  function gen(hk){
    const r=rng(hk*2654435761); r(); r();
    const used=new Set(), list=[];
    for(const tier of ['easy','med','hard']){
      const opts=POOL[tier].filter(m=>!used.has(m.t)); const m=opts[Math.floor(r()*opts.length)]; used.add(m.t);
      list.push({tier:tier,t:m.t,g:m.g,r:m.r,x:m.x,p:0,done:false});
    }
    return {h:hk,list:list};
  }
  E.give=n=>{ const q=prof(); if(q){ q.coins=Math.max(0,q.coins+n); save(q); } };
  E.unlockAll=()=>{ const q=prof(); if(q){ for(const i of [...Array(19).keys(),30,31,32,33,34]) if(!q.owned.includes(i)) q.owned.push(i); save(q); } };
  E.finishMissions=()=>{ const q=prof(); if(!q) return; E.missions(); for(const m of q.m.list){ if(!m.done){ m.p=m.g; m.done=true; if(!E.unlimited()) q.coins+=m.r; if(E.onReward) E.onReward(m); } } save(q); };
  E.newMissions=()=>{ const q=prof(); if(q){ q.m=gen(hourKey()+Math.floor(Math.random()*1e6)); save(q); } };
  E.dump=()=>prof(); E.load=o=>{ const k=key(); if(!k||!o) return; const all=rd(KP)||{}; all[k]=o; wr(KP,all); };
  E.missions=()=>{
    const q=prof(); if(!q) return {list:[],left:0};
    const hk=hourKey(); if(!q.m||q.m.h!==hk){ q.m=gen(hk); save(q); }
    return {list:q.m.list,left:(hk+1)*HOUR-Date.now()};
  };
  E.ev=(t,n)=>{
    const q=prof(); if(!q) return;
    const hk=hourKey(); if(!q.m||q.m.h!==hk) q.m=gen(hk);
    let ch=false;
    for(const m of q.m.list){
      if(m.done||m.t!==t) continue;
      const np=MAXT[t]?Math.max(m.p,n):m.p+n; if(np===m.p) continue;
      m.p=Math.min(np,m.g); ch=true;
      if(m.p>=m.g){ m.done=true; if(!E.unlimited()) q.coins+=m.r; if(E.onReward) E.onReward(m); }
    }
    if(ch) save(q);
  };
  return E;
})();
