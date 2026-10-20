"""Derive tools3d/junction3d-saboteur.template.html from the plain 3D template (adds the saboteur layer + a director API).
Usage: python3 tools3d/make_saboteur_template.py   (then build with build.py from junction-saboteur.html)"""
import os
D = os.path.dirname(os.path.abspath(__file__))
s = open(f"{D}/junction3d.template.html").read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# ---------- page + HUD
rep("<title>Junction 3D: Europe</title>", "<title>Junction 3D: Saboteur Express</title>")
rep('  <button class="iconbtn" id="mapBtn" aria-label="Map view (M)" aria-pressed="false">Map</button>',
    '  <button class="iconbtn" id="mapBtn" aria-label="Map view (M)" aria-pressed="false">Map</button>\n  <button class="iconbtn" id="logBtn" aria-label="Ship log (L)">Log</button>')
rep('    <button id="useBtn" class="use" disabled aria-label="Use"><span>USE</span><small id="useLbl"></small></button>',
    '    <div class="row userow"><button id="meetBtn" class="use meet" disabled aria-label="Emergency meeting (R)"><span>!</span><small id="meetLbl">Meeting</small></button>\n    <button id="useBtn" class="use" disabled aria-label="Use"><span>USE</span><small id="useLbl"></small></button></div>')
rep('<div id="boot">Building Europe…</div>', '<div id="alarm" class="hud"></div>\n<div id="boot">Building Europe…</div>')
rep("#hint{left:50%;", """.userow{align-items:flex-end}
.use.meet{width:74px;height:74px;background:var(--danger);color:#fff;font-size:30px}
.use.meet small{font-size:10px}
.use.meet:not(:disabled){animation:pulse 1.6s ease-in-out infinite}
.mate{position:relative}.mate.out{opacity:.4}
.mate .flag{position:absolute;top:2px;right:5px;font-size:11px;font-weight:800}.mate .flag.ok{color:var(--good)}
#alarm{inset:0;pointer-events:none;opacity:0;box-shadow:inset 0 0 180px 40px rgba(255,40,60,.85);transition:opacity .2s}
#alarm.on{opacity:1;animation:alarm .6s ease-in-out infinite alternate}
@keyframes alarm{from{box-shadow:inset 0 0 120px 20px rgba(255,40,60,.6)}to{box-shadow:inset 0 0 220px 60px rgba(255,40,60,.95)}}
.task{border:2.5px solid var(--accent);border-radius:14px;padding:11px 12px;margin:2px 0 12px}
.task .q{font-weight:800;margin-bottom:9px;font-size:15px}
.opts{display:flex;flex-direction:column;gap:8px}
.votes{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:6px 0 6px}
.vote{border:2.5px solid var(--outline);background:var(--card);border-radius:14px;padding:10px 4px;text-align:center;font-family:'Fredoka';font-weight:600;font-size:16px;box-shadow:0 3px 0 var(--outline)}
.vote svg{width:34px;height:46px;display:block;margin:0 auto 4px}
.vote small{display:block;font-family:'Nunito';font-weight:800;color:var(--good);font-size:11px}
.vote:disabled{opacity:.4;cursor:default}
#logList{list-style:none;padding:0;display:flex;flex-direction:column;gap:7px;font-size:14px}
#logList li{padding-left:10px;border-left:3px solid var(--line)}#logList li.danger{border-color:var(--danger)}#logList li.good{border-color:var(--good)}
#hint{left:50%;""")
rep('Use: <span class="keys">E</span> · Map: <span class="keys">M</span></div>',
    'Use: <span class="keys">E</span> · Meeting: <span class="keys">R</span> · Map: <span class="keys">M</span></div>')

# ---------- state
rep("     routes:ROUTES.map(r=>({...r,owner:null})),\n     players:PLAYERS.map(p=>({...p,hand:{},trains,stations:3,tickets:[]}))};",
    "     routes:ROUTES.map(r=>({...r,owner:null,blocked:0})),\n     players:PLAYERS.map(p=>({...p,hand:{},trains,stations:3,tickets:[],alive:true,cleared:false,pos:null}))};\n"
    "  S.sab=1+rand(3);S.sabotages=0;S.sabRound=0;S.caught=false;S.meetingUsed=false;S.meetingPts=0;S.taskUsed=false;S.tasksDone={};")
rep("addLog(`New game with ${trains} trains each. Choose your destination tickets.`);",
    "addLog(`New game with ${trains} trains each. One of the other robots is a saboteur. Choose your destination tickets.`);")
rep("const canAct=()=>", "const nbrs=id=>ADJ[id].map(ri=>{const r=ROUTES[ri];return r.a===id?r.b:r.a});\nconst reachable=id=>S.routes.some(r=>r.owner===0&&(r.a===id||r.b===id))||S.stationAt[id]===0;\nconst canAct=()=>")

