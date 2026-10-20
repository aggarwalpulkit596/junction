"""Navigation aids for the 3D template: a live minimap (tap to walk), ticket shortcuts, coast-sliding movement,
wider rail/city corridors, and city labels that stay readable when zoomed out. Refuses to run twice."""
import os
D = os.path.dirname(os.path.abspath(__file__))
p = f"{D}/junction3d.template.html"; s = open(p).read()
assert "id=\"minimap\"" not in s, "navigation already added"
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

rep('  <div class="panel mini"><div class="mh">Floating cards <small>tap to walk</small></div><div id="mkt"></div></div>',
    '  <div class="panel mini mapmini"><canvas id="minimap" width="784" height="600" aria-label="Minimap of Europe. Tap to walk there."></canvas></div>\n'
    '  <div class="panel mini"><div class="mh">Floating cards <small>tap to walk</small></div><div id="mkt"></div></div>')
rep(".mkrow{display:flex;", "#hudLeft{width:196px}\n.mapmini{padding:5px}\n#minimap{width:100%;display:block;border-radius:10px;cursor:pointer;touch-action:none}\n.ticket[data-walkt]{cursor:pointer}\n.mkrow{display:flex;")
rep("  #hudLeft{width:150px;", "  #hudLeft{width:150px;")
# wider corridors: easier to stay on the rails and in cities
rep("const onTrack=(x,z,w=2.6)=>", "const onTrack=(x,z,w=3.3)=>")
rep("const nearCityAny=(x,z,r=4.5)=>", "const nearCityAny=(x,z,r=6)=>")
# keyboard walking: slide around coastlines instead of stopping
rep("    if(walkable(nx,nz)){A.x=nx;A.z=nz}else if(walkable(nx,A.z)){A.x=nx;vz=0}else if(walkable(A.x,nz)){A.z=nz;vx=0}else{vx=vz=0}",
    """    if(walkable(nx,nz)){A.x=nx;A.z=nz}else if(walkable(nx,A.z)){A.x=nx;vz=0}else if(walkable(A.x,nz)){A.z=nz;vx=0}
    else{let ok=false;for(const a of [.6,-.6,1.1,-1.1]){const c=Math.cos(a),s2=Math.sin(a),rx=vx*c-vz*s2,rz=vx*s2+vz*c;if(walkable(A.x+rx*speed,A.z+rz*speed)){A.x+=rx*speed;A.z+=rz*speed;vx=rx;vz=rz;ok=true;break}}if(!ok)vx=vz=0}""")
# tickets: tap to walk to the nearer end
rep("""$('tickets').innerHTML=p.tickets.length?p.tickets.map((t,i)=>`<div class="ticket ${det[i]?'ok':''}">""",
    """$('tickets').innerHTML=p.tickets.length?p.tickets.map((t,i)=>`<div class="ticket ${det[i]?'ok':''}" data-walkt="${t.a}|${t.b}" title="Walk there">""")
