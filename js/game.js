(()=>{
'use strict';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const VH=450, GROUND=370, WW=1800;
const cv=$('#cv'), ctx=cv.getContext('2d');
const calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let scale=1, VW=800, dpr=1, camX=0, now=0, hitstop=0, shake=0, started=false, paused=false, ult=100, ultFx=0, banner=null, mode='train', over=false;
// Prefer touch controls on phones/tablets; keep keyboard hints and hide on-screen pads on desktop.
const coarsePointer=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const narrowTouch=!!(window.matchMedia&&matchMedia('(max-width: 900px)').matches)&&((navigator.maxTouchPoints||0)>0 || ('ontouchstart' in window));
const touch=coarsePointer && ((navigator.maxTouchPoints||0)>0 || ('ontouchstart' in window) || narrowTouch);
if(touch) document.body.classList.add('touch');

/* ---------- audio ---------- */
let AC=null, muted=false;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended'){ try{AC.resume();}catch(e){} } return AC; }
function tone(freq,dur,type,vol,slide){
  if(muted) return; const a=ac(); if(!a) return;
  const o=a.createOscillator(), g=a.createGain(), t=a.currentTime;
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);
  g.gain.setValueAtTime(vol||.06,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+dur);
}
function noise(dur,vol){
  if(muted) return; const a=ac(); if(!a) return;
  const n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource(), g=a.createGain(); s.buffer=buf; g.gain.value=vol||.05; s.connect(g); g.connect(a.destination); s.start();
}
const sfx={
  hit(big){ tone(big?110:190,.12,'square',.05,-70); noise(.06,.04); },
  swing(){ noise(.08,.03); },
  cast(){ tone(380,.18,'triangle',.05,300); },
  boom(){ tone(70,.5,'sawtooth',.08,-30); noise(.3,.08); },
  ult(){ tone(80,.9,'sawtooth',.07,320); },
  kill(){ tone(320,.3,'square',.05,-220); },
  jump(){ tone(260,.1,'sine',.04,200); },
  hurt(){ tone(150,.2,'sawtooth',.07,-90); noise(.08,.05); }
};

/* ---------- fighters (original designs) ---------- */
const col=()=>FIGHTERS[p.f].color;
const FIGHTERS=[
{ name:'Kaito', tag:'Blade', color:'#6FE7F0', dark:'#16324A', hair:'#EAFBFF',
  blurb:'Fast swordsman. Slash waves, a rising cut and a rush strike.',
  m1:[
    {dmg:7,range:78,delay:.04,dur:.2,cd:.24,kx:140,ky:-20,stun:.25,step:110},
    {dmg:8,range:78,delay:.04,dur:.2,cd:.24,kx:140,ky:-20,stun:.25,step:110},
    {dmg:9,range:84,delay:.04,dur:.22,cd:.28,kx:160,ky:-30,stun:.3,step:120},
    {dmg:16,range:96,delay:.08,dur:.3,cd:.5,kx:420,ky:-300,stun:.45,step:170}],
  skills:[
    {name:'Crescent Wave',cd:4,lock:.28,cast(){ const f=p.face; proj({x:p.x+f*30,y:p.y-40,vx:f*700,vy:0,r:20,dmg:22,life:.85,pierce:true,kx:f*260,ky:-140,stun:.35,color:col(),fx:'wave',face:f}); sfx.cast(); }},
    {name:'Rising Cut',cd:6,lock:.4,cast(){ const f=p.face; p.vy=-430; p.y-=2; p.jumps=1; hit({follow:true,ox:f*40,oy:-70,w:90,h:150,delay:.05,life:.2,dmg:30,kx:f*60,ky:-560,stun:.65,color:col(),fx:'rise',face:f}); sfx.cast(); }},
    {name:'Phantom Rush',cd:7,lock:.3,cast(){ const f=p.face; dashStart(f*1500,.18); hit({follow:true,ox:f*50,oy:-38,w:120,h:76,delay:0,life:.2,dmg:28,kx:f*340,ky:-200,stun:.45,color:col(),fx:'rush',face:f}); sfx.swing(); }},
    {name:'Ground Shatter',cd:9,lock:.5,cast(){ hit({x:p.x,y:p.y-10,r:175,delay:.28,life:.1,dmg:35,kx:480,ky:-380,stun:.55,radial:true,color:col(),fx:'ring'}); }}
  ],
  ult:{name:'Thousand Cuts',lock:1.6,freeze:1.5,cast(){ const f=p.face;
    for(let i=0;i<14;i++) hit({follow:true,ox:f*60,oy:-40,w:130,h:96,delay:.15+i*.07,life:.06,dmg:11,kx:f*40,ky:-40,stun:.3,color:col(),fx:'slash',face:f});
    hit({follow:true,ox:f*70,oy:-40,w:160,h:110,delay:1.25,life:.1,dmg:70,kx:f*700,ky:-380,stun:.7,color:'#fff',fx:'rise',face:f}); }}
},
{ name:'Mira', tag:'Gravity', color:'#B38BFF', dark:'#2B1B54', hair:'#1C1233',
  blurb:'Controls space. Pulls, repels, pins and opens a black hole.',
  m1:[
    {dmg:7,range:70,delay:.05,dur:.22,cd:.27,kx:100,ky:-10,stun:.25,step:90},
    {dmg:7,range:70,delay:.05,dur:.22,cd:.27,kx:100,ky:-10,stun:.25,step:90},
    {dmg:15,range:86,delay:.08,dur:.3,cd:.45,kx:520,ky:-140,stun:.45,step:130}],
  skills:[
    {name:'Draw In',cd:5,lock:.35,cast(){ const f=p.face; hit({x:p.x+f*160,y:p.y-42,w:320,h:110,delay:.08,life:.3,dmg:12,kx:0,ky:0,stun:.6,pull:3600,pullX:p.x+f*50,color:col(),fx:'pull',face:f}); sfx.cast(); }},
    {name:'Repel',cd:6,lock:.35,cast(){ hit({follow:true,ox:0,oy:-40,r:150,delay:.1,life:.1,dmg:25,kx:620,ky:-160,stun:.5,radial:true,color:col(),fx:'ring'}); sfx.cast(); }},
    {name:'Gravity Well',cd:9,lock:.3,cast(){ const tx=clamp(p.x+p.face*250,100,WW-100); hit({x:tx,y:p.y-40,r:125,delay:.3,life:2.2,tick:.25,dmg:8,pull:2000,pullX:tx,kx:0,ky:0,stun:.3,color:col(),fx:'well'}); sfx.cast(); }},
    {name:'Crush',cd:10,lock:.45,cast(){ const tx=aim(520); hit({x:tx,y:GROUND-160,w:120,h:320,delay:.55,life:.12,dmg:45,pin:true,stun:.9,color:col(),fx:'crush'}); }}
  ],
  ult:{name:'Event Horizon',lock:1.2,freeze:.8,cast(){ const tx=aim(520);
    hit({x:tx,y:p.y-60,r:250,delay:.3,life:2.5,tick:.2,dmg:14,pull:2800,pullX:tx,kx:0,ky:0,stun:.3,color:col(),fx:'hole'});
    hit({x:tx,y:p.y-60,r:250,delay:2.85,life:.1,dmg:90,kx:520,ky:-480,stun:.8,radial:true,color:'#fff',fx:'ring'}); }}
},
{ name:'Ren', tag:'Flame', color:'#FF9A4D', dark:'#4A1E14', hair:'#FF6A3D',
  blurb:'Fire at range. Bolts, a juggling pillar, a fan of sparks and a meteor.',
  m1:[
    {dmg:7,range:70,delay:.05,dur:.2,cd:.25,kx:110,ky:-10,stun:.25,step:100},
    {dmg:7,range:70,delay:.05,dur:.2,cd:.25,kx:110,ky:-10,stun:.25,step:100},
    {dmg:14,range:90,delay:.07,dur:.3,cd:.45,kx:380,ky:-240,stun:.45,step:140}],
  skills:[
    {name:'Fire Bolt',cd:3,lock:.25,cast(){ const f=p.face; proj({x:p.x+f*30,y:p.y-42,vx:f*640,vy:0,r:16,dmg:24,life:1.1,pierce:false,kx:f*240,ky:-160,stun:.35,color:col(),fx:'bolt',face:f,explode:{r:95,dmg:10,kx:260,ky:-200}}); sfx.cast(); }},
    {name:'Flame Pillar',cd:7,lock:.35,cast(){ const tx=aim(360); hit({x:tx,y:GROUND-135,w:96,h:270,delay:.45,life:.75,tick:.15,dmg:9,kx:0,ky:-150,stun:.3,color:col(),fx:'pillar'}); sfx.cast(); }},
    {name:'Ember Dash',cd:6,lock:.3,cast(){ const f=p.face; dashStart(f*1380,.16); hit({follow:true,ox:f*50,oy:-38,w:110,h:76,delay:0,life:.18,dmg:20,kx:f*300,ky:-190,stun:.4,color:col(),fx:'rush',face:f}); sfx.swing(); }},
    {name:'Fan of Fire',cd:8,lock:.45,cast(){ const f=p.face; for(let i=-2;i<=2;i++){ const a=i*.16; proj({x:p.x+f*30,y:p.y-42,vx:f*Math.cos(a)*600,vy:Math.sin(a)*600,r:11,dmg:12,life:.75,kx:f*120,ky:-80,stun:.3,color:col(),fx:'bolt',face:f}); } sfx.cast(); }}
  ],
  ult:{name:'Meteor',lock:1.3,freeze:.7,cast(){ const tx=aim(480);
    hit({x:tx,y:GROUND-20,r:190,delay:1.05,life:.15,dmg:140,kx:650,ky:-540,stun:1,radial:true,color:col(),fx:'meteor',face:p.face});
    hit({x:tx,y:GROUND-20,r:170,delay:1.2,life:2,tick:.25,dmg:7,kx:0,ky:0,stun:.3,color:col(),fx:'fire'}); }}
},
{ name:'Nami', tag:'Water', color:'#45C9FF', dark:'#123B59', hair:'#A9F1FF',
  blurb:'Fluid fighter. Water shots, a rushing wave, a healing current and a crashing tidal ultimate.',
  m1:[
    {dmg:7,range:74,delay:.04,dur:.2,cd:.24,kx:120,ky:-10,stun:.25,step:100},
    {dmg:8,range:74,delay:.04,dur:.2,cd:.24,kx:120,ky:-10,stun:.25,step:100},
    {dmg:14,range:88,delay:.07,dur:.3,cd:.42,kx:360,ky:-220,stun:.42,step:135}],
  skills:[
    {name:'Water Shot',cd:3,lock:.25,cast(){ const f=p.face; proj({x:p.x+f*30,y:p.y-42,vx:f*680,vy:0,r:15,dmg:22,life:1,pierce:false,kx:f*230,ky:-130,stun:.32,color:col(),fx:'bolt',face:f,explode:{r:70,dmg:7,kx:180,ky:-100}}); sfx.cast(); }},
    {name:'Tidal Rush',cd:6,lock:.3,cast(){ const f=p.face; dashStart(f*1250,.2); hit({follow:true,ox:f*55,oy:-38,w:135,h:88,delay:0,life:.25,dmg:25,kx:f*300,ky:-180,stun:.42,color:col(),fx:'rush',face:f}); sfx.swing(); }},
    {name:'Whirlpool',cd:8,lock:.35,cast(){ const tx=clamp(p.x+p.face*210,80,WW-80); hit({x:tx,y:p.y-40,r:115,delay:.2,life:1.6,tick:.25,dmg:7,pull:1500,pullX:tx,kx:0,ky:0,stun:.25,color:col(),fx:'well'}); sfx.cast(); }},
    {name:'Aqua Burst',cd:9,lock:.4,cast(){ hit({follow:true,ox:0,oy:-40,r:155,delay:.15,life:.12,dmg:34,kx:430,ky:-260,stun:.5,radial:true,color:col(),fx:'ring'}); sfx.cast(); }}
  ],
  ult:{name:'Tidal Collapse',lock:1.25,freeze:.8,cast(){ const tx=aim(500);
    hit({x:tx,y:GROUND-80,w:330,h:210,delay:.45,life:.8,tick:.2,dmg:18,kx:0,ky:-100,stun:.35,color:col(),fx:'wave'});
    hit({x:tx,y:GROUND-30,r:210,delay:1.35,life:.18,dmg:105,kx:580,ky:-460,stun:.85,radial:true,color:'#DDF8FF',fx:'ring'}); }}
},
{ name:'Raiden', tag:'Storm', color:'#FFE45E', dark:'#34305D', hair:'#FFF3A1',
  blurb:'A lightning-fast striker. Chain bolts, blink dashes and thunder bursts keep enemies guessing.',
  m1:[
    {dmg:7,range:76,delay:.03,dur:.18,cd:.22,kx:130,ky:-10,stun:.22,step:115},
    {dmg:8,range:76,delay:.03,dur:.18,cd:.22,kx:130,ky:-10,stun:.22,step:115},
    {dmg:15,range:90,delay:.06,dur:.27,cd:.4,kx:390,ky:-260,stun:.42,step:150}],
  skills:[
    {name:'Spark Shot',cd:3,lock:.22,cast(){ const f=p.face; proj({x:p.x+f*28,y:p.y-43,vx:f*820,vy:0,r:12,dmg:20,life:.9,pierce:true,kx:f*220,ky:-100,stun:.28,color:col(),fx:'bolt',face:f}); sfx.cast(); }},
    {name:'Flash Step',cd:5,lock:.25,cast(){ const f=p.face; dashStart(f*1650,.2); hit({follow:true,ox:f*50,oy:-38,w:120,h:78,delay:0,life:.18,dmg:23,kx:f*320,ky:-160,stun:.35,color:col(),fx:'rush',face:f}); sfx.swing(); }},
    {name:'Thunder Cage',cd:8,lock:.35,cast(){ const tx=aim(340); hit({x:tx,y:GROUND-85,w:100,h:170,delay:.25,life:.65,tick:.2,dmg:10,kx:0,ky:-80,stun:.3,color:col(),fx:'pillar'}); sfx.cast(); }},
    {name:'Static Burst',cd:9,lock:.35,cast(){ hit({follow:true,ox:0,oy:-42,r:145,delay:.1,life:.12,dmg:32,kx:420,ky:-250,stun:.48,radial:true,color:col(),fx:'ring'}); sfx.cast(); }}
  ],
  ult:{name:'Skybreaker',lock:1.15,freeze:.75,cast(){ const tx=aim(520);
    hit({x:tx,y:GROUND-150,w:150,h:300,delay:.45,life:.55,tick:.15,dmg:16,kx:0,ky:-160,stun:.35,color:col(),fx:'pillar'});
    hit({x:tx,y:GROUND-30,r:225,delay:1.1,life:.18,dmg:115,kx:620,ky:-500,stun:.8,radial:true,color:'#FFFFFF',fx:'ring'}); }}
},
{ name:'Boulder', tag:'Earth', color:'#C99A6B', dark:'#44352B', hair:'#E8C49B',
  blurb:'A heavy earth guardian. Stone fists, ground spikes and a huge quake hit hard and control space.',
  m1:[
    {dmg:10,range:76,delay:.07,dur:.24,cd:.3,kx:150,ky:-10,stun:.28,step:75},
    {dmg:11,range:76,delay:.07,dur:.24,cd:.3,kx:150,ky:-10,stun:.28,step:75},
    {dmg:19,range:92,delay:.1,dur:.34,cd:.5,kx:470,ky:-220,stun:.5,step:95}],
  skills:[
    {name:'Stone Toss',cd:4,lock:.28,cast(){ const f=p.face; proj({x:p.x+f*30,y:p.y-44,vx:f*520,vy:-70,r:20,dmg:26,life:1.1,pierce:false,kx:f*280,ky:-180,stun:.38,color:col(),fx:'bolt',face:f,explode:{r:85,dmg:9,kx:200,ky:-140}}); sfx.cast(); }},
    {name:'Fault Line',cd:7,lock:.35,cast(){ const f=p.face; hit({x:p.x+f*150,y:GROUND-20,w:300,h:95,delay:.18,life:.2,dmg:28,kx:f*300,ky:-300,stun:.45,color:col(),fx:'wave',face:f}); sfx.cast(); }},
    {name:'Stone Guard',cd:8,lock:.35,cast(){ hit({follow:true,ox:0,oy:-42,r:125,delay:.08,life:.12,dmg:25,kx:330,ky:-220,stun:.42,radial:true,color:col(),fx:'ring'}); p.hp=Math.min(p.maxhp,p.hp+12); sfx.cast(); }},
    {name:'Seismic Pillars',cd:10,lock:.45,cast(){ const tx=aim(420); for(let i=-1;i<=1;i++) hit({x:clamp(tx+i*85,50,WW-50),y:GROUND-115,w:62,h:230,delay:.2+Math.abs(i)*.12,life:.18,dmg:22,kx:i*180,ky:-420,stun:.42,color:col(),fx:'pillar'}); sfx.cast(); }}
  ],
  ult:{name:'Worldsplitter',lock:1.35,freeze:.85,cast(){ const tx=aim(500);
    hit({x:tx,y:GROUND-45,w:430,h:150,delay:.45,life:.5,tick:.16,dmg:20,kx:0,ky:-100,stun:.4,color:col(),fx:'wave'});
    hit({x:tx,y:GROUND-30,r:235,delay:1.05,life:.2,dmg:125,kx:560,ky:-520,stun:.9,radial:true,color:'#FFF0D8',fx:'ring'}); }}
},
{ name:'Shin', tag:'Shadow', color:'#B7A7FF', dark:'#211A36', hair:'#E4DFFF',
  blurb:'A tricky shadow assassin with feints, teleport strikes and a devastating eclipse.',
  m1:[{dmg:7,range:76,delay:.03,dur:.18,cd:.22,kx:125,ky:-10,stun:.23,step:125},{dmg:8,range:76,delay:.03,dur:.18,cd:.22,kx:125,ky:-10,stun:.23,step:125},{dmg:16,range:90,delay:.06,dur:.27,cd:.4,kx:420,ky:-250,stun:.43,step:160}],
  skills:[
    {name:'Shade Dart',cd:3,lock:.2,cast(){const f=p.face;proj({x:p.x+f*28,y:p.y-42,vx:f*760,vy:0,r:13,dmg:21,life:1,pierce:true,kx:f*250,ky:-130,stun:.32,color:col(),fx:'bolt',face:f});sfx.cast();}},
    {name:'Nightstep',cd:5,lock:.22,cast(){const f=p.face;dashStart(f*1700,.2);hit({follow:true,ox:f*48,oy:-40,w:120,h:80,delay:0,life:.18,dmg:24,kx:f*340,ky:-170,stun:.4,color:col(),fx:'rush',face:f});sfx.swing();}},
    {name:'Dark Bind',cd:8,lock:.32,cast(){const tx=aim(360);hit({x:tx,y:p.y-42,w:130,h:100,delay:.2,life:.5,tick:.18,dmg:10,kx:0,ky:-70,stun:.4,pin:true,color:col(),fx:'well'});sfx.cast();}},
    {name:'Afterimage',cd:9,lock:.3,cast(){hit({follow:true,ox:0,oy:-42,r:150,delay:.08,life:.12,dmg:32,kx:440,ky:-260,stun:.5,radial:true,color:col(),fx:'ring'});sfx.cast();}}
  ],
  ult:{name:'Eclipse Execution',lock:1.2,freeze:.75,cast(){const tx=aim(520);hit({x:tx,y:p.y-45,r:180,delay:.35,life:.8,tick:.16,dmg:18,kx:0,ky:-80,stun:.4,pull:900,pullX:tx,color:col(),fx:'hole'});hit({x:tx,y:GROUND-30,r:225,delay:1.2,life:.18,dmg:120,kx:600,ky:-480,stun:.85,radial:true,color:'#F2EFFF',fx:'ring'});}}
},
{ name:'Yuki', tag:'Frost', color:'#8CEBFF', dark:'#163B55', hair:'#E6FCFF',
  blurb:'Freezes the arena with ice shots, frost traps and a blizzard finisher.',
  m1:[{dmg:7,range:74,delay:.04,dur:.2,cd:.24,kx:115,ky:-10,stun:.25,step:95},{dmg:8,range:74,delay:.04,dur:.2,cd:.24,kx:115,ky:-10,stun:.25,step:95},{dmg:15,range:88,delay:.07,dur:.3,cd:.42,kx:350,ky:-240,stun:.45,step:130}],
  skills:[
    {name:'Ice Lance',cd:3,lock:.22,cast(){const f=p.face;proj({x:p.x+f*30,y:p.y-42,vx:f*700,vy:0,r:15,dmg:23,life:1,pierce:false,kx:f*260,ky:-140,stun:.38,color:col(),fx:'bolt',face:f});sfx.cast();}},
    {name:'Frost Slide',cd:5,lock:.25,cast(){const f=p.face;dashStart(f*1350,.2);hit({follow:true,ox:f*48,oy:-38,w:130,h:78,delay:0,life:.22,dmg:23,kx:f*280,ky:-170,stun:.45,color:col(),fx:'rush',face:f});sfx.swing();}},
    {name:'Glacier Trap',cd:8,lock:.35,cast(){const tx=aim(380);hit({x:tx,y:GROUND-85,w:130,h:170,delay:.22,life:.7,tick:.2,dmg:11,kx:0,ky:-80,stun:.5,pin:true,color:col(),fx:'pillar'});sfx.cast();}},
    {name:'Shatter Ring',cd:9,lock:.35,cast(){hit({follow:true,ox:0,oy:-40,r:155,delay:.1,life:.12,dmg:34,kx:420,ky:-280,stun:.55,radial:true,color:col(),fx:'ring'});sfx.cast();}}
  ],
  ult:{name:'Absolute Zero',lock:1.25,freeze:.8,cast(){const tx=aim(500);hit({x:tx,y:GROUND-100,w:300,h:200,delay:.35,life:.7,tick:.16,dmg:18,kx:0,ky:-90,stun:.5,pin:true,color:col(),fx:'wave'});hit({x:tx,y:GROUND-30,r:230,delay:1.15,life:.2,dmg:120,kx:580,ky:-500,stun:.9,radial:true,color:'#FFFFFF',fx:'ring'});}}
},
{ name:'Vex', tag:'Arcane', color:'#FF79D1', dark:'#4B1749', hair:'#FFC7ED',
  blurb:'An arcane brawler who bends energy into homing bursts and explosive sigils.',
  m1:[{dmg:8,range:72,delay:.04,dur:.2,cd:.24,kx:110,ky:-10,stun:.25,step:100},{dmg:8,range:72,delay:.04,dur:.2,cd:.24,kx:110,ky:-10,stun:.25,step:100},{dmg:16,range:90,delay:.07,dur:.3,cd:.42,kx:400,ky:-250,stun:.45,step:135}],
  skills:[
    {name:'Arc Bolt',cd:3,lock:.22,cast(){const f=p.face;proj({x:p.x+f*28,y:p.y-42,vx:f*660,vy:-30,r:16,dmg:24,life:1,pierce:false,kx:f*240,ky:-160,stun:.35,color:col(),fx:'bolt',face:f,explode:{r:75,dmg:8,kx:180,ky:-120}});sfx.cast();}},
    {name:'Rune Rush',cd:5,lock:.25,cast(){const f=p.face;dashStart(f*1450,.18);hit({follow:true,ox:f*50,oy:-38,w:120,h:80,delay:0,life:.2,dmg:23,kx:f*300,ky:-190,stun:.42,color:col(),fx:'rush',face:f});sfx.swing();}},
    {name:'Sigil Mine',cd:8,lock:.32,cast(){const tx=aim(400);hit({x:tx,y:GROUND-35,r:110,delay:.35,life:.12,dmg:34,kx:380,ky:-260,stun:.5,radial:true,color:col(),fx:'ring'});sfx.cast();}},
    {name:'Mana Storm',cd:9,lock:.35,cast(){for(let i=-2;i<=2;i++)proj({x:p.x+p.face*25,y:p.y-40,vx:p.face*560,vy:i*95,r:11,dmg:13,life:.9,pierce:true,kx:p.face*180,ky:-100,stun:.3,color:col(),fx:'bolt',face:p.face});sfx.cast();}}
  ],
  ult:{name:'Astral Detonation',lock:1.25,freeze:.8,cast(){const tx=aim(500);hit({x:tx,y:p.y-50,r:175,delay:.35,life:1,tick:.18,dmg:17,kx:0,ky:-70,stun:.4,pull:1300,pullX:tx,color:col(),fx:'hole'});hit({x:tx,y:GROUND-30,r:230,delay:1.25,life:.2,dmg:125,kx:620,ky:-500,stun:.9,radial:true,color:'#FFF0FA',fx:'ring'});}}
},
{ name:'Sora', tag:'Wind', color:'#7DFFB0', dark:'#1F5D49', hair:'#B9FFE0',
  blurb:'Long-reach lancer. Fast thrusts, vacuum spins and wind that launches foes.', wp:'spear',
  m1:[{dmg:6,range:125,delay:.04,dur:.2,cd:.22,kx:90,ky:-10,stun:.2,step:60},{dmg:6,range:125,delay:.04,dur:.2,cd:.22,kx:90,ky:-10,stun:.2,step:60},{dmg:13,range:140,delay:.07,dur:.3,cd:.42,kx:300,ky:-380,stun:.5,step:120}],
  skills:[{name:'Gale Thrust',cd:4,lock:.25},{name:'Cyclone',cd:6,lock:.3},{name:'Updraft',cd:8,lock:.3},{name:'Wind Wall',cd:9,lock:.35}],
  ult:{name:'Tempest Lance',lock:1.3,freeze:1.1,cast(){ const d=p.face,c=col(),px=p.x; for(let n=0;n<7;n++) hit({x:clamp(px+d*(70+n*110),40,WW-40),y:GROUND-150,w:110,h:320,delay:.2+n*.12,life:.2,dmg:16,kx:d*140,ky:-440,stun:.6,color:c,fx:'pillar'}); hit({x:clamp(px+d*400,40,WW-40),y:GROUND-20,r:260,delay:1.1,life:.12,dmg:34,kx:380,ky:-420,stun:.7,radial:true,color:'#fff',fx:'ring'}); }}
},
{ name:'Hana', tag:'Bloom', color:'#FF7AC8', dark:'#7A2A5E', hair:'#FFB3E0',
  blurb:'Whip-wielding binder. Seeds, snares and healing blooms wear foes down.', wp:'whip',
  m1:[{dmg:5,range:105,delay:.08,dur:.28,cd:.3,kx:60,ky:-10,stun:.2,step:40},{dmg:5,range:105,delay:.08,dur:.28,cd:.3,kx:60,ky:-10,stun:.2,step:40},{dmg:6,range:110,delay:.08,dur:.28,cd:.3,kx:60,ky:-10,stun:.2,step:40},{dmg:11,range:125,delay:.1,dur:.34,cd:.5,kx:-260,ky:-60,stun:.5,step:60}],
  skills:[{name:'Seed Shot',cd:3,lock:.25},{name:'Thorn Snare',cd:7,lock:.3},{name:'Bloom',cd:8,lock:.35},{name:'Vine Lash',cd:5,lock:.3}],
  ult:{name:'Thousand Petals',lock:1.5,freeze:1.2,cast(){ const c=col(),px=p.x; hit({x:px,y:p.y-60,r:270,delay:.3,life:1.6,tick:.12,dmg:7,pull:1300,pullX:px,kx:0,ky:-40,stun:.3,color:c,fx:'well'}); hit({x:px,y:p.y-50,r:300,delay:2,life:.15,dmg:55,kx:420,ky:-460,stun:.9,radial:true,color:'#fff',fx:'hole'}); p.hp=Math.min(p.maxhp,p.hp+30); }}
},
{ name:'Kyo', tag:'Light', color:'#DDE8FF', dark:'#34406B', hair:'#F6F3E4',
  blurb:'Ranged archer. Every basic attack is an arrow; keep your distance and punish.', wp:'bow',
  m1:[{dmg:5,proj:1,sp:900,delay:.04,dur:.24,cd:.3,kx:40,ky:-10,stun:.15,step:-40},{dmg:5,proj:1,sp:900,delay:.04,dur:.24,cd:.3,kx:40,ky:-10,stun:.15,step:-40},{dmg:11,proj:1,sp:1250,delay:.06,dur:.3,cd:.48,kx:260,ky:-120,stun:.4,step:-90}],
  skills:[{name:'Piercing Arrow',cd:3,lock:.3},{name:'Triple Volley',cd:5,lock:.35},{name:'Sunfall Sigil',cd:8,lock:.3},{name:'Backflip Shot',cd:6,lock:.3}],
  ult:{name:'Judgement Rain',lock:1.4,freeze:1.2,cast(){ const d=p.face,c=col(),px=p.x; for(let n=0;n<10;n++) hit({x:clamp(px+d*(60+n*85),40,WW-40),y:GROUND-150,w:64,h:320,delay:.15+n*.1,life:.14,dmg:14,kx:d*80,ky:-300,stun:.5,color:'#FFF08A',fx:'pillar'}); }}
},
{ name:'Gorou', tag:'Rage', color:'#FF4D6D', dark:'#4A1020', hair:'#3A1020',
  blurb:'Berserker brawler. Blistering claws, lifesteal and a roar that locks foes down.', wp:'claw',
  m1:[{dmg:5,range:66,delay:.02,dur:.14,cd:.16,kx:40,ky:-5,stun:.15,step:80},{dmg:5,range:66,delay:.02,dur:.14,cd:.16,kx:40,ky:-5,stun:.15,step:80},{dmg:6,range:68,delay:.02,dur:.14,cd:.16,kx:40,ky:-5,stun:.15,step:80},{dmg:12,range:80,delay:.05,dur:.24,cd:.4,kx:380,ky:-200,stun:.45,step:150}],
  skills:[{name:'Rending Claw',cd:3,lock:.25},{name:'Blood Leap',cd:6,lock:.35},{name:'Savage Roar',cd:8,lock:.4},{name:'Rampage',cd:9,lock:.5}],
  ult:{name:'Bloodmoon Frenzy',lock:1.6,freeze:1.4,cast(){ const c=col(); for(let i=0;i<16;i++) hit({follow:true,ox:0,oy:-45,r:155,delay:.1+i*.08,life:.06,dmg:9,kx:200,ky:-90,stun:.25,radial:true,color:c,fx:'fire'}); hit({follow:true,ox:0,oy:-45,r:220,delay:1.45,life:.12,dmg:60,kx:560,ky:-420,stun:.8,radial:true,color:'#fff',fx:'hole'}); p.hp=Math.min(p.maxhp,p.hp+35); }}
},
{ name:'Toki', tag:'Time', color:'#F5D78A', dark:'#5C4A1C', hair:'#6A5A3A',
  blurb:'Chrono scythe-wielder. Freeze foes in time, echo slashes and rewind your wounds.', wp:'scythe',
  m1:[{dmg:7,range:100,delay:.1,dur:.3,cd:.34,kx:120,ky:-20,stun:.3,step:60},{dmg:8,range:100,delay:.1,dur:.3,cd:.34,kx:120,ky:-20,stun:.3,step:60},{dmg:14,range:112,delay:.12,dur:.38,cd:.56,kx:340,ky:-260,stun:.55,step:100}],
  skills:[{name:'Time Shard',cd:4,lock:.3},{name:'Rewind',cd:8,lock:.25},{name:'Stasis Field',cd:9,lock:.3},{name:'Echo Slash',cd:5,lock:.35}],
  ult:{name:'Zero Hour',lock:1.5,freeze:1.3,cast(){ const px=p.x,c=col(); for(const e of foes()) if(!e.dead&&Math.abs(e.x-px)<520) e.stun=Math.max(e.stun||0,3.2); hit({x:px,y:p.y-60,r:420,delay:.2,life:2.6,tick:.2,dmg:5,pin:true,stun:.4,color:c,fx:'well'}); hit({x:px,y:p.y-60,r:430,delay:1.5,life:.12,dmg:70,kx:320,ky:-420,stun:.9,radial:true,color:'#fff',fx:'hole'}); }}
},
{ name:'Kuro', tag:'Venom', color:'#C6FF3D', dark:'#2E3F10', hair:'#3A4A1A',
  blurb:'Poison trickster. Toxic darts, lingering clouds and a plague bloom wear foes down.',
  m1:[{dmg:6,range:72,delay:0.04,dur:0.18,cd:0.22,kx:100,ky:-10,stun:0.22,step:100},{dmg:6,range:72,delay:0.04,dur:0.18,cd:0.22,kx:100,ky:-10,stun:0.22,step:100},{dmg:12,range:84,delay:0.06,dur:0.26,cd:0.4,kx:330,ky:-220,stun:0.42,step:140}],
  skills:[{name:'Venom Dart',cd:3,lock:.25},{name:'Toxic Cloud',cd:7,lock:.3},{name:'Serpent Dash',cd:6,lock:.3},{name:'Fang Burst',cd:8,lock:.4}],
  ult:{name:'Plague Bloom',lock:1.3,freeze:.9,cast(){ const tx=aim(420),c=col(); hit({x:tx,y:p.y-50,r:300,delay:.35,life:3,tick:.2,dmg:8,kx:0,ky:-30,stun:.3,color:c,fx:'well'}); hit({x:tx,y:p.y-50,r:330,delay:3.4,life:.12,dmg:60,kx:480,ky:-420,stun:.8,radial:true,color:'#fff',fx:'ring'}); }}
},
{ name:'Tetsu', tag:'Iron', color:'#A9B4C8', dark:'#2E3442', hair:'#5A6478',
  blurb:'Iron guardian. Heavy punches, shield bashes and a body that shrugs off damage.',
  m1:[{dmg:12,range:70,delay:0.1,dur:0.28,cd:0.38,kx:200,ky:-20,stun:0.35,step:50},{dmg:14,range:72,delay:0.1,dur:0.28,cd:0.4,kx:240,ky:-20,stun:0.4,step:55},{dmg:22,range:84,delay:0.14,dur:0.38,cd:0.62,kx:540,ky:-260,stun:0.6,step:75}],
  skills:[{name:'Iron Fist',cd:4,lock:.4},{name:'Shield Bash',cd:6,lock:.3},{name:'Magnet Grip',cd:8,lock:.35},{name:'Iron Guard',cd:9,lock:.4}],
  ult:{name:'Steel Colossus',lock:1.4,freeze:1,cast(){ const c=col(); p.inv=Math.max(p.inv,2); for(let n=0;n<3;n++) hit({follow:true,ox:0,oy:-45,r:170+n*50,delay:.3+n*.35,life:.12,dmg:20+n*10,kx:420+n*100,ky:-300,stun:.6,radial:true,color:c,fx:'ring'}); hit({follow:true,ox:0,oy:-45,r:300,delay:1.5,life:.15,dmg:60,kx:650,ky:-520,stun:1,radial:true,color:'#fff',fx:'hole'}); p.hp=Math.min(p.maxhp,p.hp+25); }}
},
{ name:'Rei', tag:'Moon', color:'#6C7BFF', dark:'#1B2060', hair:'#2A2F6E',
  blurb:'Moon teleporter. Blink to your foe, trap them in an eclipse and rain stars on them.',
  m1:[{dmg:6,range:74,delay:0.03,dur:0.18,cd:0.22,kx:110,ky:-10,stun:0.22,step:115},{dmg:7,range:74,delay:0.03,dur:0.18,cd:0.22,kx:110,ky:-10,stun:0.22,step:115},{dmg:13,range:88,delay:0.06,dur:0.27,cd:0.4,kx:380,ky:-240,stun:0.42,step:150}],
  skills:[{name:'Lunar Disc',cd:4,lock:.3},{name:'Blink Strike',cd:5,lock:.25},{name:'Eclipse Zone',cd:9,lock:.35},{name:'Starfall',cd:8,lock:.4}],
  ult:{name:'Total Eclipse',lock:1.4,freeze:1.1,cast(){ const c=col(),px=p.x; for(const e of foes()) if(!e.dead&&Math.abs(e.x-px)<480) e.stun=Math.max(e.stun||0,1.6); hit({x:px,y:p.y-60,r:460,delay:.3,life:1.4,tick:.2,dmg:6,pin:true,stun:.4,color:c,fx:'hole'}); for(let n=0;n<3;n++) hit({x:px,y:p.y-60,r:380,delay:.7+n*.35,life:.1,dmg:28,kx:300,ky:-300,stun:.6,radial:true,color:'#fff',fx:'ring'}); }}
},
{ name:'Oto', tag:'Sound', color:'#19C3A6', dark:'#0E3B36', hair:'#0F5A50',
  blurb:'Sonic brawler. Echoing waves, bass drops and a final encore shake the whole arena.',
  m1:[{dmg:5,range:68,delay:0.03,dur:0.15,cd:0.19,kx:60,ky:-5,stun:0.18,step:80},{dmg:5,range:68,delay:0.03,dur:0.15,cd:0.19,kx:60,ky:-5,stun:0.18,step:80},{dmg:5,range:68,delay:0.03,dur:0.15,cd:0.19,kx:60,ky:-5,stun:0.18,step:80},{dmg:13,range:82,delay:0.06,dur:0.26,cd:0.42,kx:400,ky:-230,stun:0.45,step:140}],
  skills:[{name:'Sound Wave',cd:3,lock:.25},{name:'Bass Drop',cd:7,lock:.4},{name:'Resonance',cd:8,lock:.3},{name:'Amp Slide',cd:6,lock:.3}],
  ult:{name:'Final Encore',lock:1.4,freeze:1.2,cast(){ const c=col(),d=p.face,px=p.x; for(let n=0;n<4;n++) hit({x:clamp(px+d*(80+n*100),40,WW-40),y:p.y-50,r:120,delay:.25+n*.2,life:.1,dmg:20,kx:d*200,ky:-300,stun:.5,radial:true,color:c,fx:'ring'}); hit({follow:true,ox:0,oy:-45,r:380,delay:1.3,life:.12,dmg:60,kx:620,ky:-460,stun:.9,radial:true,color:'#fff',fx:'ring'}); }}
},
{ name:'Ryu', tag:'Dragon', color:'#FFB020', dark:'#4A2C0A', hair:'#C0402A',
  blurb:'Dragon-fist fighter. Flame punches, a rising kick and a roar that heals.',
  m1:[{dmg:8,range:72,delay:0.04,dur:0.2,cd:0.24,kx:130,ky:-10,stun:0.25,step:110},{dmg:8,range:72,delay:0.04,dur:0.2,cd:0.24,kx:130,ky:-10,stun:0.25,step:110},{dmg:16,range:88,delay:0.07,dur:0.3,cd:0.46,kx:420,ky:-260,stun:0.45,step:150}],
  skills:[{name:'Dragon Jab',cd:3,lock:.25},{name:'Rising Dragon',cd:6,lock:.4},{name:'Flame Coil',cd:7,lock:.3},{name:'Dragon Roar',cd:9,lock:.4}],
  ult:{name:'Heavenly Dragon',lock:1.5,freeze:1.3,cast(){ const d=p.face,c=col(),px=p.x; for(let n=0;n<6;n++) hit({x:clamp(px+d*(70+n*95),40,WW-40),y:GROUND-30,r:100,delay:.2+n*.12,life:.12,dmg:14,kx:d*120,ky:-380,stun:.5,radial:true,color:c,fx:'fire'}); hit({x:clamp(px+d*600,60,WW-60),y:GROUND-30,r:240,delay:1.1,life:.15,dmg:90,kx:640,ky:-520,stun:1,radial:true,color:'#fff',fx:'meteor',face:d}); p.hp=Math.min(p.maxhp,p.hp+20); }}
},
{ name:'God', tag:'Divine', color:'#FFE98A', dark:'#5A4A10', hair:'#FFFFFF', secret:true, admin:true,
  blurb:'Admin-only divine being. Basic attacks hit for 100, every skill hits for 500.',
  m1:[{dmg:100,range:92,delay:.04,dur:.2,cd:.24,kx:260,ky:-80,stun:.5,step:110},{dmg:100,range:92,delay:.04,dur:.2,cd:.24,kx:260,ky:-80,stun:.5,step:110},{dmg:100,range:100,delay:.06,dur:.26,cd:.34,kx:520,ky:-300,stun:.7,step:150}],
  skills:[{name:'Smite',cd:2,lock:.25},{name:'Divine Step',cd:3,lock:.25},{name:'Heaven\'s Fall',cd:4,lock:.35},{name:'Judgment',cd:5,lock:.35}],
  ult:{name:'Genesis',lock:1.4,freeze:1.2,cast(){ const c=col(); for(let n=0;n<3;n++) hit({follow:true,ox:0,oy:-45,r:300+n*60,delay:.3+n*.3,life:.12,dmg:500,kx:600,ky:-400,stun:.8,radial:true,color:c,fx:'ring'}); hit({follow:true,ox:0,oy:-45,r:520,delay:1.3,life:.15,dmg:999,kx:800,ky:-600,stun:1.2,radial:true,color:'#fff',fx:'hole'}); }}
},
{ name:'Nova', tag:'Cosmic', color:'#FF8AD8', dark:'#4A1A44', hair:'#FFD6F5', secret:true, admin:true,
  blurb:'Star-borne admin fighter. Star shots, comet dashes and meteor rain.',
  m1:[{dmg:34,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:34,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:62,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Star Volley',cd:3,lock:.3},{name:'Comet Dash',cd:5,lock:.3},{name:'Meteor Rain',cd:8,lock:.3},{name:'Supernova',cd:9,lock:.3}],
  ult:{name:'Big Bang',lock:1.5,freeze:1.2,cast(){ admUlt(20); }}
},
{ name:'Grimm', tag:'Reaper', color:'#7CFFA8', dark:'#0F3A26', hair:'#3A4A42', secret:true, admin:true,
  blurb:'Admin reaper. Soul waves, grave steps and a harvest of pillars.',
  m1:[{dmg:36,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:36,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:64,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Soul Scythe',cd:3,lock:.3},{name:'Grave Step',cd:5,lock:.3},{name:'Reaping Field',cd:8,lock:.3},{name:'Death Toll',cd:10,lock:.3}],
  ult:{name:'Harvest',lock:1.5,freeze:1.2,cast(){ admUlt(21); }}
},
{ name:'Volt-9', tag:'Cyber', color:'#4DE8FF', dark:'#0B2E4A', hair:'#2A4A6A', secret:true, admin:true,
  blurb:'Admin machine. Rapid lasers, overclocked dashes and orbital strikes.',
  m1:[{dmg:28,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:28,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:52,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Laser Burst',cd:3,lock:.3},{name:'Overclock',cd:4,lock:.3},{name:'EMP Pulse',cd:8,lock:.3},{name:'Orbital Strike',cd:10,lock:.3}],
  ult:{name:'System Crash',lock:1.5,freeze:1.2,cast(){ admUlt(22); }}
},
{ name:'Pyra', tag:'Inferno', color:'#FF5A3C', dark:'#4A1008', hair:'#FFB347', secret:true, admin:true,
  blurb:'Admin flame queen. Fireballs, a phoenix rise and erupting walls of fire.',
  m1:[{dmg:38,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:38,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:66,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Fireball',cd:3,lock:.3},{name:'Phoenix Rise',cd:6,lock:.3},{name:'Inferno Wall',cd:8,lock:.3},{name:'Eruption',cd:10,lock:.3}],
  ult:{name:'Solar Flare',lock:1.5,freeze:1.2,cast(){ admUlt(23); }}
},
{ name:'Aegis', tag:'Paladin', color:'#7FB2FF', dark:'#14264F', hair:'#E8F0FF', secret:true, admin:true,
  blurb:'Admin paladin. Holy lances, shield charges and a healing sanctuary.',
  m1:[{dmg:34,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:34,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:58,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Holy Lance',cd:3,lock:.3},{name:'Shield Charge',cd:6,lock:.3},{name:'Sanctuary',cd:9,lock:.3},{name:'Judgment Beam',cd:10,lock:.3}],
  ult:{name:'Divine Bulwark',lock:1.5,freeze:1.2,cast(){ admUlt(24); }}
},
{ name:'Sera', tag:'Tempest', color:'#B8FF6A', dark:'#2B4A10', hair:'#F2FFD0', secret:true, admin:true,
  blurb:'Admin storm-caller. Gale slashes, cyclones and raining fire.',
  m1:[{dmg:32,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:32,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:60,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Gale Slash',cd:3,lock:.3},{name:'Cyclone',cd:7,lock:.3},{name:'Updraft',cd:6,lock:.3},{name:'Storm Front',cd:10,lock:.3}],
  ult:{name:'Hurricane',lock:1.5,freeze:1.2,cast(){ admUlt(25); }}
},
{ name:'Titan', tag:'Mech', color:'#FFB020', dark:'#4A3200', hair:'#444444', secret:true, admin:true,
  blurb:'Admin war machine. Rocket fists, boost slams and missile barrages.',
  m1:[{dmg:46,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:46,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:80,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Rocket Punch',cd:4,lock:.3},{name:'Boost Slam',cd:6,lock:.3},{name:'Quake Stomp',cd:9,lock:.3},{name:'Missile Barrage',cd:10,lock:.3}],
  ult:{name:'Final Form',lock:1.5,freeze:1.2,cast(){ admUlt(26); }}
},
{ name:'Wraith', tag:'Phantom', color:'#C9C2FF', dark:'#1E1A40', hair:'#F4F2FF', secret:true, admin:true,
  blurb:'Admin ghost. Phantom bolts, haunting dashes and soul-draining fields.',
  m1:[{dmg:32,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:32,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:56,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Phantom Bolt',cd:3,lock:.3},{name:'Haunt',cd:4,lock:.3},{name:'Spirit Drain',cd:8,lock:.3},{name:'Banshee Wail',cd:10,lock:.3}],
  ult:{name:'Possession',lock:1.5,freeze:1.2,cast(){ admUlt(27); }}
},
{ name:'Kage', tag:'Ninja', color:'#FF4D6D', dark:'#3A0F1A', hair:'#14101A', secret:true, admin:true,
  blurb:'Admin shadow blade. Shuriken fans, smoke bombs and a thousand edges.',
  m1:[{dmg:26,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:26,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:50,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Shuriken Fan',cd:3,lock:.3},{name:'Shadow Slash',cd:4,lock:.3},{name:'Smoke Bomb',cd:6,lock:.3},{name:'Thousand Edge',cd:8,lock:.3}],
  ult:{name:'Moonless Night',lock:1.5,freeze:1.2,cast(){ admUlt(28); }}
},
{ name:'Pip', tag:'Trickster', color:'#40E0B0', dark:'#08382C', hair:'#FFE14D', secret:true, admin:true,
  blurb:'Admin jester. Juggled bombs, teleport pranks and confetti storms.',
  m1:[{dmg:30,range:84,delay:.04,dur:.2,cd:0.22,kx:140,ky:-20,stun:0.28,step:110},{dmg:30,range:84,delay:.04,dur:.2,cd:0.22,kx:150,ky:-20,stun:0.28,step:110},{dmg:56,range:94,delay:.04,dur:.2,cd:0.38,kx:520,ky:-300,stun:0.55,step:150}],
  skills:[{name:'Juggle Bomb',cd:3,lock:.3},{name:'Teleport Prank',cd:5,lock:.3},{name:'Confetti Burst',cd:4,lock:.3},{name:'Jack-in-Box',cd:9,lock:.3}],
  ult:{name:'Grand Finale',lock:1.5,freeze:1.2,cast(){ admUlt(29); }}
},
{ name:'Ember', tag:'Blazer', color:'#FF7A3D', dark:'#4A1A08', hair:'#FFC36B', shop:true,
 blurb:'Blazer fighter with four unique skills and a devastating ultimate.',
 m1:[{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:62,range:96,delay:.05,dur:.22,cd:.4,kx:520,ky:-300,stun:.55,step:150}],
 skills:[{name:'Ember Strike',cd:3,lock:.3},{name:'Ember Dash',cd:4,lock:.3},{name:'Ember Barrage',cd:5,lock:.3},{name:'Ember Burst',cd:8,lock:.3}],
 ult:{name:'Ember Zenith',lock:1.5,freeze:1.2,cast(){ admUlt(30); }}
},
{ name:'Frost', tag:'Glacier', color:'#8FE3FF', dark:'#0E3550', hair:'#EAFBFF', shop:true,
 blurb:'Glacier fighter with four unique skills and a devastating ultimate.',
 m1:[{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:62,range:96,delay:.05,dur:.22,cd:.4,kx:520,ky:-300,stun:.55,step:150}],
 skills:[{name:'Frost Strike',cd:3,lock:.3},{name:'Frost Dash',cd:4,lock:.3},{name:'Frost Barrage',cd:5,lock:.3},{name:'Frost Burst',cd:8,lock:.3}],
 ult:{name:'Frost Zenith',lock:1.5,freeze:1.2,cast(){ admUlt(31); }}
},
{ name:'Zephyr', tag:'Windblade', color:'#B6FF8A', dark:'#25460F', hair:'#F2FFE0', shop:true,
 blurb:'Windblade fighter with four unique skills and a devastating ultimate.',
 m1:[{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:62,range:96,delay:.05,dur:.22,cd:.4,kx:520,ky:-300,stun:.55,step:150}],
 skills:[{name:'Zephyr Strike',cd:3,lock:.3},{name:'Zephyr Dash',cd:4,lock:.3},{name:'Zephyr Barrage',cd:5,lock:.3},{name:'Zephyr Burst',cd:8,lock:.3}],
 ult:{name:'Zephyr Zenith',lock:1.5,freeze:1.2,cast(){ admUlt(32); }}
},
{ name:'Onyx', tag:'Voidknight', color:'#B28CFF', dark:'#22104A', hair:'#E5D9FF', shop:true,
 blurb:'Voidknight fighter with four unique skills and a devastating ultimate.',
 m1:[{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:62,range:96,delay:.05,dur:.22,cd:.4,kx:520,ky:-300,stun:.55,step:150}],
 skills:[{name:'Onyx Strike',cd:3,lock:.3},{name:'Onyx Dash',cd:4,lock:.3},{name:'Onyx Barrage',cd:5,lock:.3},{name:'Onyx Burst',cd:8,lock:.3}],
 ult:{name:'Onyx Zenith',lock:1.5,freeze:1.2,cast(){ admUlt(33); }}
},
{ name:'Sol', tag:'Radiant', color:'#FFE066', dark:'#4A3A08', hair:'#FFF6C9', shop:true,
 blurb:'Radiant fighter with four unique skills and a devastating ultimate.',
 m1:[{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:34,range:86,delay:.04,dur:.2,cd:.24,kx:150,ky:-20,stun:.3,step:110},{dmg:62,range:96,delay:.05,dur:.22,cd:.4,kx:520,ky:-300,stun:.55,step:150}],
 skills:[{name:'Sol Strike',cd:3,lock:.3},{name:'Sol Dash',cd:4,lock:.3},{name:'Sol Barrage',cd:5,lock:.3},{name:'Sol Burst',cd:8,lock:.3}],
 ult:{name:'Sol Zenith',lock:1.5,freeze:1.2,cast(){ admUlt(34); }}
}];

/* ---------- fighter identity pass ----------
   Each fighter has a gameplay trait in addition to unique named skill casts.
   Traits trigger during their own kit so characters don't feel like palette swaps. */
const FIGHTER_TRAITS = [
  {name:'Blade Rhythm', text:'Kaito: combo finishers hit harder and push farther.'},
  {name:'Gravity Drain', text:'Mira: gravity skills pull enemies toward their impact point.'},
  {name:'Burning Core', text:'Ren: fire attacks leave a brief lingering blast zone.'},
  {name:'Tidal Recovery', text:'Nami: landing a skill restores a small amount of health.'},
  {name:'Overcharge', text:'Raiden: lightning skills briefly speed up your next dash.'},
  {name:'Stone Skin', text:'Boulder: heavy hits are slower but deal extra damage.'},
  {name:'Shadow Feint', text:'Shin: shadow skills grant a short burst of evasive movement.'},
  {name:'Deep Freeze', text:'Yuki: ice skills hold enemies in place longer.'},
  {name:'Arcane Echo', text:'Vex: arcane skills create a small follow-up energy burst.'},
  {name:'Tailwind', text:'Sora: spear thrusts reach farther than any other fighter.'},
  {name:'Overgrowth', text:'Hana: snares and blooms keep enemies pinned and her healthy.'},
  {name:'Marksman', text:'Kyo: every basic attack is a ranged arrow.'},
  {name:'Bloodlust', text:'Gorou: fastest attacks in the dojo, with lifesteal skills.'},
  {name:'Temporal Lock', text:'Toki: time skills freeze enemies and rewind your wounds.'},
  {name:'Lingering Venom', text:'Kuro: poison clouds and trails keep burning foes over time.'},
  {name:'Iron Will', text:'Tetsu: guard skills briefly make you untouchable.'},
  {name:'Moonstep', text:'Rei: blink skills put you right next to your target.'},
  {name:'Echo Chamber', text:'Oto: sound skills hit twice with delayed echoes.'},
  {name:'Dragon Heart', text:'Ryu: roars and the ultimate restore your health.'},
  {name:'Divinity', text:'God: shines with holy light. Basic attacks deal 100, skills deal 500.'},
  {name:'Admin Frame', text:'Nova: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Grimm: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Volt-9: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Pyra: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Aegis: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Sera: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Titan: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Wraith: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Kage: admin build. Takes 40% less damage and slowly regenerates health.'},
  {name:'Admin Frame', text:'Pip: admin build. Takes 40% less damage and slowly regenerates health.'}
];

FIGHTER_TRAITS.push(...Array(10).fill({name:'Admin Frame',text:'Admin build.'}),{name:'Ember Core',text:'Ember: fire skills scorch the arena.'},{name:'Glacier Skin',text:'Frost: cold skills freeze foes in place.'},{name:'Gale Step',text:'Zephyr: the fastest blade in the dojo.'},{name:'Void Heart',text:'Onyx: void skills drain foes.'},{name:'Radiance',text:'Sol: holy light heals as it burns.'});
/* ---------- state ---------- */
const p={x:520,y:GROUND,vx:0,vy:0,face:1,f:0,onGround:true,jumps:0,cd:[0,0,0,0],atkCd:0,combo:0,comboT:0,lock:0,freeze:0,dash:null,dashCd:0,anim:null,hp:200,maxhp:200,inv:0};
const dummies=[
  {x:760,home:760,y:GROUND,w:46,h:84,hp:100,max:100,inf:false,name:'TRAINING DUMMY'},
  {x:980,home:980,y:GROUND,w:46,h:84,hp:100,max:100,inf:true,name:'ENDLESS DUMMY'}
];
for(const d of dummies) Object.assign(d,{vx:0,vy:0,stun:0,flash:0,total:0,best:0,hist:[],dead:false,respawn:0,kills:0,pop:0});
const H=[], P=[], parts=[], floaters=[], ghosts=[];
const cmb={n:0,dmg:0,t:0};
const Z=[];
const W={n:0,queue:[],spawnT:0,state:'idle',brk:0,kills:0,best:0};
const T={round:0,total:5,bot:null,wait:0,wins:0,done:false};
const ST={part:1,level:1,view:0,sel:1,scene:'dojo',look:'zombie',acc:'#6FE7F0',cfg:null,over:false,queue:[],base:{},stepI:0};
const TR={moved:0,jumps:0,dash:0,atk:0,combo:0,kills:0,s0:0,s1:0,s2:0,s3:0,ult:0,k_walker:0,k_runner:0,k_brute:0,k_boss:0};
try{ W.best=+localStorage.getItem('dojoBest')||0; }catch(e){}
const held={}, queue={};

/* ---------- helpers ---------- */
const ZM=()=>mode==='waves'||mode==='daily'||mode==='blitz'||mode==='boss'||(mode==='story'&&ST.cfg&&ST.cfg.type!=='duel');
const foes=()=>ZM()?Z.filter(z=>!(z.rise>0)):(mode==='tournament'||mode==='story')?(T.bot?[T.bot]:[]):dummies;
function hit(o){ if(H.length>=48) H.splice(0,H.length-36); H.push(Object.assign({age:0,hit:new Set(),nextTick:0,delay:0,life:.12,tick:0,kx:0,ky:0,stun:.25,dmg:0,fx:'slash',started:false,style:p.f},o)); }
function proj(o){ if(P.length>=24) P.splice(0,P.length-18); P.push(Object.assign({age:0,life:1,r:14,dmg:10,kx:200,ky:-120,pierce:false,hit:new Set(),stun:.25,color:'#fff',vy:0,trail:[]},o)); }
function aim(range){
  let best=null,bd=1e9;
  for(const d of foes()){ if(d.dead) continue; const dx=(d.x-p.x)*p.face; if(dx>-40&&dx<range&&Math.abs(dx)<bd){bd=Math.abs(dx);best=d;} }
  return clamp(best?best.x:p.x+p.face*range*.55,60,WW-60);
}
function autoFace(){
  if(held.left||held.right) return;
  let best=null,bd=380;
  for(const d of foes()){ if(d.dead) continue; const dist=Math.abs(d.x-p.x); if(dist<bd){bd=dist;best=d;} }
  if(best) p.face=best.x>=p.x?1:-1;
}
function dashStart(vx,t){ p.dash={t:t,vx:vx,gt:0}; p.face=vx>=0?1:-1; p.vy=0; p.vx=vx; }
function overlaps(h,d){
  const dl=d.x-d.w/2, dr=d.x+d.w/2, dt=d.y-d.h, db=d.y;
  if(h.r){ const cx=clamp(h.x,dl,dr), cy=clamp(h.y,dt,db); return (h.x-cx)*(h.x-cx)+(h.y-cy)*(h.y-cy)<=h.r*h.r; }
  return Math.abs(h.x-d.x)<=h.w/2+d.w/2 && h.y+h.h/2>=dt && h.y-h.h/2<=db;
}

/* ---------- per-fighter visual effects ---------- */
const fxs=[];
function fx(o){ if(!SET.fx&&o.type!=='ring') return; if(fxs.length>=90) fxs.shift(); fxs.push(Object.assign({t:0,life:.4,a:0,c:'#fff',x:0,y:0},o)); }
function fxRing(x,y,c,r0,r1,life,w){ fx({type:'ring',x,y,c,r0,r1,life,w:w||3}); }
function fxStreak(x,y,c,ang,len,life,w){ fx({type:'streak',x,y,c,a:ang,len,life,w:w||3}); }
function fxBolt(x1,y1,x2,y2,c,life){ const pts=[{x:x1,y:y1}]; const n=6; for(let i=1;i<n;i++){ const k=i/n; pts.push({x:x1+(x2-x1)*k+rnd(-14,14),y:y1+(y2-y1)*k+rnd(-14,14)}); } pts.push({x:x2,y:y2}); fx({type:'bolt',pts,c,life:life||.18}); }
const FC=()=>FIGHTERS[p.f].color;
// signature spark that appears where you land a hit
function hitFx(d,h,big){
  const x=d.x, y=d.y-d.h*.55, c=h.color||FC(), n=big?1.4:1;
  fxRing(x,y,c,6,big?58:36,.28,big?5:3);
  switch(p.f){
    case 0: for(let i=0;i<3;i++) fxStreak(x,y,'#fff',-.9+i*.9+rnd(-.2,.2),rnd(34,64)*n,.22,3); break;
    case 1: fx({type:'star',x,y,c,r:big?20:13,life:.35}); fxRing(x,y,c,60*n,4,.3,2); break;
    case 2: for(let i=0;i<(big?7:4);i++) fx({type:'ember',x:x+rnd(-10,10),y:y+rnd(-8,8),c:i%2?'#FFD27A':c,vx:rnd(-80,80),vy:rnd(-170,-60),r:rnd(2,4.5),life:.6}); break;
    case 3: for(let i=0;i<(big?7:4);i++) fx({type:'drop',x,y,c:i%2?'#fff':c,vx:rnd(-170,170),vy:rnd(-260,-90),r:rnd(2.5,4.5),life:.6}); break;
    case 4: for(let i=0;i<(big?3:2);i++) fxBolt(x+rnd(-8,8),y-rnd(30,60),x+rnd(-50,50),y+rnd(10,40),i?c:'#fff',.2); break;
    case 5: for(let i=0;i<(big?7:4);i++) fx({type:'shard',x,y,c:i%2?'#E8C49B':c,vx:rnd(-150,150),vy:rnd(-300,-100),r:rnd(3,6),rot:rnd(0,6),life:.7}); break;
    case 6: for(let i=0;i<3;i++) fx({type:'wisp',x:x+rnd(-12,12),y:y+rnd(-12,12),c:i?'#B7A7FF':'#2a1f50',vx:rnd(-40,40),vy:rnd(-60,-20),r:rnd(7,13),life:.5}); fxStreak(x,y,'#E4DFFF',rnd(-.3,.3),big?80:48,.2,3); break;
    case 7: for(let i=0;i<(big?5:3);i++) fx({type:'flake',x:x+rnd(-14,14),y:y+rnd(-14,14),c:i%2?'#fff':c,vx:rnd(-60,60),vy:rnd(-80,10),r:rnd(5,9),rot:rnd(0,6),life:.8}); break;
    case 8: for(let i=0;i<(big?4:2);i++) fx({type:'star',x:x+rnd(-24,24),y:y+rnd(-24,24),c:i%2?'#fff':c,r:rnd(7,13),life:.4}); break;
    case 9: for(let i=0;i<3;i++) fxStreak(x,y,i?c:'#fff',-1.2+i*1.2,rnd(40,70)*n,.2,2.5); break;
    case 10: for(let i=0;i<(big?6:3);i++) fx({type:'shard',x,y,c:i%2?'#fff':c,vx:rnd(-120,120),vy:rnd(-200,-50),r:rnd(3,5),rot:rnd(0,6),life:.7}); break;
    case 11: fx({type:'star',x,y,c:'#FFF08A',r:big?22:12,life:.3}); fxStreak(x,y,'#fff',-.8,60*n,.2,2); fxStreak(x,y,'#fff',.8,60*n,.2,2); break;
    case 12: for(let i=0;i<(big?6:3);i++) fx({type:'ember',x,y,c:i%2?'#fff':c,vx:rnd(-200,200),vy:rnd(-150,30),r:rnd(2,4),life:.4}); fxStreak(x,y,c,rnd(-.4,.4),50*n,.15,4); break;
    case 13: fxRing(x,y,c,50*n,6,.4,2); for(let i=0;i<3;i++) fx({type:'orbit',x,y,c:i%2?'#fff':c,a:i*2.1,r:28,life:.35}); break;
    default: for(let q=0;q<(big?5:3);q++) fx({type:'ember',x:x+rnd(-10,10),y:y+rnd(-8,8),c:q%2?'#fff':c,vx:rnd(-120,120),vy:rnd(-160,-40),r:rnd(2,4),life:.5}); break;
  }
}
// flash + signature on casting a skill
function castFx(i){
  const c=FC(), x=p.x, y=p.y-42;
  fxRing(x,y,c,10,70,.35,4);
  switch(p.f){
    case 0: for(let k=0;k<4;k++) fxStreak(x+p.face*20,y,k%2?c:'#fff',p.face>0?rnd(-.5,.5):Math.PI+rnd(-.5,.5),rnd(50,90),.25,3); break;
    case 1: for(let k=0;k<6;k++) fx({type:'orbit',x,y,c,a:k*1.05,r:60,life:.5}); break;
    case 2: for(let k=0;k<8;k++) fx({type:'ember',x:x+rnd(-20,20),y:y+rnd(-10,30),c:k%2?'#FFD27A':c,vx:rnd(-100,100),vy:rnd(-220,-80),r:rnd(2.5,5),life:.7}); break;
    case 3: for(let k=0;k<8;k++) fx({type:'drop',x,y,c:k%2?'#fff':c,vx:rnd(-180,180),vy:rnd(-300,-120),r:rnd(3,5),life:.7}); break;
    case 4: for(let k=0;k<3;k++) fxBolt(x+rnd(-10,10),y-70,x+rnd(-60,60),y+rnd(20,50),k?c:'#fff',.22); break;
    case 5: for(let k=0;k<8;k++) fx({type:'shard',x:p.x+rnd(-30,30),y:p.y-4,c:k%2?'#E8C49B':c,vx:rnd(-90,90),vy:rnd(-340,-160),r:rnd(3,7),rot:rnd(0,6),life:.8}); break;
    case 6: for(let k=0;k<5;k++) fx({type:'wisp',x:x+rnd(-20,20),y:y+rnd(-20,30),c:k%2?'#B7A7FF':'#2a1f50',vx:rnd(-60,60),vy:rnd(-80,-20),r:rnd(9,16),life:.6}); break;
    case 7: for(let k=0;k<7;k++) fx({type:'flake',x:x+rnd(-30,30),y:y+rnd(-30,30),c:k%2?'#fff':c,vx:rnd(-90,90),vy:rnd(-120,20),r:rnd(6,10),rot:rnd(0,6),life:.9}); break;
    case 8: for(let k=0;k<7;k++) fx({type:'star',x:x+rnd(-45,45),y:y+rnd(-45,45),c:k%2?'#fff':c,r:rnd(8,15),life:.5}); break;
    case 9: for(let k=0;k<6;k++) fxStreak(x,y,k%2?c:'#fff',k/6*TAU,rnd(60,110),.3,2.5); break;
    case 10: for(let k=0;k<8;k++) fx({type:'shard',x:x+rnd(-30,30),y:y+rnd(-20,30),c:k%2?'#fff':c,vx:rnd(-80,80),vy:rnd(-150,-40),r:rnd(3,6),rot:rnd(0,6),life:.8}); break;
    case 11: for(let k=0;k<5;k++) fx({type:'star',x:x+p.face*rnd(10,70),y:y+rnd(-20,20),c:k%2?'#FFF08A':c,r:rnd(7,12),life:.4}); break;
    case 12: for(let k=0;k<9;k++) fx({type:'ember',x:x+rnd(-20,20),y:y+rnd(-20,20),c:k%2?'#fff':c,vx:rnd(-220,220),vy:rnd(-200,40),r:rnd(2,4),life:.45}); break;
    case 13: for(let k=0;k<8;k++) fx({type:'orbit',x,y,c:k%2?'#fff':c,a:k*.785,r:50,life:.6}); break;
  }
}
function ultFxBurst(){
  const c=FC(), x=p.x, y=p.y-42;
  for(let k=0;k<3;k++) fxRing(x,y,k?'#fff':c,10,160+k*70,.55+k*.1,6-k*1.5);
  for(let k=0;k<12;k++) fxStreak(x,y,k%2?c:'#fff',k/12*TAU,rnd(90,170),.5,3);
  castFx(p.f); castFx(p.f);
}
function ambientFx(dt){
  if(!started||over||paused) return;
  const c=FC(), moving=Math.abs(p.vx)>60, r=Math.random();
  const rate=dt*60; // chance per frame at 60fps
  switch(p.f){
    case 0: if(r<.05*rate) fx({type:'streak',x:p.x+rnd(-14,14),y:p.y-rnd(15,85),c:'#fff',a:-Math.PI/2,len:rnd(10,22),life:.35,w:2}); break;
    case 1: if(r<.06*rate) fx({type:'orbit',x:p.x,y:p.y-50,c,a:rnd(0,TAU),r:rnd(40,58),life:.8}); break;
    case 2: break; // embers already ambient below
    case 3: if(r<.07*rate) fx({type:'drop',x:p.x+rnd(-14,14),y:p.y-rnd(10,80),c:'#bff3ff',vx:rnd(-10,10),vy:rnd(-50,-20),r:rnd(1.5,3),life:.8}); break;
    case 4: if(r<.05*rate) fxBolt(p.x+rnd(-18,18),p.y-rnd(20,90),p.x+rnd(-32,32),p.y-rnd(0,100),r<.02?'#fff':c,.1); break;
    case 5: if(moving&&r<.12*rate) fx({type:'shard',x:p.x-p.face*10,y:p.y-2,c:'#B89466',vx:rnd(-30,30),vy:rnd(-90,-40),r:rnd(2,4),rot:rnd(0,6),life:.4}); break;
    case 6: if(r<.1*rate) fx({type:'wisp',x:p.x+rnd(-12,12),y:p.y-rnd(5,70),c:r<.04?'#B7A7FF':'#2a1f50',vx:rnd(-12,12),vy:rnd(-40,-10),r:rnd(5,10),life:.7}); break;
    case 7: if(r<.07*rate) fx({type:'flake',x:p.x+rnd(-30,30),y:p.y-rnd(40,110),c:'#fff',vx:rnd(-12,12),vy:rnd(25,55),r:rnd(3,6),rot:rnd(0,6),life:1.1}); break;
    case 8: if(r<.06*rate) fx({type:'star',x:p.x+rnd(-30,30),y:p.y-rnd(10,100),c:r<.03?'#fff':c,r:rnd(4,8),life:.5}); break;
  }
}
function updateFxs(dt){ styleTick(dt);
  for(let i=fxs.length-1;i>=0;i--){ const q=fxs[i]; q.t+=dt; if(q.t>q.life){ fxs.splice(i,1); continue; }
    if(q.vx!==undefined){ q.x+=q.vx*dt; q.y+=q.vy*dt; if(q.type==='ember'){ q.vy-=40*dt; } else if(q.type==='flake'){ q.vx*=.98; } else { q.vy+=(q.type==='wisp'?-10:900)*dt; } if(q.rot!==undefined) q.rot+=dt*6; } }
}
function star4(x,y,r,rot){ ctx.beginPath(); for(let i=0;i<8;i++){ const a=rot+i*Math.PI/4, rr=i%2?r*.28:r; ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); } ctx.closePath(); ctx.fill(); }
function drawFxs(){
  for(const q of fxs){
    const k=q.t/q.life, al=clamp(1-k,0,1);
    ctx.globalAlpha=al; ctx.strokeStyle=q.c; ctx.fillStyle=q.c; ctx.lineCap='round';
    switch(q.type){
      case 'ring': ctx.lineWidth=q.w*(1-k)+.5; ctx.beginPath(); ctx.arc(q.x,q.y,q.r0+(q.r1-q.r0)*k,0,TAU); ctx.stroke(); break;
      case 'streak': { const L=q.len*(.4+.6*(1-k)), dx=Math.cos(q.a)*L, dy=Math.sin(q.a)*L; ctx.lineWidth=q.w*(1-k)+.5; ctx.beginPath(); ctx.moveTo(q.x-dx*.3,q.y-dy*.3); ctx.lineTo(q.x+dx,q.y+dy); ctx.stroke(); break; }
      case 'bolt': ctx.lineWidth=3*al+1; ctx.beginPath(); q.pts.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y)); ctx.stroke(); ctx.globalAlpha=al*.5; ctx.lineWidth=7; ctx.stroke(); break;
      case 'star': star4(q.x,q.y,q.r*(1-k*.4),k*2); break;
      case 'ember': ctx.beginPath(); ctx.arc(q.x,q.y,q.r*(1-k*.6),0,TAU); ctx.fill(); break;
      case 'drop': ctx.beginPath(); ctx.arc(q.x,q.y,q.r*(1-k*.5),0,TAU); ctx.fill(); break;
      case 'orbit': { const a=q.a+k*4, rr=q.r*(1-k*.3); ctx.beginPath(); ctx.arc(q.x+Math.cos(a)*rr,q.y+Math.sin(a)*rr*.45,3.2*(1-k*.5),0,TAU); ctx.fill(); break; }
      case 'shard': ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.rot); ctx.fillRect(-q.r/2,-q.r/2,q.r,q.r*.7); ctx.restore(); break;
      case 'wisp': { const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,q.r*(1+k)); g.addColorStop(0,q.c); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(q.x,q.y,q.r*(1+k),0,TAU); ctx.fill(); break; }
      case 'flake': ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.rot||0); ctx.lineWidth=1.6; ctx.beginPath(); for(let i=0;i<3;i++){ const a=i*Math.PI/3; ctx.moveTo(Math.cos(a)*q.r,Math.sin(a)*q.r); ctx.lineTo(-Math.cos(a)*q.r,-Math.sin(a)*q.r); } ctx.stroke(); ctx.restore(); break;
    }
  }
  ctx.globalAlpha=1;
}

function burst(x,y,n,color,spd,life,g){
  // Keep particle counts capped so the extra combat effects stay smooth on tablets.
  n=Math.min(n,Math.max(0,140-parts.length));
  for(let i=0;i<n;i++){ const a=rnd(0,TAU), s=rnd(.2,1)*spd; parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-spd*.2,t:0,life:life*rnd(.6,1.1),r:rnd(1.5,4),c:color,g:g||0}); }
  if(parts.length>140) parts.splice(0,parts.length-140);
}
function floater(x,y,txt,c,big,fc){ if(floaters.length>=36) floaters.splice(0,12); floaters.push({x:x+rnd(-10,10),y:y,txt:txt,c:c,big:big,fc:fc,t:0}); }

/* ---------- combat ---------- */
function damage(d,dmg,h){
  if(d.dead) return;
  if(ECON.big()) dmg=BIGSTAT;
  if(d.zombie){ dmg=Math.round(dmg*S.dmg); if(S.crit&&Math.random()<S.crit){ dmg*=2; h=Object.assign({},h,{color:'#FFD166'}); } if(S.leech) p.hp=Math.min(p.maxhp,p.hp+dmg*S.leech); }
  if(ADM.mult) dmg*=ADM.mult;
  if(ADM.one&&!d.inf&&d.hp>0) dmg=Math.max(dmg,Math.ceil(d.hp));
  if(!d.inf) d.hp=Math.max(0,d.hp-dmg);
  d.total+=dmg; d.best=Math.max(d.best,dmg); mev('damage',Math.min(dmg,1e6)); d.hist.push({t:now,v:dmg});
  d.flash=.12; d.stun=Math.max(d.stun,(h.stun||.2)*(d.sres||1));
  if(h.pin){ d.vx=0; d.vy=Math.max(d.vy,0); }
  else if(h.kx||h.ky){ const dir=h.radial?(Math.sign(d.x-h.x)||p.face):1, kb=d.kb||1; d.vx=h.kx*dir*kb; d.vy=h.ky*kb; if(d.vy<0) d.y-=1; }
  if(cmb.t<=0){ cmb.n=0; cmb.dmg=0; }
  cmb.n++; cmb.dmg+=dmg; cmb.t=1.4; mev('combo',cmb.n);
  const big=dmg>=25;
  floater(d.x,d.y-d.h-4,String(dmg),h.color||'#fff',big);
  burst(d.x,d.y-d.h*.55,big?14:7,h.color||'#fff',big?340:220,.4,500); hitFx(d,h,big);
  ult=Math.min(100,ult+dmg*.1*S.ult); styleAdd(dmg*.6);
  shake=Math.max(shake,Math.min(9,dmg/6)); if(big) hitstop=Math.max(hitstop,.05); else hitstop=Math.max(hitstop,.02);
  sfx.hit(big);
  if(!d.inf&&d.hp<=0) kill(d);
}
function roll(v){ return Math.max(1,Math.round(v*rnd(.94,1.06))); }
function kill(d){
  if(d.isBot&&mode==='story'){ d.dead=true; mev('kills',1); burst(d.x,d.y-45,34,d.color,420,.75,650); shake=Math.max(shake,12); hitstop=.1; sfx.kill(); storyEnd(true); return; }
  if(d.isBot){
    d.dead=true; T.wins++; T.wait=2.1; mev('kills',1); if(mode==='tournament') mev('tourn',1);
    burst(d.x,d.y-45,34,d.color,420,.75,650); burst(d.x,d.y-45,18,'#fff',360,.45,0);
    shake=Math.max(shake,12); hitstop=.1; sfx.kill();
    if(T.round>=T.total){ T.done=true; over=true; banner={txt:'Tournament champion!',t:2,dur:2,c:'#FFD166'}; $('#overtxt').textContent='CHAMPION! You cleared all 5 tournament rounds. Absolute legend!'; setTimeout(()=>{if(over) $('#over').hidden=false;},700); }
    else banner={txt:'Round '+T.round+' cleared',t:1.7,dur:1.7,c:'#FFD166'};
    return;
  }
  if(d.zombie){
    d.dead=true; W.kills++; mev('kills',1);
    burst(d.x,d.y-d.h*.5,d.boss?50:16,'#8FD16A',d.boss?520:300,.8,700); burst(d.x,d.y-d.h*.5,8,'#fff',300,.4,0);
    shake=Math.max(shake,d.boss?14:4); hitstop=Math.max(hitstop,d.boss?.12:.03); sfx.kill(); ult=Math.min(100,ult+(d.boss?30:2)); onZKill(d);
    return;
  }
  d.dead=true; d.respawn=1.8; d.kills++;
  burst(d.x,d.y-40,26,d.inf?'#8E6BE0':'#CDAE6A',320,.9,900); burst(d.x,d.y-40,12,'#fff',420,.5,0);
  floater(d.x,d.y-d.h-62,'DEFEATED','#FFD166',true);
  shake=Math.max(shake,10); hitstop=.09; sfx.kill();
}
function startFx(h){
  const c=h.color||'#fff', style=h.style??p.f;
  const accent=['#BFE8FF','#C9A8FF','#FF9A4D','#76E9FF','#FFE66D','#D6B18A','#A78BFA','#C9F4FF','#FF9BF2','#C9FFE6','#FFD0EC','#FFF08A','#FF9AAF','#FFF1C2'][style]||'#fff';
  // Every move now gets a character-coloured impact burst plus a distinct elemental accent.
  if(h.fx==='ring'||h.fx==='meteor'||h.fx==='crush'||h.fx==='pillar'||h.fx==='wave'||h.fx==='hole'||h.fx==='well'){
    const heavy=h.fx==='meteor'||h.fx==='crush'||h.fx==='hole';
    burst(h.x,h.y,heavy?28:16,c,heavy?470:330,.55,380);
    burst(h.x,h.y,heavy?18:10,accent,heavy?360:260,.42,240);
    if(heavy){ shake=Math.max(shake,h.fx==='meteor'?16:10); hitstop=Math.max(hitstop,.045); sfx.boom(); }
    else if(h.fx==='ring') { shake=Math.max(shake,6); sfx.boom(); }
  } else {
    burst(h.x,h.y,style===0?12:9,c,300,.32,220);
    burst(h.x+h.w*.12*(h.face||1),h.y,6,accent,260,.28,120);
    if(h.fx==='slash'||h.fx==='rise'||h.fx==='rush') sfx.swing();
  }
}
function doAttack(){
  const f=FIGHTERS[p.f];
  autoFace();
  if(p.comboT<=0) p.combo=0;
  const m=f.m1[p.combo]; const last=p.combo===f.m1.length-1;
  p.combo=(p.combo+1)%f.m1.length; p.comboT=.7; p.atkCd=m.cd;
  p.anim={type:'m1',t:0,dur:m.dur};
  p.vx+=p.face*m.step;
  if(m.proj) proj({x:p.x+p.face*30,y:p.y-52,vx:p.face*m.sp,vy:0,r:last?11:8,dmg:m.dmg,life:.5,pierce:last,kx:p.face*m.kx,ky:m.ky,stun:m.stun,color:f.color,fx:'bolt',face:p.face});
  else hit({follow:true,ox:p.face*(16+m.range*.5),oy:-42,w:m.range,h:64,delay:m.delay,life:.1,dmg:m.dmg,kx:p.face*m.kx,ky:m.ky,stun:m.stun,color:f.color,fx:'slash',face:p.face});
  if(last) p.comboT=0;
}

/* ---------- waves mode ---------- */
const ZT={
  walker:{hp:45,spd:62,dmg:8,w:36,h:80,s:1,reach:46,wind:.5,cd:1.1,skin:'#7FA37A',cloth:'#4B4A5E',eye:'#E8FF7A',sres:1,kb:1},
  runner:{hp:30,spd:150,dmg:6,w:30,h:76,s:.95,reach:42,wind:.3,cd:.8,skin:'#8FB48A',cloth:'#6A3A3A',eye:'#FF6A5A',sres:1,kb:1},
  brute:{hp:170,spd:52,dmg:18,w:52,h:118,s:1.35,reach:62,wind:.65,cd:1.4,skin:'#6F8F82',cloth:'#33283F',eye:'#FFB84D',sres:.5,kb:.6},
  boss:{hp:700,spd:58,dmg:30,w:76,h:160,s:1.85,reach:90,wind:.8,cd:1.6,skin:'#5E7A74',cloth:'#2A1F35',eye:'#FF4D4D',sres:.25,kb:.3,boss:true}
};
function spawnZombie(type,sc){
  sc=sc||{}; const t=ZT[type], hs=(sc.hs||(1+.07*(W.n-1)))*S.zhp, side=Math.random()<.5?-1:1;
  let x=p.x+side*rnd(520,760); if(x<40||x>WW-40) x=p.x-side*rnd(520,760);
  x=clamp(x,40,WW-40);
  const hp=Math.round(t.hp*hs);
  Z.push({zombie:true,type:type,boss:!!t.boss,x:x,y:GROUND,w:t.w,h:t.h,s:t.s,hp:hp,max:hp,inf:false,vx:0,vy:0,stun:0,flash:0,total:0,best:0,hist:[],dead:false,kills:0,face:1,atkT:0,atkCd:rnd(.2,.9),spd:t.spd*rnd(.9,1.12)*S.zspd*(sc.spd||1),dmg:Math.round(t.dmg*(sc.ds||(1+.04*(W.n-1)))),reach:t.reach,wind:t.wind,cd:t.cd,skin:t.skin,cloth:t.cloth,eye:t.eye,sres:t.sres,kb:t.kb,ph:rnd(0,6.28),rise:.55,look:(mode==='story'?ST.look:({daily:'wraith',blitz:'imp',boss:'titan'})[mode])||'zombie'});
  burst(x,GROUND,10,'#5a4a3a',200,.5,600);
}
function nextWave(){
  W.n++; const n=W.n, q=[]; let total=3+2*n; if(mode==='waves') mev('wave',W.n);
  if(n%5===0){ q.push('boss'); total=Math.floor(total/2); }
  const pr=n>=2?Math.min(.5,.25+.03*n):0, pb=n>=3?Math.min(.25,.08+.015*n):0;
  for(let i=0;i<total;i++){ const r=Math.random(); q.push(r<pb?'brute':r<pb+pr?'runner':'walker'); }
  W.queue=q.sort(()=>Math.random()-.5); W.state='spawn'; W.spawnT=1.3;
  banner={txt:(n%5===0?'Boss wave ':'Wave ')+n,t:1.6,dur:1.6,c:'#8FD16A'};
}
function updateWaves(dt){
  if(over) return;
  if(W.state==='break'){ W.brk-=dt; if(W.brk<=0) nextWave(); return; }
  if(W.state!=='spawn') return;
  W.spawnT-=dt;
  const cap=Math.min(18,10+Math.floor(W.n/2));
  if(W.queue.length&&Z.length<cap&&W.spawnT<=0){ spawnZombie(W.queue.pop()); W.spawnT=Math.max(.35,1.1-.05*W.n); }
  if(!W.queue.length&&Z.length===0){
    W.state='break'; W.brk=4.5; p.hp=Math.min(p.maxhp,p.hp+40); ult=Math.min(100,ult+25);
    banner={txt:'Wave '+W.n+' cleared',t:1.6,dur:1.6,c:'#FFD166'};
    if(W.n>W.best){ W.best=W.n; try{ localStorage.setItem('dojoBest',String(W.best)); }catch(e){} }
  }
}
function updateZombies(dt){
  for(let i=Z.length-1;i>=0;i--){
    const z=Z[i];
    if(z.dead){ Z.splice(i,1); continue; }
    z.flash-=dt; z.stun-=dt;
    if(z.rise>0){ z.rise-=dt; continue; }
    z.vy+=1900*dt; z.x+=z.vx*dt; z.y+=z.vy*dt;
    if(z.y>=GROUND){ z.y=GROUND; z.vy=z.vy>250?-z.vy*.25:0; z.vx*=Math.max(0,1-9*dt); }
    else z.vx*=Math.max(0,1-1.2*dt);
    z.x=clamp(z.x,30,WW-30);
    z.atkCd-=dt;
    if(z.stun>0){ z.atkT=0; continue; }
    if(z.y<GROUND-.5||over) continue;
    const dx=p.x-z.x; z.face=dx>=0?1:-1;
    if(z.atkT>0){
      z.atkT-=dt; z.vx*=.8;
      if(z.atkT<=0){
        if(Math.abs(dx)<=z.reach+18&&p.y>z.y-55) hurtPlayer(z.dmg,z.x);
        burst(z.x+z.face*z.reach*.8,z.y-20,5,z.skin,160,.25,300);
        if(z.boss){ shake=Math.max(shake,8); sfx.boom(); }
      }
    }
    else if(Math.abs(dx)>z.reach*.8){ z.x+=Math.sign(dx)*z.spd*dt; }
    else if(z.atkCd<=0){ z.atkT=z.wind; z.atkCd=z.cd+z.wind; }
  }
  for(let i=0;i<Z.length;i++) for(let j=i+1;j<Z.length;j++){
    const a=Z[i], b=Z[j]; if(a.rise>0||b.rise>0) continue;
    const dx=b.x-a.x, m=(a.w+b.w)*.42;
    if(Math.abs(dx)<m){ const push=(m-Math.abs(dx))/2*((dx>0||(dx===0&&i%2))?1:-1); a.x-=push; b.x+=push; }
  }
}
function hurtPlayer(dmg,fx){
  if(over||p.inv>0||p.dash||ADM.god) return;
  dmg=Math.max(1,Math.round(dmg*S.taken*(p.f>=20?.6:1))); p.hp=Math.max(mode==='story'&&ST.part===1?30:0,p.hp-dmg); p.inv=.6; styleHurt(); { const hf=$('#hurtfx'); if(hf){ hf.classList.add('on'); setTimeout(()=>hf.classList.remove('on'),90); } }
  p.vx+=(p.x>=fx?1:-1)*260;
  if(p.onGround&&p.freeze<=0){ p.vy=-220; p.onGround=false; }
  floater(p.x,p.y-104,'-'+dmg,'#fff',true,'#FF5A5A');
  burst(p.x,p.y-45,10,'#FF5A5A',260,.4,500);
  shake=Math.max(shake,9); hitstop=Math.max(hitstop,.04); sfx.hurt();
  if(p.hp<=0) gameOver();
}
function gameOver(win){
  if(mode==='story'){ storyEnd(false); return; }
  over=true; p.vx=0; p.anim=null; p.dash=null; held.left=held.right=held.attack=false;
  if(W.n>W.best){ W.best=W.n; try{ localStorage.setItem('dojoBest',String(W.best)); }catch(e){} }
  $('#overtxt').textContent=mode==='tournament'?'Tournament over — you won '+T.wins+' of '+T.total+' rounds. Tap rematch and try again.':'You fell on wave '+W.n+' after defeating '+W.kills+' zombies. Best wave: '+W.best+'.';
  if(mode==='tournament') $('#over').querySelector('h1').textContent='Tournament Over';
  if(mode==='daily'||mode==='blitz'||mode==='boss') endNew(win);
  setTimeout(()=>{ if(over) $('#over').hidden=false; },900);
}


/* ---------- new modes: Daily Rift, Blitz, Boss Rush ---------- */
const S={g:1,dmg:1,taken:1,cd:1,ult:1,speed:1,jumps:2,leech:0,crit:0,zspd:1,zhp:1,count:1};
function resetS(){ Object.assign(S,{g:1,dmg:1,taken:1,cd:1,ult:1,speed:1,jumps:2,leech:0,crit:0,zspd:1,zhp:1,count:1}); }
let pickOpen=false;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function dayNum(){ const d=new Date(); return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/864e5); }
const MODS=[
 {name:'Moonwalk',text:'Low gravity and a triple jump.',s:{g:.55,jumps:3}},
 {name:'Glass Cannon',text:'You deal +60% damage but take +80%.',s:{dmg:1.6,taken:1.8}},
 {name:'Swarm',text:'Many more enemies, but they are fragile.',s:{count:1.6,zhp:.65}},
 {name:'Titans',text:'Fewer, tougher, harder-hitting enemies.',s:{zhp:1.5,count:.75}},
 {name:'Haste',text:'You and the horde move faster, cooldowns are shorter.',s:{speed:1.25,zspd:1.25,cd:.8}},
 {name:'Bloodmoon',text:'You heal when you hit, enemies run faster.',s:{leech:.08,zspd:1.15}},
 {name:'Overcharge',text:'Ultimate charges 2.5x faster, skills recharge faster.',s:{ult:2.5,cd:.75}}
];
const UPS=[
 {name:'Sharpened',text:'+20% damage',fn(){S.dmg*=1.2;}},
 {name:'Quickened',text:'Cooldowns 15% shorter',fn(){S.cd*=.85;}},
 {name:'Surge',text:'Ultimate charges 50% faster',fn(){S.ult*=1.5;}},
 {name:'Vitality',text:'+40 max health and heal 40',fn(){p.maxhp+=40; p.hp=Math.min(p.maxhp,p.hp+40);}},
 {name:'Iron Skin',text:'Take 20% less damage',fn(){S.taken*=.8;}},
 {name:'Leech',text:'Heal 6% of damage dealt',fn(){S.leech+=.06;}},
 {name:'Featherstep',text:'One extra air jump',fn(){S.jumps+=1;}},
 {name:'Lucky Strike',text:'15% chance to crit for double damage',fn(){S.crit+=.15;}},
 {name:'Fleet',text:'Move 12% faster',fn(){S.speed*=1.12;}}
];
const D={seed:0,mod:MODS[0],round:0,total:5,queue:[],state:'idle',spawnT:0,score:0,boons:[],t0:0,saved:false};
const B={t:60,score:0,kills:0,streak:0,chainT:0,mult:1,spawnT:0,el:0,best:0,gameT:0};
const BR={i:0,names:['Gravedigger','Ghoul King','Plague Titan','Hollow Warlord','The Last Dead'],hs:[1,1.5,2.1,2.8,3.8],ds:[1,1.2,1.4,1.65,1.9],sp:[1,1.05,1.12,1.2,1.3],state:'idle',wait:0,won:0,done:false};
const DS=lsGet('dojoDaily')||{best:0,streak:0,last:-9,clears:0,day:-1,dayBest:0};
B.best=+(lsGet('dojoBlitz')||0);
function dailyInit(){
  D.seed=(dayNum()*2654435761)>>>0;
  D.mod=MODS[(D.seed>>>11)%MODS.length];
  const el=$('#dailyDesc'); if(el){
    const st=(DS.last===dayNum()||DS.last===dayNum()-1)?DS.streak:0;
    el.textContent="Today's twist: "+D.mod.name+" — "+D.mod.text+(st?' · Streak '+st+' day'+(st>1?'s':''):'')+(DS.best?' · Best '+fmt(DS.best):'');
  }
  const bz=$('#blitzDesc'); if(bz&&B.best) bz.textContent='60 seconds. Every kill adds time. Chain kills for a huge score. Best '+fmt(B.best);
}
function startDaily(){
  dailyInit(); resetS(); Object.assign(S,D.mod.s);
  D.round=0; D.state='idle'; D.score=0; D.boons=[]; D.queue=[]; D.saved=false; D.t0=now;
  banner={txt:D.mod.name,t:2,dur:2,c:'#C79BFF'}; setTimeout(()=>{ if(mode==='daily'&&!over) nextRound(); },1300);
}
function dailyQueue(r){
  const rng=mulberry32(D.seed+r*7919), q=[]; let n=Math.round((5+r*2)*S.count);
  if(r===D.total){ q.push('boss'); n=Math.round(n*.5); }
  const pb=r>=2?Math.min(.35,.1+.05*r):0, pr=Math.min(.45,.15+.06*r);
  for(let i=0;i<n;i++){ const x=rng(); q.push(x<pb?'brute':x<pb+pr?'runner':'walker'); }
  for(let i=q.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [q[i],q[j]]=[q[j],q[i]]; }
  return q;
}
function nextRound(){
  D.round++; D.queue=dailyQueue(D.round); D.state='spawn'; D.spawnT=1; D.roundT=now;
  banner={txt:(D.round===D.total?'Final rift':'Rift '+D.round),t:1.6,dur:1.6,c:'#C79BFF'};
}
function updateDaily(dt){
  if(over||D.state!=='spawn') return;
  D.spawnT-=dt;
  if(D.queue.length&&Z.length<12&&D.spawnT<=0){
    const t=D.queue.pop(), r=D.round;
    spawnZombie(t,{hs:1+.14*(r-1),ds:1+.1*(r-1)}); D.spawnT=Math.max(.35,1.1-.1*r);
  }
  if(!D.queue.length&&Z.length===0){
    const bonus=Math.max(0,Math.round(600-(now-D.roundT)*8));
    D.score+=500*D.round+bonus;
    p.hp=Math.min(p.maxhp,p.hp+p.maxhp*.25); ult=Math.min(100,ult+25);
    if(D.round>=D.total){ D.score+=2000; D.state='done'; gameOver(true); return; }
    D.state='clear'; banner={txt:'Rift '+D.round+' cleared +'+(500*D.round+bonus),t:1.4,dur:1.4,c:'#FFD166'};
    setTimeout(()=>{ if(mode==='daily'&&!over) openPick(); },1100);
  }
}
function openPick(){
  const rng=mulberry32(D.seed*31+D.round*131), pool=UPS.slice(), offer=[];
  for(let i=0;i<3&&pool.length;i++) offer.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);
  const box=$('#pickcards'); box.innerHTML='';
  $('#picktag').textContent='Rift '+D.round+' cleared';
  offer.forEach((u,i)=>{
    const b=document.createElement('button'); b.type='button'; b.className='mode-card'; b.style.setProperty('--c','#C79BFF');
    b.innerHTML='<strong>'+u.name+'</strong><span>'+u.text+'</span>';
    b.addEventListener('click',()=>{ u.fn(); D.boons.push(u.name); closePick(); });
    box.appendChild(b);
  });
  pickOpen=true; $('#pick').hidden=false; for(const k in held) held[k]=false; for(const k in queue) delete queue[k];
}
function closePick(){ pickOpen=false; $('#pick').hidden=true; for(const k in held) held[k]=false; for(const k in queue) delete queue[k]; nextRound(); }
function rankFor(sc){ return sc>=9000?'S':sc>=7000?'A':sc>=5000?'B':sc>=3000?'C':'D'; }
/* Blitz */
function startBlitz(){
  Object.assign(B,{t:60,score:0,kills:0,streak:0,chainT:0,mult:1,spawnT:.8,el:0});
  banner={txt:'GO!',t:1,dur:1,c:'#FFD166'};
}
function updateBlitz(dt){
  if(over) return;
  B.t-=dt; B.el+=dt; B.chainT-=dt; B.spawnT-=dt;
  if(B.chainT<=0){ B.streak=0; B.mult=1; }
  const lvl=B.el/12, cap=Math.min(14,6+Math.floor(lvl*1.5));
  if(B.spawnT<=0&&Z.length<cap){
    const r=Math.random(), pb=Math.min(.22,lvl*.04), pr=Math.min(.5,.2+lvl*.06);
    spawnZombie(r<pb?'brute':r<pb+pr?'runner':'walker',{hs:1+lvl*.05,ds:1+lvl*.03}); B.spawnT=Math.max(.3,.85-lvl*.07);
  }
  if(B.t<=0){ B.t=0; gameOver(true); }
}
function onZKill(d){
  if(mode==='story') storyKill(d);
  if(mode==='blitz'&&!over){
    B.kills++; B.streak++; B.chainT=2.2; B.mult=Math.min(5,1+Math.floor(B.streak/4)*.5);
    const pts=Math.round((d.type==='brute'?40:d.type==='runner'?15:10)*B.mult); B.score+=pts; mev('blitz',B.score);
    B.t+=d.type==='brute'?4:2; p.hp=Math.min(p.maxhp,p.hp+2);
    floater(d.x,d.y-d.h-24,'+'+pts,'#FFD166',false);
  }
  if(mode==='daily'&&!over) D.score+=({walker:10,runner:15,brute:40,boss:300})[d.type]||10;
}
/* Boss Rush */
function startBoss(){ BR.i=0; BR.won=0; BR.done=false; BR.state='wait'; BR.wait=1.6; banner={txt:'Boss Rush',t:1.5,dur:1.5,c:'#FF6A5A'}; }
function updateBoss(dt){
  if(over) return;
  if(BR.state==='wait'){
    BR.wait-=dt; if(BR.wait>0) return;
    const i=BR.i;
    spawnZombie('boss',{hs:BR.hs[i],ds:BR.ds[i],spd:BR.sp[i]});
    for(let k=0;k<Math.max(0,i-1);k++) spawnZombie('brute',{hs:1+i*.3,ds:1+i*.15});
    banner={txt:BR.names[i],t:1.8,dur:1.8,c:'#FF6A5A'}; BR.state='fight';
  } else if(BR.state==='fight'&&!Z.length){
    BR.won++; mev('bosses',1);
    if(BR.i>=BR.names.length-1){ BR.done=true; BR.state='done'; gameOver(true); return; }
    BR.i++; BR.state='wait'; BR.wait=3.5; p.hp=Math.min(p.maxhp,p.hp+p.maxhp*.35); ult=Math.min(100,ult+40);
    banner={txt:'Boss down!',t:1.5,dur:1.5,c:'#FFD166'};
  }
}
function endNew(win){
  const h=$('#over').querySelector('h1'), tx=$('#overtxt');
  if(mode==='daily'){
    const dn=dayNum(); let line='';
    if(win){ mev('daily',1); if(DS.last!==dn){ DS.streak=(DS.last===dn-1)?DS.streak+1:1; DS.last=dn; DS.clears++; } }
    DS.best=Math.max(DS.best,D.score); lsSet('dojoDaily',DS);
    h.textContent=win?'Rift cleared!':'Rift collapsed';
    tx.textContent=(win?'You cleared all 5 rifts. ':'You fell in rift '+D.round+' of 5. ')+'Score '+fmt(D.score)+' · Rank '+rankFor(D.score)+' · Streak '+(DS.last===dn||DS.last===dn-1?DS.streak:0)+' day(s) · Best '+fmt(DS.best)+'. Come back tomorrow for a new twist!';
    dailyInit();
  } else if(mode==='blitz'){
    const nb=B.score>B.best; if(nb){ B.best=B.score; lsSet('dojoBlitz',B.best); }
    h.textContent=win?"Time's up!":'Knocked out';
    tx.textContent='Score '+fmt(B.score)+' · '+B.kills+' kills'+(nb?' · NEW BEST!':' · Best '+fmt(B.best))+'.';
    dailyInit();
  } else {
    if(win){ const br=lsGet('dojoBossRec')||{clears:0}; br.clears=(br.clears||0)+1; lsSet('dojoBossRec',br); }
    h.textContent=win?'All bosses felled!':'Boss Rush over';
    tx.textContent=win?'You defeated all 5 bosses. Legendary!':'You fell to '+BR.names[BR.i]+' (boss '+(BR.i+1)+' of 5). Bosses felled: '+BR.won+'.';
  }
}
dailyInit();

/* ===== FIGHTER SELECT SHOWCASE ===== */
const FS=[
'Duelist|7,9,6,4,7|2|Piercing slash wave that cuts through lines|Launch upward with a rising slash|Dash forward, slashing all in the way|Slam the ground for a shockwave|A flurry of cuts on every nearby foe',
'Controller|5,5,8,5,9|4|Pull enemies in toward you|Blast enemies away from you|Plant a well that drags foes inward|Slam down a crushing gravity field|Collapse space into a black hole',
'Brawler|9,6,5,4,6|2|Hurl a fast fireball|Erupt a column of flame|Dash forward trailing fire|Spray a wide arc of flames|Call a meteor down on the arena',
'Sustain|5,7,7,7,6|2|Fire a quick jet of water|Surge forward on a wave|Spin up a whirlpool to trap foes|Detonate water around you|Bring a crushing tidal wave down',
'Rushdown|7,9,6,3,8|3|Fire a crackling spark|Flash-step through enemies|Trap foes in a cage of lightning|Release a burst of static|Call a sky-splitting lightning strike',
'Tank|9,3,5,10,4|1|Hurl a heavy boulder|Crack the earth in a line|Harden up to shrug off blows|Raise pillars from the ground|Split the world open under your foes',
'Assassin|8,8,4,3,9|5|Throw a dart of shadow|Slip through shadow to reposition|Pin foes with binding shadows|Leave a shadow clone that strikes|Vanish, then execute foes in a blink',
'Trapper|6,5,8,6,8|3|Shoot a piercing ice lance|Slide ahead on a trail of ice|Freeze the ground to snare enemies|Burst a ring of ice shards|Freeze everything around you solid',
'Zoner|8,5,9,3,9|4|Fire a bolt of arcane energy|Rush forward in a rune blaze|Plant a sigil that detonates|Unleash a storm of raw mana|Detonate a star-bright arcane blast',
'Lancer|6,8,10,4,6|3|Dash-thrust that pierces a line|Spin a vacuum that drags foes in|Launch yourself and foes skyward|Three wind walls that blow foes away|Seven tornado pillars sweep the arena',
'Binder|5,5,7,6,8|3|Fan of three exploding seeds|Thorns that pin enemies in place|Heal yourself and burst petals|Lash a vine that yanks foes to you|A petal storm that drags and blooms',
'Archer|6,6,10,3,7|4|A fast, piercing light arrow|Three arrows in a spread|A light sigil that burns the ground|Backflip away while shooting|Ten pillars of light rain down',
'Berserker|9,8,3,5,4|2|Claw swipe that heals you|Pounce and slam where you land|A roar that stuns all nearby|Eight rapid claw hits while dashing|A frenzy of claws and a crushing finish',
'Chrono|6,5,6,5,10|5|Slow shard that freezes foes in time|Rewind to where you were, restoring health|A field that holds foes frozen|Three delayed echo slashes|Stop time, then detonate it all',
'Poisoner|6,6,6,4,8|3|Pierce foes with a toxic dart|Leave a lingering poison cloud|Dash and leave a venom trail|Three expanding fang rings|A giant plague bloom that detonates',
'Guardian|8,3,4,10,5|2|A crushing iron punch|Bash forward and stun|Pull foes into your grip|Guard up to heal and shrug off hits|Become an unstoppable iron colossus',
'Teleporter|6,8,6,4,9|4|Hurl a slow piercing moon disc|Blink to a foe and slash|Trap foes under an eclipse|Five stars fall in a line|Blot out the sun and stun everyone',
'Support|5,7,7,5,8|3|Two sound waves back to back|Shake the ground with two rings|Plant a resonance that bursts|Slide forward with triple pulses|Four booming echoes and a huge finale',
'Brawler|8,7,5,6,6|3|A flame punch plus a fire shot|Soar up with a rising kick|Dash and ignite the ground|Roar to heal and blast foes|A dragon fire storm and a heavy meteor',
'Divine|10,10,9,6,5|1|A 500-damage piercing light wave|Dash through foes for 500|Five pillars of heaven for 500|A huge ring of judgment for 500|Three giant rings and a 999 finale',
'Cosmic|8,7,8,5,7|3|Three exploding stars in a spread|Dash forward as a comet|Meteors rain across the field|A huge cosmic ring blast|The universe detonates',
'Reaper|9,7,7,5,7|3|Piercing soul wave|Dash through foes and heal|A well that drags foes into the reaper|Five pillars of death|Rings of death and a crushing finale',
'Cyber|7,9,9,5,8|4|Five rapid piercing lasers|Overclock forward through foes|Stunning pulse around you|One huge laser column from orbit|Rings of static and a system-wide crash',
'Inferno|9,7,6,5,7|2|A big exploding fireball|Rise in a pillar of phoenix flame|Five pillars of fire in a line|A huge eruption around you|Rings of fire and a solar flare',
'Paladin|8,6,7,9,6|2|A piercing holy wave|Charge forward and heal|A healing ring that stuns|A huge beam of judgment|Rings of light and a heavenly finale',
'Tempest|7,8,9,5,8|4|Two piercing gale slashes|A cyclone that drags foes in|Launch foes skyward|Fire rains from the storm|A hurricane tears the arena apart',
'Titan|10,5,6,10,4|1|A heavy exploding rocket fist|Boost forward and slam down|A huge stomp that stuns|A missile barrage on a wide area|Rings of power and a giant finale',
'Phantom|7,9,7,5,9|4|A piercing phantom bolt|Dash through foes as a ghost|A field that drains foes|A stunning wail around you|Rings of souls and a possessing blast',
'Ninja|7,10,6,4,10|5|A fan of five shuriken|Slash through foes in a flash|A smoke bomb that stuns|Ten rapid blade strikes|Darkness falls and a thousand edges cut',
'Trickster|7,8,8,5,10|5|A bouncing explosive bomb|Teleport ahead with a boom|A seven-way confetti burst|Three delayed boxes burst up|Rings of confetti and a grand finale',
'Brawler|8,7,6,4,7|2|Ranged signature strike|Gap-closing move|Area control skill|Heavy burst skill|Ultimate: rings and a finishing blast',
'Controller|6,6,7,5,9|3|Ranged signature strike|Gap-closing move|Area control skill|Heavy burst skill|Ultimate: rings and a finishing blast',
'Ninja|7,10,5,4,10|5|Ranged signature strike|Gap-closing move|Area control skill|Heavy burst skill|Ultimate: rings and a finishing blast',
'Brawler|9,5,7,5,6|4|Ranged signature strike|Gap-closing move|Area control skill|Heavy burst skill|Ultimate: rings and a finishing blast',
'Paladin|8,6,7,5,7|3|Ranged signature strike|Gap-closing move|Area control skill|Heavy burst skill|Ultimate: rings and a finishing blast'];
function renderShowcase(){
  syncRoster();
  const i=chosen,f=FIGHTERS[i],a=FS[i].split('|'),st=a[1].split(',').map(Number),tr=FIGHTER_TRAITS[i],sc=$('#fsStage');
  sc.style.setProperty('--k',f.color);
  $('#fsImg').src='./portraits/fighter-'+(i+1)+'.svg?v=6';
  $('#fsNum').textContent='0'+(i+1); $('#fsName').textContent=f.name.toUpperCase(); $('#fsTag').textContent=f.tag+' · '+a[0];
  $('#fsBlurb').textContent=f.blurb;
  $('#fsDiff').textContent='Difficulty '+'★'.repeat(+a[2])+'☆'.repeat(5-a[2]);
  $('#fsCombo').textContent=f.m1.length+'-hit combo · '+f.m1.reduce((t,m)=>t+m.dmg,0)+' dmg';
  const big=ECON.big();
  $('#fsBars').innerHTML=['Power','Speed','Reach','Defense','Technique'].map((n,j)=>'<div class="fb"><span>'+n+'</span><i><u style="width:'+(big?100:st[j]*10)+'%"></u></i><b'+(big?' style="font-size:9px;width:auto"':'')+'>'+(big?'MAX':st[j])+'</b></div>').join('')+(big?'<div style="grid-column:1/-1;font-size:11px;letter-spacing:.06em;color:#FFE98A">ALL STATS '+BIGSTAT+'</div>':'');
  $('#fsPass').innerHTML='<small>PASSIVE</small><b>'+tr.name+'</b> '+tr.text.split(': ')[1];
  $('#fsSk').innerHTML=f.skills.map((k,j)=>'<li style="--n:'+j+'"><kbd>'+(j+1)+'</kbd><b>'+k.name+'</b><em>'+k.cd+'s</em><span>'+a[3+j]+'</span></li>').join('')+'<li class="u" style="--n:4"><kbd>5</kbd><b>'+f.ult.name+'</b><em>ULT</em><span>'+a[7]+'</span></li>';
  const c=$('#continueMode'); const ok=owns(i); c.textContent=ok?'SELECT '+f.name.toUpperCase()+' →':'🔒 UNLOCK IN SHOP · '+ECON.priceOf(i).toLocaleString('en-US')+' COINS'; c.style.setProperty('--k',f.color);
  $('#modeWelcomeText').textContent='You chose '+f.name+'. Pick your game mode.';
  sc.classList.remove('swap'); void sc.offsetWidth; sc.classList.add('swap');
}
$('#fsPrev').addEventListener('click',()=>stepFighter(-1));
$('#fsNext').addEventListener('click',()=>stepFighter(1));
$('#fsRand').addEventListener('click',()=>{ const l=navList().filter(x=>x!==chosen); setFighter(l[Math.floor(Math.random()*l.length)]); ac(); });
addEventListener('keydown',e=>{ if($('#characterScreen').hidden||started) return; if(e.code==='ArrowLeft') stepFighter(-1); else if(e.code==='ArrowRight') stepFighter(1); else if(e.code==='Enter') $('#continueMode').click(); });
(function(){ const st=$('#fsStage'); let x0=null;
  st.addEventListener('pointerdown',e=>{ x0=e.clientX; });
  st.addEventListener('pointerup',e=>{ if(x0!==null&&Math.abs(e.clientX-x0)>60) stepFighter(e.clientX<x0?1:-1); x0=null; });
  st.addEventListener('pointermove',e=>{ const r=$('.fs-port').getBoundingClientRect(); st.style.setProperty('--ry',((e.clientX-r.left)/r.width-.5)*10+'deg'); st.style.setProperty('--rx',(-((e.clientY-r.top)/r.height-.5))*8+'deg'); });
})();

/* ===== STORY MODE: 30 parts x 10 levels (part 1 = tutorial) ===== */
let GODOK=false;
const NF=()=>19;
const SP=lsGet('dojoStory')||{d:{}}; if(!SP.d) SP.d={};
const SCN={dojo:['#080B20','#17254A','#4C3976','#D9F7FF','rgba(90,211,255,.18)','#111A38','#1A2142','#6FE7F0'],bamboo:['#06140f','#0f3a2a','#3f8a52','#E7FFD0','rgba(120,255,160,.2)','#0a2a1c','#12422d','#7dff9a'],spires:['#120404','#3d0e0a','#B8361A','#FF7A3D','rgba(255,90,40,.3)','#1c0707','#2b0d0a','#FF6A3D'],dunes:['#2a0f0a','#7a3418','#e0903a','#FFE2A0','rgba(255,170,80,.28)','#4a1f10','#5c2a14','#FFB070'],city:['#1b0526','#5c1a55','#FF7A3D','#FFD166','rgba(255,120,60,.3)','#2a0a38','#3a0f45','#FF79D1'],frost:['#07122a','#1d4a7a','#9fd0f0','#F2FBFF','rgba(170,230,255,.28)','#14335a','#1d4670','#9FE8FF'],sea:['#021a2e','#06456b','#1aa0b8','#CFFAFF','rgba(60,220,240,.25)','#06304a','#0a4560','#45C9FF'],sky:['#1a1040','#4a3a9a','#f0a0c0','#FFF3B0','rgba(255,230,120,.28)','#2a2060','#3a3080','#FFE66D'],void:['#05020f','#1a0a3a','#4a1a7a','#B38BFF','rgba(179,139,255,.3)','#0e0522','#1a0a40','#B38BFF'],rift:['#0a0522','#2b1460','#7a38c8','#EBD3FF','rgba(190,130,255,.28)','#1b0f45','#2a1760','#C79BFF']};
const PD=[
'Dojo Basics|dojo|zombie|Master Ito|Master Ito leads you through the training grounds. Learn to move, strike, cast and finish.',
'Awakening Rift|rift|wraith|The Rift Warden|A tear opens in the sky and wraiths pour into the valley. Seal it.',
'Whispering Bamboo|bamboo|zombie|Bamboo Reaper|Something stalks the groves at night. The villagers beg for help.',
'Ashen Village|spires|zombie|Cinder Brute|The village burned, yet its dead still walk. Who lit the fire?',
'Crimson Dunes|dunes|imp|Sand Sovereign|Across the desert runs the trail of the Hollow Order.',
'Neon Backstreets|city|imp|Chrome Oni|The city glows, but imps haunt the alleys. Follow the cult money.',
'Frostbound Pass|frost|wraith|Rime Queen|Snow buries the mountain road, and the cold itself hunts you.',
'Sunken Temple|sea|zombie|Tide Colossus|Beneath the waves a drowned temple guards the first seal.',
'Thunder Peaks|sky|imp|Storm Roc|Lightning dances on the summits where the second seal sleeps.',
'The Hollow Gate|void|titan|Gatekeeper Null|The Order opens a gate to the Hollow. Step through or the world falls.',
'Echo Canyon|dunes|zombie|Canyon Howler|Voices of the fallen echo through the red stone. Some answer back.',
'Lantern Harbor|sea|imp|Harbor Kraken|The harbor lanterns flicker out one by one. Light them again.',
'Mirror Palace|rift|wraith|The Hollow Queen|Every mirror shows an enemy. Break the right one.',
'Iron Foundry|spires|titan|Forge Tyrant|The Order forges weapons from cursed iron. Shut it down.',
'Moonlit Cemetery|dojo|zombie|The Midnight King|Halfway to the truth, the dead kneel before a king.',
'Glass Desert|dunes|wraith|Mirage Lord|Heat shimmers and the sand turns to glass. Nothing here is real.',
'Sky Citadel|sky|imp|Cloud Warden|A fortress drifts above the storms, holding the third seal.',
'Verdant Maze|bamboo|zombie|Thorn Matriarch|The forest has grown teeth. Find the way through.',
'Blizzard Keep|frost|titan|Frost Emperor|A frozen keep hides the Order\'s war council.',
'Neon Underworld|city|wraith|Oni Emperor|Beneath the city, the cult\'s true leaders wait.',
'Drowned Armada|sea|zombie|Admiral Deepwake|A ghost fleet rises from the deep to claim the coast.',
'Obsidian Fields|spires|imp|Magma Fiend|The earth cracks and rivers of fire cut off every road.',
'Starfall Plateau|sky|wraith|Comet Sage|Stars fall on the plateau, and each carries a shadow.',
'Phantom Library|rift|wraith|The Archivist|Forbidden pages hold the Order\'s final ritual.',
'Bone Coliseum|dojo|titan|Arena Colossus|The Order stages a tournament of the dead. You are the entry.',
'Crystal Abyss|void|imp|Prism Wraith|Shards of the broken seals glitter in the dark.',
'Scorched Heavens|spires|titan|Sun Devourer|The sky burns. The Order is eating the sun.',
'Eclipse Dojo|void|wraith|Shadow Master|Your own dojo, twisted by the eclipse. Reclaim it.',
'The Final Rift|rift|titan|Rift Sovereign|Every gate converges. One last tear remains.',
'Dojo Zero|void|titan|The Zero King|Every path leads here. Face the Zero King and end the Hollow Order.'];
const TUT=[
['First Steps','steps',[['Move with A / D or the left stick','moved',350],['Jump with Space or JUMP. Tap again in the air to double jump','jumps',3],['Dash with Q or DASH','dash',2]]],
['Strike','steps',[['Attack with Click or ATTACK','atk',4],['Keep tapping Attack to chain a 4-hit combo','combo',4,['walker'],{hs:4}]]],
['First Blood','steps',[['Defeat 3 walkers','kills',3,['walker','walker','walker']]]],
['Skills I','steps',[['Use Skill 1 (key 1)','s0',1,['walker']],['Use Skill 2 (key 2)','s1',1,['walker']]]],
['Skills II','steps',[['Use Skill 3 (key 3)','s2',1,['walker']],['Use Skill 4 (key 4)','s3',1,['walker']]]],
['Ultimate','steps',[['Your ultimate is charged! Press 5 / ULTIMATE','ult',1,['walker','walker','walker','walker'],{ult:1}]]],
['Know Your Enemy','steps',[['Runners are fast but fragile. Defeat 3','k_runner',3,['runner','runner','runner']]]],
['Heavy Foes','steps',[['Brutes hit hard. Dash away, then strike. Defeat it','k_brute',1,['brute'],{hs:.6}]]],
['Sparring','duel'],['Final Exam','boss']];
const TYPES={clear:['⚔','Defeat every enemy'],survive:['⏱','Survive the onslaught'],duel:['🥋','Duel a rival fighter'],boss:['☠','Defeat the boss'],steps:['✎','Guided training']};
const sD=(P,L)=>SP.d[P+'-'+L]||0;
const partOpen=P=>P===1||sD(P-1,10)>0;
const lvlOpen=(P,L)=>L>1?sD(P,L-1)>0:partOpen(P);
const partStars=P=>{let t=0;for(let l=1;l<=10;l++)t+=sD(P,l);return t;};
const partsCleared=()=>{let n=0;for(let q=1;q<=30;q++) if(sD(q,10)>0) n++;return n;};
const rival=(P,L)=>(p.f+1+((P*3+L)%(NF()-1)))%NF();
function lvl(P,L){
  const pd=PD[P-1].split('|'), d=(P-2)*10+L;
  if(P===1){ const t=TUT[L-1]; return {type:t[1],title:t[0],steps:t[2]||[],d:0,hs:.6,ds:.3,boss:pd[3],queue:t[1]==='boss'?['boss']:[],cap:3}; }
  const type=['clear','clear','survive','duel','clear','clear','survive','duel','clear','boss'][L-1];
  const c={type,d,hs:1+d*.03,ds:1+d*.012,boss:pd[3],queue:[]}, rng=mulberry32(P*131+L*17);
  c.title=type==='boss'?pd[3]:['Outer Gate','Ambush','Hold the Line','Rival Duel','Surge','Iron Wall','Last Stand','Rival Rematch','Gauntlet'][L-1];
  if(L===5) c.mod=MODS[(P*3)%MODS.length];
  if(type==='survive'){ c.time=30+Math.min(40,Math.round(d/6)); c.rate=Math.max(.45,1.2-d*.003); c.cap=Math.min(14,5+Math.floor(d/25)); }
  if(type==='clear'||type==='boss'){
    const n=Math.min(40,5+Math.round(L*.9+d/9)), pr=Math.min(.5,.12+d*.002+L*.02), pb=Math.min(.3,d*.001+(L>5?.1:0)), q=[];
    for(let i=0;i<n;i++){ const x=rng(); q.push(x<pb?'brute':x<pb+pr?'runner':'walker'); }
    if(type==='boss'){ q.length=Math.round(n*.5); q.push('boss'); }
    c.queue=q; c.cap=Math.min(12,6+Math.floor(d/30));
  }
  return c;
}
function mkBot(idx,d,soft){
  const f=FIGHTERS[idx], hp=Math.round((220+d*5)*(soft?.55:1)), r=Math.max(1,Math.min(8,Math.round(1+d/38)));
  return {isBot:true,name:f.name,fighterIndex:idx,color:f.color,dark:f.dark,hair:f.hair,x:clamp(p.x+300,80,WW-80),y:GROUND,w:44,h:82,vx:0,vy:0,face:-1,hp,max:hp,dead:false,inf:false,total:0,best:0,hist:[],stun:0,flash:0,inv:0,atkT:0,atkCd:1,skillCd:3.6,ultCd:13,speed:105+Math.min(60,d*.25),damage:Math.max(4,Math.round(Math.min(FIGHTERS[p.f].m1[2].dmg,22)*.62*(soft?.5:1+d*.006))),range:64+r*2,round:r};
}
function trackIn(dt){
  TR.moved+=Math.abs(p.vx)*dt; if(queue.jump) TR.jumps++; if(queue.dash&&p.dashCd<=0) TR.dash++;
  if((queue.attack||held.attack)&&p.atkCd<=0) TR.atk++;
  for(let i=0;i<4;i++) if(queue['s'+(i+1)]&&p.cd[i]<=0&&p.lock<=0) TR['s'+i]++;
  if(queue.ult&&ult>=100&&p.lock<=0) TR.ult++;
}
function storyKill(d){ TR.kills++; TR['k_'+d.type]=(TR['k_'+d.type]||0)+1; }
const stepVal=s=>s[1]==='combo'?TR.combo:TR[s[1]]-(ST.base[s[1]]||0);
function nextStep(){
  const c=ST.cfg; ST.stepI++;
  if(ST.stepI>=c.steps.length){ storyEnd(true); return; }
  const s=c.steps[ST.stepI], o=s[4]||{}; ST.base=Object.assign({},TR); TR.combo=0; if(o.ult) ult=100;
  for(const t of (s[3]||[])) spawnZombie(t,{hs:o.hs||.6,ds:.3,spd:.7});
}
function storyBegin(){
  const P=ST.part,L=ST.level,c=ST.cfg=lvl(P,L),pd=PD[P-1].split('|'),sc=SCN[pd[1]];
  ST.scene=pd[1]; ST.look=pd[2]; ST.acc=sc[7]; ST.over=false; ST.t=c.time||0; ST.queue=(c.queue||[]).slice(); ST.spawnT=1.2; ST.stepI=-1; ST.res=null;
  NP.story={pal:{top:sc[0],mid:sc[1],low:sc[2],moon:sc[3],glow:sc[4],ridge:sc[5],pagoda:sc[6]},arena:{floor:sc[0],line:sc[7],trim:sc[1],light:sc[4],pillar:sc[5],cap:sc[7]},mote:sc[7],spd:8};
  for(const k in TR) TR[k]=0;
  const cl=partsCleared(); if(c.mod) Object.assign(S,c.mod.s); S.dmg*=1+.03*cl; S.leech=Math.max(S.leech,.03); p.maxhp=200+6*cl; p.hp=p.maxhp; ult=P===1?0:40;
  banner={txt:c.title,t:1.8,dur:1.8,c:sc[7]};
  if(c.type==='duel'){ T.round=0; T.total=99; T.done=false; T.bot=mkBot(rival(P,L),c.d,P===1); p.x=clamp(T.bot.x-300,60,WW-60); }
  if(c.type==='steps') nextStep();
}
function updateStory(dt){
  const c=ST.cfg; if(!c||over||ST.over||pickOpen) return;
  TR.combo=Math.max(TR.combo,cmb.t>0?cmb.n:0);
  if(c.type==='steps'){ const s=c.steps[ST.stepI]; if(s&&stepVal(s)>=s[2]){ banner={txt:'Nice!',t:.8,dur:.8,c:ST.acc}; sfx.kill(); nextStep(); } return; }
  if(c.type==='duel') return;
  ST.spawnT-=dt;
  if(c.type==='survive'){
    ST.t-=dt;
    if(ST.spawnT<=0&&Z.length<c.cap){ const r=Math.random(); spawnZombie(r<.12?'brute':r<.4?'runner':'walker',{hs:c.hs,ds:c.ds}); ST.spawnT=c.rate; }
    if(ST.t<=0){ ST.t=0; storyEnd(true); }
  } else {
    if(ST.queue.length&&Z.length<c.cap&&ST.spawnT<=0){
      const t=ST.queue.pop(); spawnZombie(t,t==='boss'?{hs:c.hs*1.4,ds:c.ds*1.2}:{hs:c.hs,ds:c.ds});
      if(t==='boss') banner={txt:c.boss,t:1.8,dur:1.8,c:'#FF6A5A'};
      ST.spawnT=Math.max(.35,1.1-c.d*.003);
    }
    if(!ST.queue.length&&!Z.length&&ST.spawnT<=0) storyEnd(true);
  }
}
function storyHud(){
  const c=ST.cfg; if(!c) return; let h='';
  $('#hptxt').textContent='Health '+Math.ceil(p.hp)+' / '+p.maxhp;
  if(c.type==='steps'){ const s=c.steps[ST.stepI]; if(s) h=s[0]+(s[2]>1?'  ('+Math.min(s[2],Math.floor(stepVal(s)))+'/'+s[2]+')':''); }
  else if(c.type==='survive') h='Survive: '+Math.ceil(ST.t)+'s';
  else if(c.type==='duel') h=T.bot?'Defeat '+T.bot.name+' · '+Math.ceil(Math.max(0,T.bot.hp))+' HP':'';
  else { const b=Z.find(z=>z.boss); h=b?c.boss+' · '+Math.ceil(b.hp)+' HP':'Enemies left: '+(Z.length+ST.queue.length); }
  $('#storyHint').textContent=h;
  $('#endless').innerHTML='Part '+ST.part+' · Level '+ST.level+'<br>'+c.title+(c.mod?'<br>Twist: '+c.mod.name:'');
  $('#broken').textContent='Kills '+TR.kills;
}
function storyEnd(win){
  if(ST.over) return; ST.over=true;
  held.left=held.right=held.attack=false; p.vx=0; p.dash=null;
  let stars=0;
  if(win){ mev('story',1); const fr=p.hp/p.maxhp; stars=ST.part===1?3:fr>=.6?3:fr>=.3?2:1; const k=ST.part+'-'+ST.level; if(stars>(SP.d[k]||0)){ SP.d[k]=stars; lsSet('dojoStory',SP); } Z.length=0; banner={txt:'Level clear!',t:1.6,dur:1.6,c:'#FFD166'}; }
  else { over=true; p.anim=null; }
  ST.res={win,stars}; setTimeout(showResult,win?1300:900);
}
function showResult(){
  if(!ST.over||!started||mode!=='story'||!ST.res) return;
  const r=ST.res,P=ST.part,L=ST.level,last=P===30&&L===10;
  $('#srTitle').textContent=r.win?(L===10?'PART '+P+' CLEARED':'VICTORY'):'DEFEATED';
  $('#srStars').textContent=r.win?'★'.repeat(r.stars)+'☆'.repeat(3-r.stars):'';
  $('#srTxt').textContent=r.win?(L===10?(last?'You ended the Hollow Order. Dojo Zero is yours, legend.':'Part '+(P+1)+' unlocked: '+PD[P].split('|')[0]+'. Reward: +6 max HP and +3% damage in every level.'):'Finish with more health for more stars. Up next: Level '+(L+1)+'.'):'Retry, or return to the map and switch fighters.';
  $('#srNext').hidden=!(r.win&&!last);
  $('#storyResult').hidden=false;
}
function exScene(kd){
  const P=NP.story.pal,a=ST.acc;
  if(kd==='dojo'){ for(const px of [260,820,1380,1900]) pagoda(px,GROUND-24,.8,P.pagoda); }
  else if(kd==='bamboo'){ for(let i=0;i<18;i++){ const x=40+i*110,h=170+((i*53)%120); ctx.fillStyle=P.pagoda; ctx.fillRect(x,GROUND-24-h,8,h+24); ctx.fillStyle=a; ctx.globalAlpha=.4; for(let y=GROUND-60;y>GROUND-24-h;y-=46) ctx.fillRect(x-2,y,12,3); ctx.globalAlpha=1; } }
  else if(kd==='frost'){ ctx.fillStyle='rgba(210,235,255,.5)'; for(let i=0;i<9;i++){ const x=80+i*230,h=150+((i*61)%110); ctx.beginPath(); ctx.moveTo(x-80,GROUND-24); ctx.lineTo(x,GROUND-24-h); ctx.lineTo(x+80,GROUND-24); ctx.fill(); } }
  else if(kd==='dunes'){ ctx.fillStyle=P.pagoda; for(let i=0;i<8;i++){ ctx.beginPath(); ctx.ellipse(100+i*260,GROUND-20,190,60+((i*37)%50),0,Math.PI,TAU); ctx.fill(); } }
  else if(kd==='sea'){ ctx.fillStyle=P.pagoda; for(let i=0;i<10;i++){ const x=60+i*200,h=120+((i*43)%100); ctx.fillRect(x,GROUND-24-h,26,h+24); ctx.fillRect(x-8,GROUND-24-h,42,8); }
    ctx.strokeStyle=a; ctx.globalAlpha=.35; ctx.lineWidth=2; for(let r=0;r<3;r++){ ctx.beginPath(); for(let x=0;x<=1900;x+=30){ const y=GROUND-70-r*26+Math.sin(x*.02+now*1.6+r)*7; if(x) ctx.lineTo(x,y); else ctx.moveTo(x,y); } ctx.stroke(); } ctx.globalAlpha=1; }
  else if(kd==='sky'){ for(let i=0;i<9;i++){ const x=100+i*230,y=GROUND-150-((i*47)%90)+Math.sin(now*.6+i)*8; ctx.fillStyle='rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x,y,70,16,0,0,TAU); ctx.ellipse(x+30,y-10,40,14,0,0,TAU); ctx.fill(); ctx.fillStyle=P.pagoda; ctx.beginPath(); ctx.moveTo(x-40,y+40); ctx.lineTo(x+40,y+40); ctx.lineTo(x,y+90); ctx.fill(); } }
  else { ctx.strokeStyle=a; ctx.lineWidth=2; for(let i=0;i<12;i++){ ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(80+i*170,GROUND-120-((i*59)%130)+Math.sin(now+i)*12,16+i%3*8,0,TAU); ctx.stroke(); } ctx.globalAlpha=1; }
}
/* story map UI */
function firstOpen(P){ for(let l=1;l<=10;l++) if(lvlOpen(P,l)&&!sD(P,l)) return l; return 10; }
function openStory(){ ST.view=0; $('#storyScreen').hidden=false; renderStory(); }
function renderStory(){
  let tot=0; for(let q=1;q<=30;q++) tot+=partStars(q);
  $('#stTot').textContent='★ '+tot+' / 900';
  const v=ST.view; let h='';
  if(!v){
    $('#stTitle').textContent='STORY MODE';
    h='<div class="sp-grid">';
    for(let q=1;q<=30;q++){ const pd=PD[q-1].split('|'),open=partOpen(q),t=partStars(q);
      h+='<button class="sp" data-p="'+q+'"'+(open?'':' disabled')+' style="--k:'+SCN[pd[1]][7]+'"><i>'+(q<10?'0':'')+q+'</i><b>'+pd[0]+'</b><small>'+(open?(q===1?'Tutorial · ':'')+t+'/30 ★':'🔒 Locked')+'</small><u><s style="width:'+(t/30*100)+'%"></s></u></button>'; }
    h+='</div>';
  } else {
    const pd=PD[v-1].split('|'),L=ST.sel,c=lvl(v,L),ty=TYPES[c.type];
    $('#stTitle').textContent='PART '+v+' · '+pd[0].toUpperCase();
    h='<div style="--k:'+SCN[pd[1]][7]+'"><p class="sl-bl">'+pd[4]+'</p><div class="sl-grid">';
    for(let l=1;l<=10;l++){ const o=lvlOpen(v,l),t=lvl(v,l).type,n=sD(v,l);
      h+='<button class="sl" data-l="'+l+'"'+(o?'':' disabled')+' aria-pressed="'+(l===L)+'"><span>'+(o?TYPES[t][0]:'🔒')+'</span><b>'+l+'</b><small>'+(n?'★'.repeat(n)+'☆'.repeat(3-n):'')+'</small></button>'; }
    let obj=ty[1];
    if(c.type==='clear'||c.type==='boss') obj=c.type==='boss'?'Defeat '+c.boss+' and their minions':'Defeat all '+c.queue.length+' enemies';
    else if(c.type==='survive') obj='Survive '+c.time+' seconds';
    else if(c.type==='duel') obj='Defeat rival '+FIGHTERS[rival(v,L)].name;
    else if(c.type==='steps') obj='Follow the prompts ('+c.steps.length+' step'+(c.steps.length>1?'s':'')+')';
    h+='</div><div class="sl-br"><small>LEVEL '+L+' · '+ty[0]+' '+c.type.toUpperCase()+'</small><h3>'+c.title+'</h3><p>'+obj+(c.mod?'<br>Twist: '+c.mod.name+' — '+c.mod.text:'')+'</p><button class="sbtn" data-go="1">▶ START</button></div></div>';
  }
  $('#storyBody').innerHTML=h;
}
$('#storyBody').addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t||menuTransitionBusy) return; ac();
  if(t.dataset.p){ ST.view=+t.dataset.p; ST.sel=firstOpen(ST.view); renderStory(); }
  else if(t.dataset.l){ ST.sel=+t.dataset.l; renderStory(); }
  else if(t.dataset.go){ ST.part=ST.view; ST.level=ST.sel; cinematicTransition(()=>{ $('#storyScreen').hidden=true; started=true; setMode('story'); }); }
});
$('#stBack').addEventListener('click',()=>{ if(ST.view){ ST.view=0; renderStory(); } else { $('#storyScreen').hidden=true; $('#modeScreen').hidden=false; } });
$('#srNext').addEventListener('click',()=>{ if(ST.level<10) ST.level++; else { ST.part++; ST.level=1; } setMode('story'); });
$('#srRetry').addEventListener('click',()=>setMode('story'));
$('#srMap').addEventListener('click',()=>{ $('#storyResult').hidden=true; resetAll(); started=false; ST.view=ST.part; ST.sel=Math.min(10,ST.level+(ST.res&&ST.res.win&&ST.level<10?1:0)); openStory(); ST.view=ST.part; renderStory(); });
$('#pauseStory').addEventListener('click',()=>{ setPaused(false); resetAll(); started=false; ST.view=ST.part; ST.sel=ST.level; $('#storyScreen').hidden=false; renderStory(); });


/* ===== v2 overhaul: settings, records, title art, style meter ===== */
const SET=Object.assign({shake:true,fx:true},lsGet('dojoSet')||{});
function saveSet(){ lsSet('dojoSet',SET); }
(function titleArt(){
  const cv=document.getElementById('titleBg'); if(!cv) return; const c=cv.getContext('2d'); let w=0,h=0,t=0;
  const pts=Array.from({length:70},(_,i)=>({x:Math.random(),y:Math.random(),s:Math.random()*.6+.2,p:Math.random()*6,k:i%3}));
  function rs(){ const r=cv.getBoundingClientRect(); w=cv.width=Math.max(2,r.width|0); h=cv.height=Math.max(2,r.height|0); }
  addEventListener('resize',rs); rs();
  function loop(){
    requestAnimationFrame(loop);
    const intro=document.getElementById('intro'); if(!intro||intro.hidden) return;
    if(!w) rs(); t+=.016; c.clearRect(0,0,w,h);
    // moon
    const mx=w*.78, my=h*.3, mr=Math.min(w,h)*.16, mg=c.createRadialGradient(mx,my,mr*.4,mx,my,mr*3);
    mg.addColorStop(0,'rgba(190,170,255,.45)'); mg.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=mg; c.fillRect(0,0,w,h);
    c.fillStyle='#f3eaff'; c.beginPath(); c.arc(mx,my,mr,0,6.283); c.fill();
    c.fillStyle='rgba(120,100,190,.25)'; c.beginPath(); c.arc(mx-mr*.25,my-mr*.15,mr*.2,0,6.283); c.arc(mx+mr*.3,my+mr*.25,mr*.12,0,6.283); c.fill();
    // ridges
    for(let L=0;L<3;L++){ c.fillStyle=['#1a1240','#120b32','#0b0722'][L]; c.beginPath(); c.moveTo(0,h); for(let x=0;x<=w+20;x+=20) c.lineTo(x,h*(.62+L*.07)-Math.abs(Math.sin(x*.006+L*2+t*.02))*h*.12-Math.sin(x*.017+L)*h*.03); c.lineTo(w,h); c.fill(); }
    // petals + stars
    for(const p of pts){
      if(p.k===0){ c.fillStyle='rgba(255,255,255,'+(.3+.4*Math.sin(t*2+p.p))+')'; c.fillRect(p.x*w,p.y*h*.6,1.6,1.6); }
      else { p.y+=p.s*.0016; p.x+=Math.sin(t+p.p)*.0004-.0003; if(p.y>1){p.y=-.02;p.x=Math.random();} if(p.x<-.02)p.x=1.02;
        c.save(); c.translate(p.x*w,p.y*h); c.rotate(t*p.s+p.p); c.fillStyle=p.k===1?'rgba(255,150,200,.75)':'rgba(140,235,255,.7)'; c.beginPath(); c.ellipse(0,0,5*p.s+2,2.4*p.s+1,0,0,6.283); c.fill(); c.restore(); }
    }
  }
  loop();
})();
function modal(title,html){ $('#mtitle').textContent=title; $('#mbody').innerHTML=html; $('#modal').hidden=false; }
$('#mclose').addEventListener('click',()=>{ $('#modal').hidden=true; });
$('#btnHow').addEventListener('click',()=>modal('How to play',
 '<div class="row"><span>Move</span><b>A / D or left stick</b></div><div class="row"><span>Jump / double jump</span><b>Space / Jump button</b></div><div class="row"><span>Attack combo</span><b>Click / J / Attack</b></div><div class="row"><span>Skills</span><b>1 2 3 4</b></div><div class="row"><span>Ultimate</span><b>5 / F</b></div><div class="row"><span>Dash</span><b>Q / Dash</b></div><div class="row"><span>Pause</span><b>P / Esc</b></div><p>Land hits to build your <b style="color:#ffd166">STYLE</b> rank from D up to SSS. Getting hit knocks it down. Every ultimate plays a cut-in.</p><p><b style="color:#C79BFF">Daily Rift</b> changes every day, <b style="color:#FFD166">Blitz</b> rewards chains, and <b style="color:#FF6A5A">Boss Rush</b> is five bosses in a row.</p>'));
function recRow(a,b){ return '<div class="row"><span>'+a+'</span><b>'+b+'</b></div>'; }
$('#btnRec').addEventListener('click',()=>{
  const d=lsGet('dojoDaily')||{}, br=lsGet('dojoBossRec')||{}, st=lsGet('dojoStyle')||0;
  modal('Records', recRow('Best wave (Waves)',+(localStorage.getItem('dojoBest')||0))+recRow('Blitz best score',fmt(+(lsGet('dojoBlitz')||0)))+recRow('Daily Rift best',fmt(d.best||0))+recRow('Daily Rift clears',d.clears||0)+recRow('Daily streak',d.streak||0)+recRow('Boss Rush clears',br.clears||0)+recRow('Best style rank',STYLE_R[Math.max(0,Math.min(STYLE_R.length-1,st))].n));
});
function setBody(){ return '<div class="row"><span>Screen shake</span><button class="tg '+(SET.shake?'on':'')+'" data-s="shake">'+(SET.shake?'ON':'OFF')+'</button></div><div class="row"><span>Extra effects</span><button class="tg '+(SET.fx?'on':'')+'" data-s="fx">'+(SET.fx?'ON':'OFF')+'</button></div><div class="row"><span>Reset records</span><button class="tg" data-s="wipe">RESET</button></div>'; }
$('#btnSet').addEventListener('click',()=>modal('Settings',setBody()));
$('#mbody').addEventListener('click',e=>{
  const b=e.target.closest('.tg'); if(!b) return; const k=b.dataset.s;
  if(k==='wipe'){ if(confirm('Reset all records?')){ ['dojoBest','dojoBlitz','dojoDaily','dojoBossRec','dojoStyle'].forEach(x=>{try{localStorage.removeItem(x);}catch(_){}}); } return; }
  SET[k]=!SET[k]; saveSet(); $('#mbody').innerHTML=setBody();
});
function ttlBest(){ const d=lsGet('dojoDaily')||{}; const el=$('#ttlBest'); if(el) el.textContent=(d.streak?('🔥 Daily streak '+d.streak+'  '):'')+(+(lsGet('dojoBlitz')||0)?'Blitz best '+fmt(+lsGet('dojoBlitz')):''); }
ttlBest();
/* style meter */
const STYLE_R=[{n:'D',t:0,c:'#9aa3c7'},{n:'C',t:30,c:'#6FE7F0'},{n:'B',t:80,c:'#7dff9a'},{n:'A',t:160,c:'#ffd166'},{n:'S',t:280,c:'#ff9a4d'},{n:'SS',t:440,c:'#ff5fb8'},{n:'SSS',t:650,c:'#ffffff'}];
const STY={pts:0,idle:0,rank:0,best:lsGet('dojoStyle')||0};
function styleAdd(v){ STY.pts=Math.min(900,STY.pts+v); STY.idle=1.6; }
function styleHurt(){ STY.pts*=.55; }
function styleTick(dt){
  STY.idle-=dt; if(STY.idle<=0) STY.pts=Math.max(0,STY.pts-(14+STY.rank*8)*dt);
  let r=0; for(let i=0;i<STYLE_R.length;i++) if(STY.pts>=STYLE_R[i].t) r=i;
  const el=$('#stylemeter');
  if(!el) return;
  const show=STY.pts>4&&started&&!over; el.hidden=!show; if(!show){ STY.rank=0; return; }
  if(r!==STY.rank){ if(r>STY.rank){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if(r>STY.best){ STY.best=r; lsSet('dojoStyle',r); } } STY.rank=r; }
  const R=STYLE_R[r], nx=STYLE_R[r+1], f=nx?(STY.pts-R.t)/(nx.t-R.t):1;
  el.style.setProperty('--sc',R.c); $('#styl').textContent=R.n; $('#styf').style.width=(clamp(f,0,1)*100)+'%';
}

/* ---------- update ---------- */
/* ---------- admin fighters (20-29): data-driven kits ---------- */
const ADMK=[
 [{t:'proj',dmg:140,n:3,sp:760,fx:'bolt',r:16,ex:90},{t:'dash',dmg:170,dist:1700},{t:'rain',dmg:130,n:7,fx:'meteor',r:95},{t:'ring',dmg:230,r:240}],
 [{t:'proj',dmg:180,sp:820,fx:'wave',r:22,pierce:1},{t:'dash',dmg:160,dist:1500,heal:20},{t:'pull',dmg:45,r:170,life:1.6},{t:'pillars',dmg:160,n:5,gap:80,h:280}],
 [{t:'proj',dmg:75,n:5,sp:1000,fx:'bolt',r:11,pierce:1,spread:.1},{t:'dash',dmg:150,dist:1900},{t:'ring',dmg:210,r:280,stun:1.1},{t:'pillars',dmg:280,n:1,w:140,h:340,reach:500}],
 [{t:'proj',dmg:160,sp:700,fx:'bolt',r:20,ex:120},{t:'rise',dmg:180},{t:'pillars',dmg:65,n:5,gap:100,h:300,w:90},{t:'ring',dmg:260,r:270}],
 [{t:'proj',dmg:150,sp:900,fx:'wave',r:20,pierce:1},{t:'dash',dmg:170,dist:1300,heal:30},{t:'ring',dmg:150,r:230,heal:40,stun:.8},{t:'pillars',dmg:300,n:1,w:150,h:360,reach:420}],
 [{t:'proj',dmg:130,n:2,sp:800,fx:'wave',r:20,pierce:1,spread:.2},{t:'pull',dmg:40,r:180,life:1.8},{t:'rise',dmg:150},{t:'rain',dmg:115,n:8,fx:'fire',r:80}],
 [{t:'proj',dmg:240,sp:600,fx:'bolt',r:26,ex:140},{t:'leap',dmg:270},{t:'ring',dmg:260,r:260,stun:1},{t:'rain',dmg:150,n:6,fx:'meteor',r:100}],
 [{t:'proj',dmg:150,sp:760,fx:'bolt',r:16,pierce:1},{t:'dash',dmg:140,dist:2000},{t:'pull',dmg:50,r:160,life:1.5,heal:25},{t:'ring',dmg:220,r:260,stun:1.2}],
 [{t:'proj',dmg:85,n:5,sp:900,fx:'slash',r:12,spread:.12},{t:'dash',dmg:140,dist:1900},{t:'ring',dmg:170,r:220,stun:1.3},{t:'multi',dmg:55,n:10}],
 [{t:'proj',dmg:150,sp:640,fx:'bolt',r:18,ex:110},{t:'blink',dmg:160,dist:420},{t:'proj',dmg:65,n:7,sp:620,fx:'bolt',r:10,spread:.16},{t:'pillars',dmg:190,n:3,gap:110,h:260}]
];
const ADMU=[
 {rings:3,dmg:420,final:1600,fx:'meteor',rain:'meteor'},{rings:3,dmg:440,final:1600,fx:'hole'},{rings:4,dmg:380,final:1500,fx:'ring'},{rings:3,dmg:420,final:1700,fx:'meteor',rain:'fire'},{rings:3,dmg:400,final:1500,fx:'ring'},
 {rings:3,dmg:420,final:1600,fx:'hole',rain:'fire'},{rings:4,dmg:450,final:1800,fx:'meteor'},{rings:3,dmg:430,final:1600,fx:'hole'},{rings:3,dmg:400,final:1600,fx:'ring',rain:'meteor'},{rings:4,dmg:380,final:1500,fx:'ring',rain:'fire'}
];
ADMK.push([{"t": "proj", "dmg": 150, "fx": "wave", "pierce": 1, "sp": 880, "r": 20},{"t": "dash", "dmg": 140, "dist": 1500},{"t": "rain", "dmg": 120, "n": 6, "fx": "fire", "r": 85},{"t": "ring", "dmg": 210, "r": 250, "stun": 1}],[{"t": "proj", "dmg": 120, "n": 3, "fx": "bolt", "sp": 820, "r": 14},{"t": "pull", "dmg": 45, "r": 170, "life": 1.6},{"t": "pillars", "dmg": 150, "n": 4, "gap": 90, "h": 280},{"t": "ring", "dmg": 200, "r": 260, "stun": 1.4}],[{"t": "proj", "dmg": 70, "n": 5, "fx": "slash", "sp": 980, "r": 11, "spread": 0.12},{"t": "dash", "dmg": 130, "dist": 2000},{"t": "blink", "dmg": 150, "dist": 420},{"t": "multi", "dmg": 50, "n": 10}],[{"t": "proj", "dmg": 170, "fx": "bolt", "sp": 700, "r": 22, "ex": 110},{"t": "leap", "dmg": 240},{"t": "pull", "dmg": 50, "r": 180, "life": 1.5, "heal": 20},{"t": "rain", "dmg": 140, "n": 5, "fx": "meteor", "r": 95}],[{"t": "proj", "dmg": 150, "fx": "wave", "sp": 900, "r": 20, "pierce": 1},{"t": "rise", "dmg": 170},{"t": "ring", "dmg": 170, "r": 240, "heal": 35, "stun": 0.8},{"t": "pillars", "dmg": 260, "n": 1, "w": 150, "h": 360, "reach": 420}]); ADMU.push({rings:3,dmg:400,final:1600,fx:'meteor',rain:'fire'},{rings:3,dmg:410,final:1600,fx:'ring'},{rings:3,dmg:420,final:1600,fx:'hole',rain:'fire'},{rings:3,dmg:430,final:1600,fx:'hole'},{rings:3,dmg:440,final:1600,fx:'ring',rain:'fire'});
function adminSkill(fi,i){
  const s=ADMK[fi-20][i], c=FIGHTERS[fi].color, d=p.face, px=p.x, py=p.y;
  const heal=v=>{ if(v) p.hp=Math.min(p.maxhp,p.hp+v); };
  switch(s.t){
    case 'proj': { const n=s.n||1; for(let k=0;k<n;k++){ const a=(k-(n-1)/2)*(s.spread||.14); proj(Object.assign({x:px+d*30,y:py-44,vx:d*Math.cos(a)*s.sp,vy:Math.sin(a)*s.sp,r:s.r||16,dmg:s.dmg,life:s.life||1,pierce:!!s.pierce,kx:d*260,ky:-160,stun:.4,color:c,fx:s.fx||'bolt',face:d},s.ex?{explode:{r:s.ex,dmg:Math.round(s.dmg/2),kx:260,ky:-200}}:{})); } break; }
    case 'dash': dashStart(d*s.dist,.2); hit({follow:true,ox:d*50,oy:-38,w:130,h:84,delay:0,life:.24,dmg:s.dmg,kx:d*340,ky:-200,stun:.5,color:c,fx:'rush',face:d}); heal(s.heal); break;
    case 'pillars': { const n=s.n||3, tx=aim(s.reach||420); for(let k=0;k<n;k++){ const o=(k-(n-1)/2)*(s.gap||90); hit({x:clamp(tx+o,50,WW-50),y:GROUND-(s.h||260)/2,w:s.w||70,h:s.h||260,delay:.25+Math.abs(k-(n-1)/2)*.1,life:.16,dmg:s.dmg,kx:o*.8,ky:-420,stun:.5,color:c,fx:'pillar'}); } break; }
    case 'ring': hit({follow:true,ox:0,oy:-42,r:s.r,delay:.12,life:.12,dmg:s.dmg,kx:480,ky:-320,stun:s.stun||.6,radial:true,color:c,fx:'ring'}); heal(s.heal); break;
    case 'rise': p.vy=-520; p.onGround=false; p.jumps=1; hit({follow:true,ox:d*35,oy:-72,w:100,h:160,delay:.04,life:.2,dmg:s.dmg,kx:d*80,ky:-620,stun:.7,color:c,fx:'rise',face:d}); break;
    case 'pull': { const tx=aim(s.reach||300); hit({x:tx,y:py-40,r:s.r||140,delay:.2,life:s.life||1.4,tick:.2,dmg:s.dmg,pull:2200,pullX:tx,kx:0,ky:0,stun:.4,color:c,fx:'well'}); heal(s.heal); break; }
    case 'rain': { const tx=aim(s.reach||380), n=s.n||6; for(let k=0;k<n;k++) hit({x:clamp(tx+(k-(n-1)/2)*75,50,WW-50),y:GROUND-30,r:s.r||90,delay:.25+k*.1,life:.12,dmg:s.dmg,kx:0,ky:-380,stun:.5,radial:true,color:c,fx:s.fx||'meteor',face:d}); break; }
    case 'leap': p.vy=-480; p.vx+=d*500; p.onGround=false; hit({x:clamp(px+d*260,50,WW-50),y:GROUND-30,r:150,delay:.45,life:.14,dmg:s.dmg,kx:480,ky:-380,stun:.7,radial:true,color:c,fx:'ring'}); break;
    case 'multi': for(let n=0;n<(s.n||6);n++) hit({follow:true,ox:d*72,oy:-42,w:130,h:90,delay:n*.08,life:.05,dmg:s.dmg,kx:d*50,ky:-30,stun:.15,color:c,fx:'slash',face:d}); hit({follow:true,ox:d*82,oy:-42,w:150,h:100,delay:(s.n||6)*.08+.05,life:.1,dmg:s.dmg*3,kx:d*560,ky:-320,stun:.6,color:'#fff',fx:'rise',face:d}); break;
    case 'blink': { ghosts.push({x:px,y:py,face:d,t:.4}); p.x=clamp(px+d*s.dist,60,WW-60); p.vx=0; hit({x:p.x,y:py-40,r:130,delay:.05,life:.12,dmg:s.dmg,kx:360,ky:-260,stun:.5,radial:true,color:c,fx:'ring'}); break; }
  }
}
function admUlt(fi){
  const u=ADMU[fi-20], c=FIGHTERS[fi].color, d=p.face;
  for(let n=0;n<u.rings;n++) hit({follow:true,ox:0,oy:-45,r:260+n*55,delay:.3+n*.28,life:.12,dmg:u.dmg,kx:600,ky:-420,stun:.9,radial:true,color:c,fx:'ring'});
  if(u.rain) for(let k=0;k<7;k++) hit({x:clamp(p.x+d*(80+k*110),50,WW-50),y:GROUND-30,r:110,delay:.4+k*.12,life:.12,dmg:Math.round(u.dmg*.8),kx:0,ky:-420,stun:.6,radial:true,color:c,fx:u.rain,face:d});
  hit({follow:true,ox:0,oy:-45,r:540,delay:1.4,life:.15,dmg:u.final,kx:800,ky:-600,stun:1.3,radial:true,color:'#fff',fx:u.fx});
}
function castDistinctSkill(fi, i){
  const f=FIGHTERS[fi], d=p.face, c=f.color, px=p.x, py=p.y;
  const tx=aim(500);
  // Every fighter has a different set of mechanics, not just different VFX.
  switch(fi){
    case 0: // Kaito — precision swordplay
      if(i===0){proj({x:px+d*34,y:py-42,vx:d*820,vy:0,r:13,dmg:24,life:.8,pierce:true,kx:d*280,ky:-100,stun:.3,color:c,fx:'slash',face:d});}
      if(i===1){p.vy=-480;p.onGround=false;p.jumps=1;hit({follow:true,ox:d*35,oy:-72,w:76,h:150,delay:.04,life:.18,dmg:30,kx:d*90,ky:-600,stun:.65,color:c,fx:'rise',face:d});}
      if(i===2){dashStart(d*1650,.22);for(let n=0;n<3;n++)hit({follow:true,ox:d*(35+n*18),oy:-38,w:82,h:72,delay:n*.075,life:.06,dmg:12,kx:d*120,ky:-80,stun:.18,color:c,fx:'slash',face:d});}
      if(i===3){for(let n=0;n<6;n++)hit({follow:true,ox:d*72,oy:-42,w:118,h:86,delay:n*.09,life:.045,dmg:8,kx:d*45,ky:-25,stun:.12,color:c,fx:'slash',face:d});hit({follow:true,ox:d*82,oy:-42,w:145,h:100,delay:.58,life:.1,dmg:30,kx:d*560,ky:-320,stun:.6,color:'#fff',fx:'rise',face:d});} break;
    case 1: // Mira — displacement and control
      if(i===0)hit({x:px+d*145,y:py-45,w:300,h:115,delay:.08,life:.28,dmg:12,pull:4200,pullX:px+d*25,stun:.5,color:c,fx:'pull',face:d});
      if(i===1)hit({follow:true,ox:0,oy:-48,r:175,delay:.12,life:.12,dmg:25,kx:720,ky:-230,stun:.45,radial:true,color:c,fx:'ring'});
      if(i===2)hit({x:tx,y:GROUND-45,r:125,delay:.25,life:2.3,tick:.22,dmg:7,pull:2600,pullX:tx,kx:0,ky:-30,stun:.2,color:c,fx:'well'});
      if(i===3){hit({x:tx,y:GROUND-145,w:110,h:290,delay:.45,life:.15,dmg:42,pin:true,stun:1,color:c,fx:'crush'});hit({x:tx,y:GROUND-285,w:160,h:90,delay:.48,life:.12,dmg:12,ky:180,stun:.25,color:'#fff',fx:'ring'});} break;
    case 2: // Ren — burn zones and projectile spread
      if(i===0)proj({x:px+d*30,y:py-42,vx:d*610,vy:-30,r:18,dmg:23,life:1.15,kx:d*220,ky:-150,stun:.35,color:c,fx:'bolt',face:d,explode:{r:105,dmg:14,kx:260,ky:-220}});
      if(i===1)hit({x:tx,y:GROUND-140,w:105,h:280,delay:.35,life:.95,tick:.14,dmg:8,kx:0,ky:-170,stun:.25,color:c,fx:'pillar'});
      if(i===2){dashStart(d*1450,.17);hit({follow:true,ox:d*42,oy:-38,w:120,h:80,delay:0,life:.2,dmg:24,kx:d*310,ky:-210,stun:.4,color:c,fx:'fire',face:d});hit({x:px-d*30,y:py-25,r:65,delay:.03,life:.18,dmg:8,kx:-d*130,ky:-60,color:c,fx:'fire'});}
      if(i===3)for(let n=-2;n<=2;n++){let a=n*.24;proj({x:px+d*28,y:py-42,vx:d*Math.cos(a)*560,vy:Math.sin(a)*560,r:12,dmg:13,life:.9,kx:d*130,ky:-90,stun:.25,color:c,fx:'bolt',face:d});} break;
    case 3: // Nami — fluid movement, healing, wave control
      if(i===0)proj({x:px+d*25,y:py-45,vx:d*720,vy:0,r:13,dmg:20,life:1.1,kx:d*180,ky:-90,stun:.25,color:c,fx:'bolt',face:d});
      if(i===1){proj({x:px+d*45,y:py-45,vx:d*470,vy:0,r:34,dmg:26,life:.75,pierce:true,kx:d*180,ky:-160,stun:.45,color:c,fx:'wave',face:d});p.vx+=d*220;}
      if(i===2)hit({x:tx,y:GROUND-35,w:210,h:70,delay:.2,life:1.5,tick:.22,dmg:8,pull:1550,pullX:tx,kx:0,ky:-60,stun:.25,color:c,fx:'well'});
      if(i===3){p.hp=Math.min(p.maxhp,p.hp+22);p.vx-=d*120;hit({follow:true,ox:0,oy:-42,r:160,delay:.08,life:.15,dmg:26,kx:380,ky:-280,stun:.4,radial:true,color:c,fx:'ring'});burst(px,py-40,16,c,220,.5,180);} break;
    case 4: // Raiden — blink, vertical lightning, chained strikes
      if(i===0)proj({x:px+d*22,y:py-48,vx:d*1050,vy:0,r:8,dmg:18,life:.85,pierce:true,kx:d*160,ky:-60,stun:.2,color:c,fx:'bolt',face:d});
      if(i===1){p.x=clamp(px+d*185,35,WW-35);p.inv=Math.max(p.inv,.18);hit({follow:true,ox:d*25,oy:-42,w:95,h:100,delay:.03,life:.1,dmg:31,kx:d*430,ky:-240,stun:.42,color:c,fx:'slash',face:d});ghosts.push({x:px,y:py,face:-d,t:.25});}
      if(i===2){for(let n=-1;n<=1;n++)hit({x:clamp(tx+n*72,45,WW-45),y:GROUND-125,w:42,h:250,delay:.22+Math.abs(n)*.12,life:.16,tick:.08,dmg:11,kx:n*150,ky:-240,stun:.3,color:c,fx:'pillar'});}
      if(i===3){for(let n=0;n<4;n++)hit({x:clamp(tx+(n-1.5)*55,45,WW-45),y:GROUND-55,w:60,h:110,delay:n*.13,life:.08,dmg:13,kx:(n%2?1:-1)*220,ky:-170,stun:.25,color:c,fx:'bolt'});sfx.cast();} break;
    case 5: // Boulder — armor and terrain attacks
      if(i===0)proj({x:px+d*32,y:py-55,vx:d*470,vy:-330,r:25,dmg:28,life:1.3,kx:d*320,ky:-260,stun:.45,color:c,fx:'rock',face:d,explode:{r:85,dmg:12,kx:300,ky:-220}});
      if(i===1)for(let n=0;n<5;n++)hit({x:clamp(px+d*(70+n*72),35,WW-35),y:GROUND-20,w:72,h:40,delay:n*.09,life:.15,dmg:13,kx:d*240,ky:-210,stun:.3,color:c,fx:'ring'});
      if(i===2){p.inv=Math.max(p.inv,.65);p.hp=Math.min(p.maxhp,p.hp+8);hit({follow:true,ox:0,oy:-35,r:100,delay:.05,life:.18,dmg:14,kx:0,ky:-80,stun:.25,radial:true,color:c,fx:'ring'});}
      if(i===3)for(let n=0;n<3;n++)hit({x:clamp(tx+(n-1)*90,45,WW-45),y:GROUND-100,w:76,h:200,delay:.25+n*.18,life:.16,dmg:24,kx:(n-1)*180,ky:-360,stun:.5,color:c,fx:'pillar'}); break;
    case 6: // Shin — misdirection and restraints
      if(i===0)proj({x:px+d*25,y:py-45,vx:d*760,vy:-35,r:11,dmg:19,life:1.15,pierce:true,kx:d*120,ky:-80,stun:.3,color:c,fx:'bolt',face:d});
      if(i===1){let target=null,bd=520;for(const e of foes()){if(e.dead)continue;let dist=Math.abs(e.x-px);if(dist<bd){bd=dist;target=e;}}if(target){p.x=clamp(target.x-d*58,35,WW-35);p.inv=Math.max(p.inv,.28);hit({x:target.x,y:target.y-target.h*.55,w:95,h:110,delay:.04,life:.12,dmg:30,kx:d*350,ky:-220,stun:.5,color:c,fx:'slash',face:d});}else{dashStart(d*1200,.16);}ghosts.push({x:px,y:py,face:-d,t:.3});}
      if(i===2)hit({x:tx,y:GROUND-55,w:150,h:110,delay:.12,life:.75,tick:.25,dmg:7,pin:true,stun:.45,color:c,fx:'crush'});
      if(i===3){ghosts.push({x:px,y:py,face:-d,t:.6});p.inv=Math.max(p.inv,.35);hit({x:px,y:py-45,r:205,delay:.35,life:.15,dmg:38,kx:0,ky:-300,stun:.55,radial:true,color:c,fx:'hole'});} break;
    case 7: // Yuki — freeze and trap
      if(i===0)proj({x:px+d*30,y:py-48,vx:d*680,vy:0,r:12,dmg:21,life:1.1,pierce:true,kx:d*180,ky:-100,stun:.35,color:c,fx:'ice',face:d});
      if(i===1){dashStart(d*1180,.23);hit({follow:true,ox:d*48,oy:-30,w:130,h:85,delay:0,life:.2,dmg:23,kx:d*260,ky:-150,stun:.4,color:c,fx:'wave',face:d});}
      if(i===2)hit({x:tx,y:GROUND-45,w:135,h:90,delay:.35,life:1.15,tick:.28,dmg:8,pin:true,stun:.55,color:c,fx:'ice'});
      if(i===3){hit({x:px+d*110,y:GROUND-70,w:310,h:140,delay:.2,life:.18,dmg:35,kx:d*180,ky:-340,stun:.85,color:c,fx:'ring',face:d});for(const e of foes())if(!e.dead&&Math.abs(e.x-tx)<230)e.stun=Math.max(e.stun||0,.25);} break;
    case 8: // Vex — arcane marks, mines and volleys
      if(i===0)proj({x:px+d*25,y:py-44,vx:d*590,vy:-80,r:16,dmg:20,life:1.2,pierce:false,kx:d*180,ky:-140,stun:.3,color:c,fx:'bolt',face:d,explode:{r:90,dmg:12,kx:220,ky:-180}});
      if(i===1){const mx=clamp(px+d*150,50,WW-50);hit({x:mx,y:GROUND-20,r:75,delay:.5,life:.18,dmg:32,kx:d*220,ky:-360,stun:.5,color:c,fx:'crush'});burst(mx,GROUND-25,10,c,200,.4,120);}
      if(i===2){hit({x:tx,y:GROUND-30,r:82,delay:.65,life:.15,dmg:38,kx:0,ky:-380,stun:.6,radial:true,color:c,fx:'hole'});burst(tx,GROUND-20,7,c,150,.35,80);}
      if(i===3){for(let n=0;n<8;n++){let a=(-.7+n*.2);proj({x:px+d*20,y:py-42,vx:d*Math.cos(a)*520,vy:Math.sin(a)*520,r:10,dmg:11,life:.9,kx:d*100,ky:-100,stun:.22,color:c,fx:'bolt',face:d});}hit({x:px+d*55,y:py-45,r:95,delay:.08,life:.12,dmg:14,kx:d*200,ky:-120,stun:.25,color:c,fx:'ring'});} break;
    case 9: // Sora — reach, vacuum and launch
      if(i===0){dashStart(d*1400,.2);hit({follow:true,ox:d*75,oy:-40,w:160,h:56,delay:0,life:.2,dmg:20,kx:d*300,ky:-100,stun:.35,color:c,fx:'rush',face:d});}
      if(i===1){p.inv=Math.max(p.inv,.35);hit({follow:true,ox:0,oy:-45,r:135,delay:.08,life:.4,tick:.1,dmg:6,pull:1900,pullX:px,kx:0,ky:-30,stun:.25,color:c,fx:'ring'});}
      if(i===2){p.vy=-720;p.onGround=false;p.jumps=1;hit({x:tx,y:GROUND-150,w:90,h:300,delay:.2,life:.55,tick:.12,dmg:6,kx:0,ky:-520,stun:.4,color:c,fx:'pillar'});hit({follow:true,ox:d*35,oy:-70,w:80,h:150,delay:.04,life:.18,dmg:14,kx:d*60,ky:-600,stun:.5,color:c,fx:'rise',face:d});}
      if(i===3)for(let n=0;n<3;n++)proj({x:px+d*(30+n*90),y:py-50,vx:d*380,vy:0,r:40,dmg:9,life:.9,pierce:true,kx:d*900,ky:-120,stun:.35,color:c,fx:'wave',face:d}); break;
    case 10: // Hana — seeds, snares, healing
      if(i===0)for(let n=-1;n<=1;n++)proj({x:px+d*25,y:py-48,vx:d*480,vy:n*90,r:10,dmg:9,life:.9,kx:d*100,ky:-80,stun:.2,color:c,fx:'bolt',face:d,explode:{r:60,dmg:6,kx:120,ky:-120}});
      if(i===1)hit({x:tx,y:GROUND-55,w:160,h:110,delay:.2,life:1.7,tick:.25,dmg:5,pin:true,stun:.5,color:c,fx:'crush'});
      if(i===2){p.hp=Math.min(p.maxhp,p.hp+26);hit({follow:true,ox:0,oy:-42,r:145,delay:.1,life:.15,dmg:16,kx:240,ky:-260,stun:.45,radial:true,color:c,fx:'ring'});burst(px,py-40,18,c,230,.55,160);}
      if(i===3)hit({x:px+d*150,y:py-42,w:310,h:62,delay:.12,life:.15,dmg:24,pull:2700,pullX:px+d*40,stun:.5,color:c,fx:'pull',face:d}); break;
    case 11: // Kyo — precision ranged light
      if(i===0)proj({x:px+d*30,y:py-52,vx:d*1300,vy:0,r:9,dmg:26,life:.75,pierce:true,kx:d*260,ky:-100,stun:.3,color:c,fx:'bolt',face:d});
      if(i===1)for(let n=-1;n<=1;n++)proj({x:px+d*28,y:py-52,vx:d*Math.cos(n*.13)*950,vy:Math.sin(n*.13)*950,r:8,dmg:12,life:.6,kx:d*140,ky:-90,stun:.2,color:c,fx:'bolt',face:d});
      if(i===2){hit({x:tx,y:GROUND-150,w:80,h:300,delay:.3,life:.12,dmg:22,ky:-240,stun:.45,color:'#FFF08A',fx:'pillar'});hit({x:tx,y:GROUND-30,r:105,delay:.35,life:1.2,tick:.3,dmg:7,kx:0,ky:-60,stun:.3,color:c,fx:'well'});}
      if(i===3){p.vx=-d*520;p.vy=-430;p.onGround=false;p.jumps=1;proj({x:px+d*20,y:py-50,vx:d*1000,vy:260,r:11,dmg:28,life:.6,kx:d*320,ky:-200,stun:.4,color:c,fx:'bolt',face:d});ghosts.push({x:px,y:py,face:d,t:.3});} break;
    case 12: // Gorou — claws, lifesteal, crowd lock
      if(i===0){hit({follow:true,ox:d*50,oy:-42,w:110,h:80,delay:.03,life:.1,dmg:18,kx:d*160,ky:-60,stun:.3,color:c,fx:'slash',face:d});p.hp=Math.min(p.maxhp,p.hp+6);}
      if(i===1){p.vy=-540;p.vx=d*520;p.onGround=false;p.jumps=1;hit({x:clamp(px+d*270,40,WW-40),y:GROUND-10,r:115,delay:.5,life:.12,dmg:30,kx:340,ky:-380,stun:.55,radial:true,color:c,fx:'ring'});}
      if(i===2){p.inv=Math.max(p.inv,.4);p.hp=Math.min(p.maxhp,p.hp+10);hit({follow:true,ox:0,oy:-45,r:205,delay:.15,life:.12,dmg:10,kx:300,ky:-100,stun:.9,radial:true,color:c,fx:'ring'});burst(px,py-45,20,c,300,.5,100);}
      if(i===3){dashStart(d*520,.5);for(let n=0;n<8;n++)hit({follow:true,ox:d*60,oy:-42,w:100,h:80,delay:n*.07,life:.05,dmg:7,kx:d*80,ky:-60,stun:.18,color:c,fx:'slash',face:d});p.hp=Math.min(p.maxhp,p.hp+8);} break;
    case 13: // Toki — time control
      if(i===0)proj({x:px+d*30,y:py-50,vx:d*420,vy:0,r:18,dmg:14,life:1.1,pierce:true,kx:d*60,ky:-30,stun:1,color:c,fx:'ice',face:d});
      if(i===1){const h=TK.h[0];if(h){ghosts.push({x:px,y:py,face:d,t:.4});hit({x:px,y:py-40,r:110,delay:.05,life:.12,dmg:14,kx:260,ky:-200,stun:.4,radial:true,color:c,fx:'ring'});p.x=h.x;p.y=Math.min(h.y,GROUND);p.vx=p.vy=0;p.hp=Math.min(p.maxhp,Math.max(p.hp,h.hp));p.inv=Math.max(p.inv,.4);burst(p.x,p.y-45,16,c,220,.5,100);}}
      if(i===2)hit({x:tx,y:GROUND-60,r:150,delay:.15,life:2,tick:.25,dmg:4,pin:true,stun:1,color:c,fx:'well'});
      if(i===3)for(let n=0;n<3;n++)hit({follow:true,ox:d*70,oy:-42,w:150,h:90,delay:n*.4,life:.1,dmg:16,kx:d*220,ky:-150,stun:.4,color:c,fx:'slash',face:d}); break;
    case 14: // Kuro — venom
      if(i===0)proj({x:px+d*30,y:py-42,vx:d*700,vy:0,r:12,dmg:14,life:.9,pierce:true,kx:d*120,ky:-60,stun:.25,color:c,fx:'bolt',face:d,explode:{r:70,dmg:6,kx:80,ky:-60}});
      if(i===1)hit({x:tx,y:py-40,r:125,delay:.25,life:2.4,tick:.3,dmg:6,kx:0,ky:-30,stun:.25,color:c,fx:'fire'});
      if(i===2){dashStart(d*1300,.16);hit({follow:true,ox:d*50,oy:-38,w:110,h:76,delay:0,life:.18,dmg:18,kx:d*260,ky:-150,stun:.35,color:c,fx:'rush',face:d});hit({x:px+d*110,y:GROUND-30,w:220,h:60,delay:.1,life:1.6,tick:.3,dmg:5,kx:0,ky:-40,stun:.2,color:c,fx:'fire'});}
      if(i===3)for(let n=0;n<3;n++)hit({follow:true,ox:0,oy:-40,r:90+n*40,delay:.1+n*.22,life:.1,dmg:9+n*4,kx:200+n*80,ky:-200,stun:.3,radial:true,color:c,fx:'ring'}); break;
    case 15: // Tetsu — iron guardian
      if(i===0)hit({follow:true,ox:d*55,oy:-40,w:100,h:90,delay:.18,life:.14,dmg:38,kx:d*620,ky:-120,stun:.7,color:c,fx:'rush',face:d});
      if(i===1){dashStart(d*900,.22);p.inv=Math.max(p.inv,.3);hit({follow:true,ox:d*50,oy:-40,w:120,h:100,delay:0,life:.24,dmg:24,kx:d*420,ky:-200,stun:.9,color:c,fx:'rush',face:d});}
      if(i===2)hit({x:px+d*170,y:py-42,w:340,h:120,delay:.08,life:.3,dmg:10,kx:0,ky:0,stun:.8,pull:3200,pullX:px+d*45,color:c,fx:'pull',face:d});
      if(i===3){p.inv=Math.max(p.inv,.9);p.hp=Math.min(p.maxhp,p.hp+18);hit({follow:true,ox:0,oy:-42,r:140,delay:.15,life:.12,dmg:22,kx:360,ky:-220,stun:.5,radial:true,color:c,fx:'ring'});} break;
    case 16: // Rei — moon blink
      if(i===0)proj({x:px+d*30,y:py-44,vx:d*430,vy:0,r:24,dmg:20,life:1.4,pierce:true,kx:d*180,ky:-120,stun:.4,color:c,fx:'wave',face:d});
      if(i===1){ghosts.push({x:px,y:py,face:d,t:.35});p.x=clamp(tx-d*70,60,WW-60);hit({x:p.x+d*40,y:py-42,w:130,h:100,delay:.05,life:.15,dmg:28,kx:d*300,ky:-220,stun:.5,color:c,fx:'slash',face:d});}
      if(i===2)hit({x:tx,y:GROUND-40,r:140,delay:.3,life:1.8,tick:.25,dmg:5,pin:true,stun:.8,color:c,fx:'well'});
      if(i===3)for(let n=0;n<5;n++)hit({x:clamp(tx+(n-2)*70,50,WW-50),y:GROUND-110,w:56,h:240,delay:.25+n*.14,life:.14,dmg:15,kx:(n-2)*90,ky:-320,stun:.4,color:c,fx:'pillar'}); break;
    case 17: // Oto — sonic echoes
      if(i===0)for(let n=0;n<2;n++)proj({x:px+d*30,y:py-42,vx:d*(660-n*140),vy:0,r:14,dmg:12,life:.8,pierce:true,kx:d*140,ky:-80,stun:.3,color:c,fx:'wave',face:d});
      if(i===1){hit({x:px,y:py-10,r:190,delay:.28,life:.1,dmg:32,kx:520,ky:-340,stun:.7,radial:true,color:c,fx:'ring'});hit({x:px,y:py-10,r:260,delay:.55,life:.1,dmg:16,kx:340,ky:-200,stun:.4,radial:true,color:c,fx:'ring'});}
      if(i===2){hit({x:tx,y:py-40,r:110,delay:.2,life:1.5,tick:.25,dmg:7,kx:0,ky:-60,stun:.5,color:c,fx:'well'});hit({x:tx,y:py-40,r:130,delay:1.75,life:.1,dmg:28,kx:300,ky:-300,stun:.6,radial:true,color:'#fff',fx:'ring'});}
      if(i===3){dashStart(d*1100,.2);for(let n=0;n<3;n++)hit({follow:true,ox:d*60,oy:-40,w:130,h:90,delay:n*.07,life:.08,dmg:10,kx:d*180,ky:-100,stun:.3,color:c,fx:'wave',face:d});} break;
    case 18: // Ryu — dragon fist
      if(i===0){hit({follow:true,ox:d*60,oy:-42,w:130,h:70,delay:.06,life:.12,dmg:26,kx:d*240,ky:-140,stun:.35,color:c,fx:'rush',face:d});proj({x:px+d*50,y:py-42,vx:d*760,vy:0,r:14,dmg:10,life:.5,pierce:true,kx:d*120,ky:-60,stun:.2,color:c,fx:'bolt',face:d});}
      if(i===1){p.vy=-560;p.onGround=false;p.jumps=1;hit({follow:true,ox:d*30,oy:-80,w:90,h:170,delay:.04,life:.22,dmg:34,kx:d*80,ky:-640,stun:.7,color:c,fx:'rise',face:d});}
      if(i===2){dashStart(d*1100,.18);hit({follow:true,ox:d*50,oy:-38,w:120,h:80,delay:0,life:.2,dmg:20,kx:d*300,ky:-180,stun:.4,color:c,fx:'rush',face:d});hit({x:clamp(px+d*330,60,WW-60),y:GROUND-20,r:110,delay:.3,life:1.2,tick:.25,dmg:6,kx:0,ky:-50,stun:.25,color:c,fx:'fire'});}
      if(i===3){p.hp=Math.min(p.maxhp,p.hp+10);hit({follow:true,ox:0,oy:-45,r:190,delay:.2,life:.12,dmg:30,kx:540,ky:-260,stun:.6,radial:true,color:c,fx:'ring'});} break;
    case 19: // God — divine admin kit (500 dmg per skill)
      if(i===0)proj({x:px+d*30,y:py-44,vx:d*900,vy:0,r:22,dmg:500,life:1.2,pierce:true,kx:d*500,ky:-300,stun:1,color:c,fx:'wave',face:d});
      if(i===1){dashStart(d*1500,.18);hit({follow:true,ox:d*50,oy:-40,w:140,h:100,delay:0,life:.22,dmg:500,kx:d*500,ky:-300,stun:1,color:c,fx:'rush',face:d});}
      if(i===2)for(let n=-2;n<=2;n++)hit({x:clamp(tx+n*90,50,WW-50),y:GROUND-130,w:70,h:280,delay:.25+Math.abs(n)*.1,life:.14,dmg:500,kx:n*80,ky:-420,stun:1,color:c,fx:'pillar'});
      if(i===3)hit({follow:true,ox:0,oy:-45,r:260,delay:.15,life:.12,dmg:500,kx:560,ky:-400,stun:1,radial:true,color:c,fx:'ring'}); break;
    default: if(fi>=20) adminSkill(fi,i); break;
  }
  sfx.cast();
}
const TK={h:[],t:0};
function tkRec(dt){ TK.t+=dt; if(TK.t>.1){ TK.t=0; TK.h.push({x:p.x,y:p.y,hp:p.hp}); if(TK.h.length>20) TK.h.shift(); } }

function handleInput(dt){
  const f=FIGHTERS[p.f];
  if(!started||over){ for(const k in queue) delete queue[k]; return; }
  const dir=(held.right?1:0)-(held.left?1:0);
  if(mode==='story') trackIn(dt);
  const busy=p.lock>0;
  if(p.freeze>0){ p.vx*=1-clamp(dt*20,0,1); }
  else if(!p.dash){
    if(dir&&!busy) p.face=dir;
    const tv=dir*(busy?80:235)*S.speed;
    p.vx+=(tv-p.vx)*clamp(dt*(p.onGround?16:9),0,1);
  }
  const free=p.freeze<=0&&!p.dash;
  if(queue.jump&&free){
    if(p.onGround){ p.vy=-650; p.jumps=1; p.onGround=false; sfx.jump(); mev('jumps',1); }
    else if(ADM.jump||p.jumps<S.jumps){ p.vy=-560; p.jumps++; burst(p.x,p.y,8,'#fff',160,.3,200); sfx.jump(); mev('jumps',1); }
  }
  if(queue.dash&&p.dashCd<=0&&free){ const d=dir||p.face; dashStart(d*900,.16); p.dashCd=.8; sfx.swing(); mev('dashes',1); }
  if((queue.attack||held.attack)&&p.atkCd<=0&&p.lock<=0&&free) doAttack();
  for(let i=0;i<4;i++){
    if(queue['s'+(i+1)]&&p.cd[i]<=0&&p.lock<=0&&free){
      autoFace(); const sk=f.skills[i]; p.cd[i]=sk.cd*S.cd; p.lock=sk.lock; p.anim={type:'cast',t:0,dur:Math.max(.3,sk.lock)}; castDistinctSkill(p.f,i); castFx(i); mev('skills',1);

    }
  }
  if(queue.ult&&ult>=100&&p.lock<=0&&free){
    ult=0; autoFace(); p.lock=f.ult.lock; p.freeze=f.ult.freeze||0; p.inv=Math.max(p.inv,f.ult.lock+.2); p.anim={type:'cast',t:0,dur:f.ult.lock};
    mev('ults',1); f.ult.cast(); banner={txt:f.ult.name,t:1.2,c:f.color}; ultFx=.9; sfx.ult(); showCutin(p.f); ultFxBurst();
  }
  for(const k in queue) delete queue[k];
}
function physics(dt){
  if(p.dash){
    p.dash.t-=dt; p.dash.gt-=dt; p.vx=p.dash.vx; p.vy=0;
    if(p.dash.gt<=0){ ghosts.push({x:p.x,y:p.y,face:p.face,t:.28}); p.dash.gt=.025; fxStreak(p.x-p.face*18,p.y-rnd(20,70),FC(),p.face>0?Math.PI:0,rnd(40,80),.25,3); if(p.f===4) fxBolt(p.x,p.y-60,p.x-p.face*60,p.y-rnd(10,70),'#fff',.15); }
    if(p.dash.t<=0){ p.vx*=.25; p.dash=null; }
  } else p.vy+=1900*S.g*dt;
  p.x+=p.vx*dt; p.y+=p.vy*dt;
  if(p.y>=GROUND){ if(!p.onGround&&p.vy>420){ fxRing(p.x,GROUND-3,'#cfd6ff',8,50,.3,3); for(let k=0;k<4;k++) fx({type:'shard',x:p.x+rnd(-12,12),y:GROUND-2,c:'#8a86a8',vx:rnd(-120,120),vy:rnd(-160,-60),r:rnd(2,4),rot:rnd(0,6),life:.4}); } p.y=GROUND; p.vy=0; p.onGround=true; p.jumps=0; } else p.onGround=false;
  p.x=clamp(p.x,30,WW-30);
}
function updateHits(dt){
  for(let i=H.length-1;i>=0;i--){
    const h=H[i]; h.age+=dt;
    if(h.follow){ h.x=p.x+h.ox; h.y=p.y+h.oy; }
    if(h.age>=h.delay+h.life){ H.splice(i,1); continue; }
    if(h.age<h.delay) continue;
    if(!h.started){ h.started=true; h.nextTick=h.age; startFx(h); }
    for(const d of foes()){
      if(d.dead||!overlaps(h,d)) continue;
      if(h.pull){ d.vx=clamp(d.vx+clamp((h.pullX-d.x)/40,-1,1)*h.pull*dt,-700,700); d.stun=Math.max(d.stun,.15); }
      if(h.tick>0){ i