# ---------- turn flow: skip ejected robots, repair sabotage, one task per turn
rep("{S.lastTurns=S.players.length+1;SND.ready&&SND.fx.finalRound();addLog(", "{S.lastTurns=S.players.filter(q=>q.alive).length+1;SND.ready&&SND.fx.finalRound();addLog(")
rep("""  S.turn=(S.turn+1)%S.players.length;S.drawn=0;S.selected=null;
  if(S.turn===0){S.round++;if(S.round>60){endGame();return}}""",
    """  do{S.turn=(S.turn+1)%S.players.length;
    if(S.turn===0){S.round++;S.taskUsed=false;S.routes.forEach(r=>{if(r.blocked>0)r.blocked--})}
  }while(!S.players[S.turn].alive);
  S.drawn=0;S.selected=null;
  if(S.round>60){endGame();return}""")

# ---------- the saboteur walks to the route it blacks out, then slips away before the alarm's sightings
rep("async function botTurn(p){\n  const want=wanted(p);let best=null;",
    """async function botSabotage(p){
  const g=GEN,A=ACT[p.id],open=c=>S.routes.filter(r=>r.owner===null&&!r.blocked&&(r.a===c||r.b===c));
  let c0=nearestCity(A.x,A.z).id,cand=open(c0);
  if(!cand.length){const near=nbrs(c0).filter(c=>open(c).length);if(!near.length)return;c0=pick(near);cand=open(c0)}
  const hw=wanted(H()),hit=cand.filter(r=>hw.has(r.i)),r=pick(hit.length?hit:cand); // prefers routes you need
  const[mx,mz]=routeMid(r);
  await walkTo(p.id,mx,mz);if(g!==GEN||S.over)return;
  r.blocked=3;S.sabotages++;fx.sparks(mx,mz);fx.alarm();render();
  const seen=Math.hypot(ACT[0].x-mx,ACT[0].z-mz)<32;
  const hub=pick([r.a,r.b]),hop1=pick([hub,...nbrs(hub)]),dest=Math.random()<.5?pick([hop1,...nbrs(hop1)]):hop1;await walkTo(p.id,...W(dest));if(g!==GEN||S.over)return;
  const sight=S.players.filter(q=>!q.human&&q.alive).map(q=>`${q.name} at ${nm(nearestCity(ACT[q.id].x,ACT[q.id].z).id)}`).join(', ');
  addLog(`⚠ Sabotage! Signal fault on ${nm(r.a)} to ${nm(r.b)}, blocked for 2 rounds. Sightings: ${sight}.`,'danger');
  if(seen)addLog(`👀 You saw ${p.name} at the ${nm(r.a)}–${nm(r.b)} signals!`,'danger');
}
async function botTurn(p){
  if(p.id===S.sab&&!S.caught&&p.alive&&S.round%3===0&&S.sabRound!==S.round){S.sabRound=S.round;const g=GEN;await botSabotage(p);if(g!==GEN||S.over)return}
  const want=wanted(p);let best=null;""")

# ---------- rules
rep("  <li>Rose, Sandy and Mint walk to everything they claim, so you can watch where they’re heading. Walk into any city to read about its landmark.</li>",
    """  <li>Rose, Sandy and Mint walk to everything they claim, so you can watch where they’re heading. Walk into any city to read about its landmark.</li>
  <li><b>One of them is a saboteur.</b> Every third round it walks to a route and blacks it out for 2 rounds: nobody can claim it until it’s repaired. The ship log (<span class="keys">L</span>) records where every robot was seen, and if you’re standing nearby you’ll see who did it.</li>
  <li><b>Station tasks</b>: in a city you’ve connected, answer a question about its landmark (one task per turn) for a locomotive card or a robot’s alibi.</li>
  <li><b>Emergency meeting</b> (<span class="keys">R</span> or the red button): once per game, after the first sabotage, vote a suspect off the map. +15 if it’s the saboteur, −5 if it isn’t. A saboteur who’s never caught earns +10.</li>""")
# online play only knows the plain Europe rules, and the saboteur keeps its own Quick / Long balance
rep("const ONLINE_OK=true;", "const ONLINE_OK=false;")
rep("""const soloModesHTML=()=>`<div class="kicker">Play solo against the robots</div><div class="modes"><button class="btn primary" data-new="18">Blitz<small>18 trains each, a quick game</small></button><button class="btn" data-new="40">Classic<small>40 trains each, fills the map</small></button></div>`;""",
    """const soloModesHTML=()=>`<div class="modes"><button class="btn primary" data-new="20">Quick game<small>20 trains each, about 10 minutes</small></button><button class="btn" data-new="30">Long game<small>30 trains each, fills the map</small></button></div>`;""")
rep("  newGame(18,true);if(!netBoot())openStart();", "  newGame(20,true);if(!netBoot())openStart();")
rep('sheet(`<div class="kicker">Four robots, one continent</div><h3>Walk Europe. Build the best railway.</h3>${soloModesHTML()}${onlineStartHTML()}\n  <div class="kicker orline">How to play</div>${rulesHTML()}`);',
    'sheet(`<div class="kicker">Four robots, one saboteur</div><h3>Walk Europe. Build the best railway. Find the saboteur.</h3>${rulesHTML()}\n  ${soloModesHTML()}`);')