rep("$('mkt').addEventListener('click',", """$('tickets').addEventListener('click',e=>{const b=e.target.closest('[data-walkt]');if(!b||sheetOpen())return;const A=ACT[0],[a,c]=b.dataset.walkt.split('|');
  const id=Math.hypot(A.x-WX(a),A.z-WZ(a))<Math.hypot(A.x-WX(c),A.z-WZ(c))?a:c;humanWalk(WX(id),WZ(id));$('tixPanel').hidden=true;$('mytixBtn').setAttribute('aria-expanded','false')});
$('mkt').addEventListener('click',""")
# the minimap
rep("/* ---- main loop ---- */", r"""/* ---- minimap: the whole continent at a glance; tap to walk there ---- */
const MM=$('minimap'),mm=MM.getContext('2d'),MK=2;let mmBase=null,mmT=0;
function mmBuild(){
  mmBase=document.createElement('canvas');mmBase.width=MM.width;mmBase.height=MM.height;const x=mmBase.getContext('2d');x.scale(MK,MK);
  x.fillStyle='#6fc3ea';x.fillRect(0,0,392,300);x.fillStyle='#f3df9f';x.strokeStyle='#1c1d33';x.lineWidth=.8;x.lineJoin='round';
  const poly=P=>{x.beginPath();P.forEach(([wx,wz],i)=>i?x.lineTo(wx+196,wz+150):x.moveTo(wx+196,wz+150));x.closePath()};
  LANDPOLY.forEach(P=>{poly(P);x.fill();x.stroke()});x.fillStyle='#6fc3ea';poly(SEAPOLY);x.fill();x.stroke();
}
function drawMinimap(){
  if(!S)return;if(!mmBase)mmBuild();
  mm.setTransform(1,0,0,1,0,0);mm.drawImage(mmBase,0,0);mm.setTransform(MK,0,0,MK,0,0);
  const P=(id)=>[C[id].x,C[id].y];
  S.routes.forEach(r=>{const[a1,a2]=P(r.a),[b1,b2]=P(r.b);mm.beginPath();mm.moveTo(a1,a2);mm.lineTo(b1,b2);
    if(r.blocked){mm.setLineDash([3,2]);mm.strokeStyle='#ff3b4f';mm.lineWidth=3}else if(r.owner!==null){mm.setLineDash([]);mm.strokeStyle=PLAYERS[r.owner].col;mm.lineWidth=3.2}
    else{mm.setLineDash([]);mm.strokeStyle=HEX[r.color];mm.globalAlpha=.55;mm.lineWidth=1.6}
    mm.stroke();mm.globalAlpha=1;mm.setLineDash([])});
  const own0=new Set();S.routes.forEach(r=>{if(r.owner===0){own0.add(r.a);own0.add(r.b)}});
  IDS.forEach(id=>{const[x,y]=P(id);mm.beginPath();mm.arc(x,y,2.6,0,7);mm.fillStyle=own0.has(id)?'#ffc933':'#fff';mm.fill();mm.lineWidth=.8;mm.strokeStyle='#1c1d33';mm.stroke()});
  // your unfinished ticket cities
  const det=H().tickets.length?ticketScore(H()).det:[];H().tickets.forEach((t,i)=>{if(det[i])return;[t.a,t.b].forEach(id=>{const[x,y]=P(id);mm.beginPath();mm.arc(x,y,6+Math.sin(clockMM()*4)*1,0,7);mm.strokeStyle='#e8a400';mm.lineWidth=1.8;mm.stroke()})});
  // floating cards
  S.market.forEach((c,i)=>{if(!c)return;const[x,y]=P(S.marketCity[i]);mm.save();mm.translate(x,y-7);mm.rotate(Math.PI/4);mm.fillStyle=c==='loco'?'#ffc933':HEX[c];mm.fillRect(-2.6,-2.6,5.2,5.2);mm.lineWidth=.8;mm.strokeStyle='#1c1d33';mm.strokeRect(-2.6,-2.6,5.2,5.2);mm.restore()});
  // what the camera sees
  const hw=Math.max(18,CAM.cur*.42*Math.min(1.6,camera.aspect)),hh=Math.max(14,CAM.cur*.5);
  mm.strokeStyle='rgba(28,29,51,.55)';mm.lineWidth=1;mm.strokeRect(CAM.x+196-hw,CAM.z+150-hh*.75,hw*2,hh*1.4);
  // robots
  ACT.forEach((A,i)=>{if(S.players[i].alive===false)return;const x=A.x+196,y=A.z+150,me=i===0;mm.beginPath();mm.arc(x,y,me?5:3.8,0,7);mm.fillStyle=PLAYERS[i].col;mm.fill();mm.lineWidth=me?1.6:1;mm.strokeStyle=me?'#fff':'#1c1d33';mm.stroke();if(me){mm.beginPath();mm.arc(x,y,6.6,0,7);mm.strokeStyle='#1c1d33';mm.lineWidth=.9;mm.stroke()}});
}
const clockMM=()=>performance.now()/1000;
MM.addEventListener('click',e=>{if(!S||S.locked||sheetOpen())return;const r=MM.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*392-196,z=(e.clientY-r.top)/r.height*300-150;
  if(!walkable(x,z)){const c=nearestCity(x,z);x=WX(c.id);z=WZ(c.id)}
  if(CAM.map){CAM.map=false;$('mapBtn').setAttribute('aria-pressed','false')}humanWalk(x,z)});

/* ---- main loop ---- */""")
rep("    uiT-=dt;if(uiT<=0){uiT=.1;stepUI();", "    mmT-=dt;if(mmT<=0){mmT=.15;drawMinimap()}\n    // city names grow as you zoom out, so the overview stays readable\n    {const k=Math.max(.85,Math.min(2.6,CAM.cur/105));if(Math.abs(k-(world.lk||0))>.02){world.lk=k;IDS.forEach(id=>{const l=CITY3[id].lbl;if(!l.userData.base)l.userData.base=[l.scale.x,l.scale.y];l.scale.set(l.userData.base[0]*k,l.userData.base[1]*k,1);l.position.y=4.4+(k-1)*2})}}\n    uiT-=dt;if(uiT<=0){uiT=.1;stepUI();")
rep("  <li><b>Walk</b> your robot with", "  <li><b>Find your way</b> with the minimap (top left): tap it to walk anywhere. Tap one of your tickets to head for it, or a floating card to fetch it.</li>\n  <li><b>Walk</b> your robot with")
open(p, "w").write(s)
print("navigation added")