# ---------- director clock (the trailer renders the real game frame by frame)
rep("/* ===================================================================== 3D WORLD */",
    "/* ===================================================================== 3D WORLD */\nconst DIR={on:false,t:0,cam:null};\nconst clock=()=>DIR.on?DIR.t:performance.now()/1000;")
rep("  const now=performance.now()/1000;\n  S.routes.forEach((r,i)=>{const w=R3[i];", "  const now=clock();\n  S.routes.forEach((r,i)=>{const w=R3[i];")
rep("hop(pid){ACT[pid].hopT=performance.now()/1000},", "hop(pid){ACT[pid].hopT=clock()},")
rep("const hr=IA.find(a=>a.route!==undefined),sel=S&&S.selected!==null?S.selected:(hr?hr.route:null),t=performance.now()/1000;",
    "const hr=IA.find(a=>a.route!==undefined),sel=S&&S.selected!==null?S.selected:(hr?hr.route:null),t=clock();")

# ---------- sabotaged routes in 3D: darkened cars and a red warning beacon
rep("  R3.push({cars,owner:null,popT:-9,hl:0});",
    """  const beacon=new THREE.Group();beacon.position.set((ax+bx)/2,TOP,(az+bz)/2);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,5.5,8),toon(INK));pole.position.y=2.75;
  const lampMat=new THREE.MeshBasicMaterial({color:'#ff3b4f'}),lamp=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),lampMat);lamp.position.y=6.1;
  const halo=new THREE.Mesh(new THREE.SphereGeometry(2.2,16,12),new THREE.MeshBasicMaterial({color:'#ff3b4f',transparent:true,opacity:.25,depthWrite:false}));halo.position.y=6.1;
  const warn=labelSprite('!',{bg:'#ff3b4f',color:'#ffffff',size:2.6});warn.position.y=8.6;
  beacon.add(pole,lamp,halo,warn);beacon.visible=false;scene.add(beacon);
  R3.push({cars,owner:null,popT:-9,hl:0,blocked:false,beacon,halo});""")
rep("  const stamped=new Set();S.routes.forEach(r=>{if(r.owner===0){stamped.add(r.a);stamped.add(r.b)}});",
    """  S.routes.forEach((r,i)=>{const w=R3[i],b=!!r.blocked;if(w.blocked!==b){w.blocked=b;w.beacon.visible=b;
    w.cars.forEach(c=>c.mat.color.set(b?'#4a2533':(r.owner!==null?PLAYERS[r.owner].col:HEX[r.color])))}});
  const stamped=new Set();S.routes.forEach(r=>{if(r.owner===0){stamped.add(r.a);stamped.add(r.b)}});""")

# ---------- effects: sparks, alarm, ejection splash
rep("  hop(pid){ACT[pid].hopT=clock()},", """  hop(pid){ACT[pid].hopT=clock()},
  sparks(x,z){if(FAST)return;for(let i=0;i<26;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,.35),new THREE.MeshBasicMaterial({color:i%3?'#ffd23f':'#ffffff'}));m.position.set(x,TOP+2,z);scene.add(m);const a=i*2.4;FX.push({m,t:0,d:1.1,kind:'conf',v:new THREE.Vector3(Math.cos(a)*(8+i%5*3),10+i%4*4,Math.sin(a)*(8+i%5*3)),s:new THREE.Vector3(6,4,0)})}},
  alarm(){if(FAST)return;const el=$('alarm');el.classList.add('on');clearTimeout(fx.alT);fx.alT=setTimeout(()=>el.classList.remove('on'),3200)},
  splash(x,z){if(FAST)return;for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.RingGeometry(1,1.8,32),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.15,z);scene.add(m);FX.push({m,t:-k*.18,d:1.4,kind:'ring'})}},""")
rep("function stepFX(dt){for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t+=dt;const u=f.t/f.d;",
    "function stepFX(dt){for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t+=dt;const u=f.t/f.d;if(u<0)continue;")

# ---------- ejection: launched off the map, into the sea
rep("function animRobot(R,A,t){\n", """function animRobot(R,A,t){
  if(A.ejectT!=null){ // flung off the map: a long arc out to sea, spinning, then gone
    const u=(t-A.ejectT)/2.6;
    if(u>=1){R.root.visible=false;if(!A.splashed){A.splashed=true;fx.splash(A.ej[2],A.ej[3])}return}
    const x=A.ej[0]+(A.ej[2]-A.ej[0])*u,z=A.ej[1]+(A.ej[3]-A.ej[1])*u,y=TOP+Math.sin(u*Math.PI)*38-u*TOP;
    R.root.position.set(x,y,z);R.root.rotation.set(u*9,u*14,u*5);R.eye.scale.y=1;return;
  }
""")
rep("  R.root.position.set(A.x,A.y+hy,A.z);R.root.rotation.y=A.face;",
    "  R.root.position.set(A.x,A.y+hy,A.z);R.root.rotation.set(0,A.pose&&A.pose.face!=null?A.pose.face:A.face,0);")
rep("  R.eye.scale.y=A.blinkT-t>0&&A.blinkT-t<.12?.12:1;",
    "  R.eye.scale.y=A.pose&&A.pose.squint!=null?A.pose.squint:(A.blinkT-t>0&&A.blinkT-t<.12?.12:1);")
rep("R.pupil.position.x=A.moving?Math.sin(A.dir)*.32:Math.sin(t*.7+A.id)*.3;R.pupil.position.y=A.moving?-Math.cos(A.dir)*.3:0;",
    "R.pupil.position.x=A.pose&&A.pose.lookX!=null?A.pose.lookX:A.moving?Math.sin(A.dir)*.32:Math.sin(t*.7+A.id)*.3;R.pupil.position.y=A.pose&&A.pose.lookY!=null?A.pose.lookY:A.moving?-Math.cos(A.dir)*.3:0;")
rep("function stepActor(A,dt,t){\n  let vx=0,vz=0;", "function stepActor(A,dt,t){\n  if(S&&!S.players[A.id].alive)return;\n  let vx=0,vz=0;")
rep("ACT.forEach((A,i)=>{A.x=cx+[-4,4,-4,4][i];", "ACT.forEach((A,i)=>{A.ejectT=null;A.splashed=false;A.pose=null;if(ROBOTS[i])ROBOTS[i].root.visible=true;A.x=cx+[-4,4,-4,4][i];")
# start the ejection once the result sheet is closed, with the camera following
rep("function stepUI(){\n", """function stepEject(){
  if(!S)return;S.players.forEach((p,i)=>{const A=ACT[i];if(!p.alive&&A.ejectT==null&&!sheetOpen()){
    const d=Math.hypot(A.x,A.z)||1,k=95/d;A.ejectT=clock();A.ej=[A.x,A.z,Math.max(-190,Math.min(190,A.x+A.x*k)),Math.max(-145,Math.min(145,A.z+A.z*k))];
    CAM.focus={pid:i,until:clock()+3}}});
}
function stepUI(){
  stepEject();S&&S.players.forEach((p,i)=>{if(p.alive)p.pos=nearestCity(ACT[i].x,ACT[i].z).id});
  const mb=$('meetBtn');if(S){const open=meetingOpen();mb.disabled=!open;$('meetLbl').textContent=S.meetingUsed?'Used':'Meeting'}
""")

# ---------- camera: follow an ejection; director camera override
rep("  const A=ACT[0],k=1-Math.exp(-dt*5);\n  const mapD",
    """  if(DIR.cam){camera.position.set(...DIR.cam.pos);camera.lookAt(...DIR.cam.look);if(DIR.cam.fov&&camera.fov!==DIR.cam.fov){camera.fov=DIR.cam.fov;camera.updateProjectionMatrix()}
    Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120});sun.shadow.camera.updateProjectionMatrix();sun.position.set(DIR.cam.look[0]-110,230,DIR.cam.look[2]+90);sun.target.position.set(DIR.cam.look[0],0,DIR.cam.look[2]);return}
  const F=CAM.focus&&clock()<CAM.focus.until?ACT[CAM.focus.pid]:null;
  const A=F&&F.ej?{x:F.ej[0]+(F.ej[2]-F.ej[0])*Math.min(1,(clock()-F.ejectT)/2.6),z:F.ej[1]+(F.ej[3]-F.ej[1])*Math.min(1,(clock()-F.ejectT)/2.6)}:ACT[0],k=1-Math.exp(-dt*5);
  const mapD""")

# ---------- interactions: tasks show on the USE button
rep("    out.push({key:'c'+nc.id,label:can?`Station · ${C[nc.id].n}`:`${C[nc.id].n} postcard`,ok:true,go:()=>openCity(nc.id),city:nc.id})}",
    "    const task=canAct()&&reachable(nc.id)&&!S.tasksDone[nc.id]&&!S.taskUsed;\n    out.push({key:'c'+nc.id+task,label:task?`Task · ${C[nc.id].n}`:can?`Station · ${C[nc.id].n}`:`${C[nc.id].n} postcard`,ok:true,go:()=>openCity(nc.id),city:nc.id})}")

# ---------- HUD: roster flags, meeting + log
rep("""$('roster').innerHTML=S.players.map(p=>{const hc=Object.values(p.hand).reduce((a,b)=>a+b,0);return `<div class="mate ${S.turn===p.id&&!S.over?'turn':''}">${sprocket(p.col)}""",
    """$('roster').innerHTML=S.players.map(p=>{const hc=Object.values(p.hand).reduce((a,b)=>a+b,0);return `<div class="mate ${S.turn===p.id&&!S.over?'turn':''} ${p.alive?'':'out'}">${p.cleared?'<span class="flag ok" title="Innocent">✓</span>':''}${p.alive?'':'<span class="flag" title="Ejected">✕</span>'}${sprocket(p.col)}""")
rep("$('zin').onclick=()=>zoom(-18);$('zout').onclick=()=>zoom(18);",
    """$('zin').onclick=()=>zoom(-18);$('zout').onclick=()=>zoom(18);
$('meetBtn').onclick=()=>openMeeting();
function openLog(){sheet(`<div class="kicker">Ship log</div><h3>Sightings and moves</h3><ol id="logList">${S.log.slice(0,16).map(l=>`<li class="${l.k}">${l.t}</li>`).join('')}</ol>${closeBtn()}`)}
$('logBtn').onclick=()=>{if(S&&!(S.locked&&S.offer))openLog()};""")
rep("  if(k==='m')$('mapBtn').click();", "  if(k==='m')$('mapBtn').click();\n  if(k==='r')openMeeting();\n  if(k==='l')$('logBtn').click();")

# ---------- loop: split update / draw so the director can step it
rep("""function loop(now){
  const dt=Math.min(.1,(now-last)/1000),t=now/1000;last=now;
  if(S){""", """function loop(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(!DIR.on){update(dt,now/1000);renderer.render(scene,camera)}
  requestAnimationFrame(loop);
}
function update(dt,t){
  if(S){""")
rep("""    const TA=ACT[S.turn];turnRing.visible=!S.over;""", """    const TA=ACT[S.turn];turnRing.visible=!S.over&&!DIR.cam;
    R3.forEach((w,i)=>{if(w.blocked){w.halo.scale.setScalar(1+.35*Math.sin(t*8+i));w.cars.forEach(c=>{c.mat.emissive.set('#ff2040');c.mat.emissiveIntensity=.25+.25*Math.sin(t*8)})}});""")
rep("""    seaTex.offset.x=(t*.004)%1;
  }
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}""", """    seaTex.offset.x=(t*.004)%1;
  }
}""")

# ---------- director overrides: scripted walking speed, no idle wandering
# (A.spd and A.still are in the plain template now: online play uses them too)
rep("ACT.forEach((A,i)=>{A.ejectT=null;A.splashed=false;A.pose=null;", "ACT.forEach((A,i)=>{A.ejectT=null;A.splashed=false;A.pose=null;A.spd=null;A.still=false;")

# ---------- hooks: tests + the trailer director
rep("window.J={get S(){return S},newGame,botTurn,endTurn,H,ACT,walkTo,interactions,takeMarket,openRoute,openCity,payOptions,startClaim,CAM,",
    """const v3=new THREE.Vector3();
window.J={get S(){return S},newGame,botTurn,endTurn,H,ACT,walkTo,interactions,takeMarket,openRoute,openCity,payOptions,startClaim,CAM,
  botSabotage,openMeeting,vote,answer,reward,openLog,meetingOpen,nearestCity,W,routeMid,ROBOTS,fx,world,
  dir:{start(t=0){DIR.on=true;DIR.t=t},stop(){DIR.on=false;DIR.cam=null},
    step(dt){DIR.t+=dt;update(dt,DIR.t);renderer.render(scene,camera)},
    cam(pos,look,fov){DIR.cam=pos?{pos,look,fov}:null},
    hud(v){document.querySelectorAll('.hud').forEach(e=>e.style.visibility=v?'':'hidden')},
    grab(type='image/jpeg',q=.92){renderer.render(scene,camera);return renderer.domElement.toDataURL(type,q)},
    project(pid,dy=2.9){const R=ROBOTS[pid];R.root.updateMatrixWorld();v3.set(0,dy,1.5).applyMatrix4(R.root.matrixWorld).project(camera);return[(v3.x+1)/2*innerWidth,(1-v3.y)/2*innerHeight]},
    projectXZ(x,y,z){v3.set(x,y,z).project(camera);return[(v3.x+1)/2*innerWidth,(1-v3.y)/2*innerHeight]},
    get t(){return DIR.t}},""")

# ======================================================================= talking robots: suspicion, accusations, votes
rep("  r.blocked=3;S.sabotages++;fx.sparks(mx,mz);fx.alarm();render();\n  const seen=Math.hypot(ACT[0].x-mx,ACT[0].z-mz)<32;",
    "  r.blocked=3;S.sabotages++;fx.sparks(mx,mz);fx.alarm();SND.ready&&SND.fx.sabotage();render();\n  const seen=Math.hypot(ACT[0].x-mx,ACT[0].z-mz)<32;\n  const wit=S.players.filter(q=>!q.human&&q.alive&&q.id!==p.id&&Math.hypot(ACT[q.id].x-mx,ACT[q.id].z-mz)<21).map(q=>q.id);")
rep("  if(seen)addLog(`👀 You saw ${p.name} at the ${nm(r.a)}–${nm(r.b)} signals!`,'danger');\n}",
    "  if(seen)addLog(`👀 You saw ${p.name} at the ${nm(r.a)}–${nm(r.b)} signals!`,'danger');\n  recordSabotage(p,r,wit,`⚠ Sabotage! Signal fault on ${nm(r.a)} to ${nm(r.b)}, blocked for 2 rounds. Sightings: ${sight}.`);\n}")
rep("  if(p.id===S.sab&&!S.caught&&p.alive&&S.round%3===0&&S.sabRound!==S.round){S.sabRound=S.round;const g=GEN;await botSabotage(p);if(g!==GEN||S.over)return}",
    "  if(p.id===S.sab&&!S.caught&&p.alive&&S.round%3===0&&S.sabRound!==S.round){S.sabRound=S.round;const g=GEN;await botSabotage(p);if(g!==GEN||S.over)return}\n  {const g=GEN;if(botWantsMeeting(p)){await runMeeting(p.id);if(g!==GEN||S.over||!p.alive)return}}")
rep("async function botSabotage(p){", r"""/* ---- talking robots: each robot suspects the others from what it saw and heard, accuses, lies (the saboteur) and votes ---- */
const aliveBots=()=>S.players.filter(p=>!p.human&&p.alive);
const susOf=(b,q)=>(S.sus&&S.sus[b]&&S.sus[b][q])||0;
function addSus(b,q,v){if(b===q||!S.players[q].alive||(S.players[q].cleared&&v>0))return;S.sus=S.sus||{};const m=S.sus[b]=S.sus[b]||{};m[q]=Math.max(0,(m[q]||0)+v)}
function recordSabotage(p,r,wit,line){
  const sight={};aliveBots().forEach(q=>{sight[q.id]=nearestCity(ACT[q.id].x,ACT[q.id].z).id});
  S.lastSab={a:r.a,b:r.b,wit,sight,line,held:false,round:S.round};
  const near=c=>c===r.a||c===r.b?22:(nbrs(r.a).includes(c)||nbrs(r.b).includes(c))?8:-8;
  aliveBots().forEach(b=>{if(b.id===S.sab)return;
    if(wit.includes(b.id))addSus(b.id,p.id,100); // saw it happen
    aliveBots().forEach(q=>{if(q.id!==b.id)addSus(b.id,q.id,near(sight[q.id]))})});
}
function botWantsMeeting(p){
  const ls=S.lastSab;if(!ls||ls.held||S.caught||(S.botMeetings||0)>=2||S.over)return false;
  if(p.id===S.sab)return ls.round===S.round&&Math.random()<.25; // a bold saboteur reports its own sabotage to frame someone
  return Math.max(0,...aliveBots().filter(q=>q.id!==p.id).map(q=>susOf(p.id,q.id)))>=60;
}
function humanMeeting(){if(!meetingOpen())return;S.meetingUsed=true;runMeeting(0)}
function discussion(caller){
  const ls=S.lastSab,L=[],bots=aliveBots(),route=ls?`${nm(ls.a)}–${nm(ls.b)}`:'that line',sabAlive=!S.caught&&S.players[S.sab].alive;
  const where=id=>ls&&ls.sight[id]?ls.sight[id]:nearestCity(ACT[id].x,ACT[id].z).id;
  const claims={};
  const said=(pid,text,o={})=>{L.push({pid,text});if(o.acc==null)return;claims[pid]=o.acc;
    bots.forEach(b=>{if(b.id===S.sab||b.id===pid)return;addSus(b.id,o.acc,o.callout?48:30*(1-Math.min(1,susOf(b.id,pid)/100)))})};
  const accusedNow=id=>Object.values(claims).includes(id);
  const pub=q=>bots.reduce((s,b)=>s+susOf(b.id,q),0);
  const goat=bots.filter(b=>b.id!==S.sab&&!b.cleared).sort((x,y)=>pub(y.id)-pub(x.id))[0];
  let lie=null;
  if(caller===0)L.push({pid:0,text:'I called this meeting. Who was near the signals?'});
  const order=[caller,...bots.map(b=>b.id).filter(id=>id!==caller)].filter(id=>id!==0&&S.players[id].alive);
  order.forEach(id=>{
    if(sabAlive&&id===S.sab){
      if(accusedNow(id)){const fake=pick(IDS.filter(c=>c!==where(id)&&(!ls||(c!==ls.a&&c!==ls.b&&!nbrs(ls.a).includes(c)&&!nbrs(ls.b).includes(c)))));lie=fake;
        said(id,`Me? I was in ${nm(fake)} the whole time!`);
        if(goat)said(id,`${goat.name} was right by the ${route} signals. Look at the log.`,{acc:goat.id})}
      else if(goat&&Math.random()<.6)said(id,`I saw ${goat.name} near the ${route} signals!`,{acc:goat.id});
      else if(goat)said(id,`${goat.name} was in ${nm(where(goat.id))}. That’s awfully close to the fault.`,{acc:goat.id});
      else said(id,'I didn’t see anything. Let’s not throw anyone off on a hunch.');
      return;
    }
    const defended=accusedNow(id);if(defended)said(id,`It wasn’t me! The log has me in ${nm(where(id))}.`);
    if(lie&&sabAlive&&Math.random()<.6){said(id,`Hang on. The log puts ${S.players[S.sab].name} in ${nm(where(S.sab))}, not ${nm(lie)}.`,{acc:S.sab,callout:true});lie=null;return}
    if(ls&&ls.wit.includes(id)&&sabAlive){said(id,`I saw ${S.players[S.sab].name} at the ${route} signals!`,{acc:S.sab});return}
    const top=bots.filter(q=>q.id!==id&&!q.cleared).sort((x,y)=>susOf(id,y.id)-susOf(id,x.id))[0];
    if(top&&susOf(id,top.id)>=30&&!accusedNow(top.id)||top&&susOf(id,top.id)>=60)said(id,`${top.name} was in ${nm(where(top.id))}, right next to the fault.`,{acc:top.id});
    else if(!defended){const cl=bots.find(q=>q.cleared&&q.id!==id);said(id,cl?`${cl.name}’s alibi already checked out. I was in ${nm(where(id))} and didn’t see it.`:`I was in ${nm(where(id))}. I didn’t see a thing.`)}
  });
  return L;
}
function botVotes(){
  const v={},bots=aliveBots(),pub=q=>bots.reduce((s,c)=>s+susOf(c.id,q),0);
  bots.forEach(b=>{
    const pool=bots.filter(q=>q.id!==b.id&&!q.cleared);
    if(!S.caught&&b.id===S.sab){const goat=pool.sort((x,y)=>pub(y.id)-pub(x.id))[0];v[b.id]=goat?goat.id:'skip';return}
    const top=pool.sort((x,y)=>susOf(b.id,y.id)-susOf(b.id,x.id))[0];v[b.id]=top&&susOf(b.id,top.id)>=56?top.id:'skip';
  });
  return v;
}
function tally(v){const n={};Object.values(v).forEach(x=>{n[x]=(n[x]||0)+1});const r=Object.entries(n).filter(([k])=>k!=='skip').sort((a,b)=>b[1]-a[1]);
  if(!r.length||r[0][1]<2||(r[1]&&r[1][1]===r[0][1])||(n.skip||0)>=r[0][1])return null;return +r[0][0]}
function applyResult(ej,v){
  const you=v[0];let txt,good=null;
  if(ej==null){txt='No one was ejected. The vote was split or skipped.';addLog('🚨 Meeting: no one was ejected.')}
  else{const p=S.players[ej];p.alive=false;
    if(ej===S.sab){S.caught=true;good=true;S.routes.forEach(r=>{if(r.blocked)r.blocked=0});if(you===ej)S.meetingPts+=15;
      Object.entries(v).forEach(([k,x])=>{if(+k!==0&&x===ej){const q=S.players[+k];q.bonus=(q.bonus||0)+5}});
      txt=`${p.name} was the saboteur. The signals come back on.${you===ej?' +15 pts':''}`;addLog(`🚨 ${p.name} was ejected. ${p.name} was the saboteur!${you===ej?' +15':''}`,'good')}
    else{good=false;if(you===ej)S.meetingPts-=5;txt=`${p.name} was innocent. The saboteur is still out there.${you===ej?' −5 pts':''}`;addLog(`🚨 ${p.name} was ejected. ${p.name} was innocent.${you===ej?' −5':''}`,'danger')}}
  Object.values(S.sus||{}).forEach(m=>Object.keys(m).forEach(k=>{m[k]*=.5})); // nerves settle after a meeting
  return{txt,good,ej};
}
function runMeeting(caller){
  if(S.lastSab)S.lastSab.held=true;if(caller!==0)S.botMeetings=(S.botMeetings||0)+1;
  const lines=discussion(caller),bv=botVotes();
  if(FAST){const v={...bv,0:S.autoVote??'skip'};S.autoVote=undefined;applyResult(tally(v),v);render();return Promise.resolve()}
  S.meeting={caller};S.locked=true;SND.ready&&SND.fx.meeting();fx.alarm();render();
  return new Promise(res=>showMeeting(caller,lines,bv,res));
}
function showMeeting(caller,lines,bv,done){
  const bots=aliveBots(),who=caller===0?'you':S.players[caller].name;
  sheet(`<div class="kicker">🚨 Emergency meeting · called by ${who}</div><h3>Who’s the saboteur?</h3>
  ${S.lastSab?`<div class="note ev">${S.lastSab.line}</div>`:''}<div class="chat" id="chat"></div>
  <div class="votes">${bots.map(p=>`<button class="vote" data-mv="${p.id}">${sprocket(p.col)}${p.name}${p.cleared?'<small>cleared</small>':''}<span class="chips" id="vc${p.id}"></span></button>`).join('')}</div>
  <button class="btn full" data-mv="skip">Skip vote <span class="chips" id="vcskip"></span></button><div id="mres"></div>`);
  let i=0,voted=false;const chat=$('chat');
  const say=()=>{if(i>=lines.length)return;const l=lines[i++],p=S.players[l.pid];
    chat.insertAdjacentHTML('beforeend',`<div class="say">${sprocket(p.col)}<div><b>${p.human?'You':p.name}</b><p>${l.text}</p></div></div>`);chat.scrollTop=chat.scrollHeight;SND.ready&&SND.fx.blip();
    if(i<lines.length)setTimeout(say,voted?250:1250)};
  setTimeout(say,450);
  const onVote=e=>{const b=e.target.closest('[data-mv]');if(!b||voted)return;voted=true;sheetBody.removeEventListener('click',onVote);
    const you=b.dataset.mv==='skip'?'skip':+b.dataset.mv;SND.ready&&SND.fx.vote();
    sheetBody.querySelectorAll('[data-mv]').forEach(x=>{x.disabled=true});b.classList.add('mine');
    const v={0:you,...bv},order=[0,...Object.keys(bv).map(Number)];
    const reveal=(k)=>{if(k<order.length){const pid=order[k],x=v[pid],slot=$(x==='skip'?'vcskip':'vc'+x);if(slot)slot.insertAdjacentHTML('beforeend',sprocket(S.players[pid].col));SND.ready&&SND.fx.vote();setTimeout(()=>reveal(k+1),450);return}
      const res=applyResult(tally(v),v);render();SND.ready&&SND.fx.verdict(res.good!==false);
      $('mres').innerHTML=`<div class="note verdict">${res.ej==null?'':'<b>Ejected.</b> '}${res.txt}</div><button class="btn primary full" data-mcont>Continue</button>`;
      $('mres').querySelector('[data-mcont]').onclick=()=>{S.meeting=null;S.locked=false;closeSheet(true);render();done()}};
    const wait=()=>{if(i<lines.length)setTimeout(wait,300);else setTimeout(()=>reveal(0),450)};wait()};
  sheetBody.addEventListener('click',onVote);
}
async function botSabotage(p){""")
rep("$('meetBtn').onclick=()=>openMeeting();", "$('meetBtn').onclick=()=>humanMeeting();")
rep("  if(k==='r')openMeeting();", "  if(k==='r')humanMeeting();")
rep("  else if(S.locked&&!S.pending){st.className='status wait';",
    "  else if(S.meeting){st.className='status final';st.innerHTML='<span class=\"dot\"></span>Emergency meeting. Read the room, then vote.'}\n  else if(S.locked&&!S.pending){st.className='status wait';")
rep("function musicMood(){return S&&S.lastTurns!==null&&!S.over?'tense':'calm'}",
    "function musicMood(){return !S||S.over?'calm':S.meeting?'meeting':(S.lastTurns!==null||S.routes.some(r=>r.blocked))?'tense':'calm'}")
rep("    const task=canAct()&&reachable(nc.id)&&!S.tasksDone[nc.id]&&!S.taskUsed;",
    "    const task=!S.over&&!S.locked&&reachable(nc.id)&&!S.tasksDone[nc.id]&&!S.taskUsed;")
rep("    if(u>=1){R.root.visible=false;if(!A.splashed){A.splashed=true;fx.splash(A.ej[2],A.ej[3])}return}",
    "    if(u>=1){R.root.visible=false;if(!A.splashed){A.splashed=true;fx.splash(A.ej[2],A.ej[3]);SND.ready&&SND.fx.splash()}return}")
rep("    const d=Math.hypot(A.x,A.z)||1,k=95/d;A.ejectT=clock();", "    SND.ready&&SND.fx.eject();const d=Math.hypot(A.x,A.z)||1,k=95/d;A.ejectT=clock();")
rep("  <li><b>Station tasks</b>: in a city you’ve connected, answer a question about its landmark (one task per turn) for a locomotive card or a robot’s alibi.</li>\n  <li><b>Emergency meeting</b> (<span class=\"keys\">R</span> or the red button): once per game, after the first sabotage, vote a suspect off the map. +15 if it’s the saboteur, −5 if it isn’t. A saboteur who’s never caught earns +10.</li>",
    "  <li><b>Station tasks</b>: in a city you’ve connected, answer a question about its landmark (one per round, any time, even while the robots move) for a locomotive card or a robot’s alibi.</li>\n  <li><b>Meetings</b>: robots who saw something call emergency meetings, and you can call one yourself (<span class=\"keys\">R</span> or the red button, once per game). Everyone says what they saw. Innocent robots tell the truth; the saboteur lies, frames someone, and may invent where it was, so check claims against the ship log. Then everyone votes: two votes with a clear lead ejects that robot. +15 if you vote out the saboteur, −5 if you vote out an innocent. A saboteur who’s never caught earns +10.</li>")
rep(".vote:disabled{opacity:.4;cursor:default}", """.vote:disabled{opacity:.55;cursor:default}
.chat{display:flex;flex-direction:column;gap:7px;margin:8px 0 12px;max-height:34vh;overflow:auto}
.say{display:flex;gap:9px;align-items:flex-start;background:var(--card);border-radius:12px;padding:8px 10px;animation:up .2s ease-out}
.say>svg{width:22px;height:30px;flex:none}
.say b{font-family:'Fredoka';font-weight:600;font-size:14px}
.sheet .say p{margin:0;font-size:14.5px}
.note.ev{font-size:13px;border-left:4px solid var(--danger)}
.chips{display:flex;gap:2px;justify-content:center;min-height:22px;margin-top:4px;flex-wrap:wrap}
.vote .chips svg,.btn .chips svg{width:14px;height:19px;margin:0;display:inline-block}
.btn .chips{display:inline-flex;vertical-align:middle;margin:0 0 0 6px}
.vote.mine,.btn.mine{outline:3px solid var(--accent);outline-offset:2px}
.note.verdict{font-size:16px;font-weight:800}""")
rep("  botSabotage,openMeeting,vote,answer,reward,openLog,meetingOpen,", "  botSabotage,openMeeting,vote,answer,reward,openLog,meetingOpen,humanMeeting,runMeeting,botWantsMeeting,SND,")

open(f"{D}/junction3d-saboteur.template.html", "w").write(s)
print("wrote junction3d-saboteur.template.html", len(s.splitlines()), "lines")
