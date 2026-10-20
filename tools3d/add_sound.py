"""Adds synthesized sound (Web Audio), adaptive music, sound/music toggles and a fast-bots toggle to junction3d.template.html.
Refuses to run twice."""
import os
D = os.path.dirname(os.path.abspath(__file__))
p = f"{D}/junction3d.template.html"; s = open(p).read()
assert "const SND=" not in s, "sound already added"
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# ---------- HUD buttons
rep('  <button class="iconbtn" id="zin" aria-label="Zoom in">+</button>',
    '  <button class="iconbtn" id="sndBtn" aria-label="Sound effects" aria-pressed="true">🔊</button>\n'
    '  <button class="iconbtn" id="musBtn" aria-label="Music" aria-pressed="true">♪</button>\n'
    '  <button class="iconbtn" id="ffBtn" aria-label="Fast bots (F)" aria-pressed="false">⏩</button>\n'
    '  <button class="iconbtn" id="zin" aria-label="Zoom in">+</button>')
rep("#hudRight .iconbtn{font-size:15px}", "#hudRight .iconbtn{font-size:15px}\n#hudRight .iconbtn[aria-pressed=\"false\"]{opacity:.5}\n#hudRight #ffBtn[aria-pressed=\"true\"]{background:var(--accent);opacity:1}")

# ---------- the sound engine
rep("/* ===================================================================== 3D WORLD */", r'''/* ===================================================================== SOUND (synthesized with Web Audio: no files) */
const SND=(()=>{
  let ctx=null,sfx=null,mus=null,NB=null,nextT=0,step=0,mood='calm';
  const on={sfx:true,music:true};
  try{Object.assign(on,JSON.parse(localStorage.getItem('junction3d-sound')||'{}'))}catch(e){}
  const save=()=>{try{localStorage.setItem('junction3d-sound',JSON.stringify(on))}catch(e){}};
  const N=n=>440*Math.pow(2,(n-69)/12);
  function init(){
    if(FAST)return;
    if(ctx){if(ctx.state==='suspended')ctx.resume();return}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.connect(ctx.destination);
    sfx=ctx.createGain();sfx.gain.value=on.sfx?.8:0;sfx.connect(comp);
    mus=ctx.createGain();mus.gain.value=on.music?.2:0;mus.connect(comp);
    NB=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    setInterval(schedule,90);
  }
  function tone(f,o={}){
    if(!ctx)return;const t=ctx.currentTime+(o.at||0),a=o.a||.005,d=o.d||.25,g=o.g||.2;
    const osc=ctx.createOscillator(),v=ctx.createGain();osc.type=o.type||'sine';osc.frequency.setValueAtTime(f,t);
    if(o.glide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,f*o.glide),t+a+d);
    v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+a);v.gain.exponentialRampToValueAtTime(.0001,t+a+d);
    osc.connect(v);let out=v;if(o.lp){const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=o.lp;v.connect(fl);out=fl}
    out.connect(o.bus||sfx);osc.start(t);osc.stop(t+a+d+.05);
  }
  function noise(o={}){
    if(!ctx)return;const t=ctx.currentTime+(o.at||0),a=o.a||.004,d=o.d||.15,g=o.g||.15;
    const src=ctx.createBufferSource();src.buffer=NB;const fl=ctx.createBiquadFilter();fl.type=o.type||'bandpass';fl.frequency.setValueAtTime(o.f||2000,t);
    if(o.sweep)fl.frequency.exponentialRampToValueAtTime((o.f||2000)*o.sweep,t+a+d);fl.Q.value=o.q||1;
    const v=ctx.createGain();v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+a);v.gain.exponentialRampToValueAtTime(.0001,t+a+d);
    src.connect(fl);fl.connect(v);v.connect(o.bus||sfx);src.start(t,Math.random()*.5);src.stop(t+a+d+.05);
  }
  const fx={
    click(){tone(1500,{type:'triangle',d:.04,g:.05})},
    step(k){noise({d:.045,g:.06*k,f:700+Math.random()*500,q:2.5})},
    pickup(k=1){tone(N(84),{type:'triangle',d:.16,g:.22*k});tone(N(91),{type:'triangle',d:.3,g:.2*k,at:.07})},
    deck(){noise({d:.13,g:.16,f:3200,sweep:.35,q:.8})},
    claim(len,k=1){for(let i=0;i<len;i++){noise({d:.05,g:.2*k,f:1300,q:3,at:i*.09});tone(N(67+[0,4,7,12,16,19][i%6]),{type:'triangle',d:.2,g:.16*k,at:i*.09+.02})}},
    flip(i){noise({d:.06,g:.16,f:4000,sweep:.5,q:1.5,at:i*.16})},
    tunnel(bad){[0,1,2].forEach(fx.flip);if(bad)tone(98,{type:'sawtooth',d:.4,g:.12,lp:700,at:.55});else{tone(N(79),{type:'triangle',d:.25,g:.16,at:.55});tone(N(86),{type:'triangle',d:.35,g:.14,at:.65})}},
    ticket(){noise({d:.22,g:.1,f:2600,q:.6})},
    ticketDone(){[72,76,79,84].forEach((n,i)=>tone(N(n),{type:'triangle',d:.3,g:.18,at:i*.1}))},
    station(){tone(N(52),{type:'square',d:.14,g:.12,lp:900});tone(N(88),{d:.7,g:.12,at:.08});tone(N(95),{d:.6,g:.07,at:.12})},
    chime(){tone(N(88),{d:.45,g:.05});tone(N(95),{d:.55,g:.04,at:.06})},
    yourTurn(){tone(N(76),{type:'triangle',d:.22,g:.13});tone(N(72),{type:'triangle',d:.35,g:.13,at:.16})},
    finalRound(){[0,.22,.44].forEach(a=>tone(N(81),{type:'square',d:.1,g:.07,lp:2200,at:a}))},
    win(){[[72,0],[76,.12],[79,.24],[84,.36],[79,.52],[84,.64]].forEach(([n,a])=>tone(N(n),{type:'triangle',d:.35,g:.2,at:a}));tone(N(48),{d:1.2,g:.2,at:.36})},
    lose(){[[67,0],[63,.25],[60,.5],[55,.8]].forEach(([n,a])=>tone(N(n),{type:'triangle',d:.45,g:.16,at:a}))},
    sabotage(){tone(320,{type:'sawtooth',d:.9,g:.14,glide:.12,lp:1500});[0,1,2,3].forEach(i=>tone(i%2?587:740,{type:'sawtooth',d:.24,g:.09,lp:2400,at:.7+i*.26}));for(let i=0;i<8;i++)noise({d:.03,g:.14,f:5000,q:3,at:.1+Math.random()*.6})},
    meeting(){[0,.16].forEach(a=>tone(880,{type:'square',d:.12,g:.1,lp:3000,at:a}));tone(110,{type:'sawtooth',d:.6,g:.16,lp:500,at:.3});noise({d:.08,g:.25,f:300,q:1,at:.3})},
    blip(){tone(N(90+Math.floor(Math.random()*6)),{type:'square',d:.03,g:.035,lp:3000})},
    vote(){tone(170,{type:'square',d:.1,g:.12,lp:700});noise({d:.05,g:.12,f:600,q:2})},
    verdict(good){if(good)[0,4,7,12].forEach((n,i)=>tone(N(72+n),{type:'triangle',d:.4,g:.17,at:i*.09}));else{tone(N(50),{type:'sawtooth',d:1.1,g:.15,lp:600});tone(N(53),{type:'sawtooth',d:1.1,g:.12,lp:600})}},
    eject(){noise({d:1.2,g:.2,f:500,sweep:6,q:1.2})},
    splash(){noise({d:.7,g:.22,type:'lowpass',f:1200,sweep:.3,a:.01})},
  };
  // adaptive music: a soft 8th-note loop (calm), a pulsing minor groove (tense), a heartbeat (meeting)
  const PROG={calm:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],tense:[[57,60,64],[53,57,60],[50,53,57],[52,56,59]]};
  function schedule(){
    if(!ctx||!on.music)return;const spb=.3;
    if(nextT<ctx.currentTime)nextT=ctx.currentTime+.05;
    while(nextT<ctx.currentTime+.3){
      const at=nextT-ctx.currentTime,s=step%8,bar=Math.floor(step/8)%4,b={bus:mus};
      if(mood==='meeting'){if(s===0||s===4){tone(55,{...b,d:.12,g:.5,at});tone(52,{...b,d:.12,g:.35,at:at+.18})}if(s===0)tone(N(81),{...b,type:'triangle',d:1.1,g:.05,at})}
      else{const ch=(mood==='tense'?PROG.tense:PROG.calm)[bar];
        if(mood==='tense'){tone(N(ch[0]-24),{...b,type:'sawtooth',d:.14,g:.12,lp:420,at});if(s%2===0)noise({...b,d:.025,g:.05,f:7000,q:2,at});if(s===0)tone(N(ch[2]+12),{...b,type:'triangle',d:.9,g:.06,at})}
        else{tone(N(ch[[0,1,2,1,0,2,1,2][s]]+12),{...b,type:'triangle',d:.22,g:.07,at});if(s===0)tone(N(ch[0]-24),{...b,d:1.1,g:.22,at});if(s===4)tone(N(ch[2]-24),{...b,d:.6,g:.14,at});if(s===2||s===6)noise({...b,d:.02,g:.025,f:8000,q:2,at})}}
      nextT+=spb;step++;
    }
  }
  return{init,fx,on,
    setMood(m){mood=m},
    toggle(k){on[k]=!on[k];save();if(ctx){(k==='sfx'?sfx:mus).gain.setTargetAtTime(on[k]?(k==='sfx'?.8:.2):0,ctx.currentTime,.05)}},
    get ready(){return !!ctx&&on.sfx}};
})();
/* fast bots: they hurry through their turns so you wait less (F) */
let FF=false;try{FF=localStorage.getItem('junction3d-ff')==='1'}catch(e){}

/* ===================================================================== 3D WORLD */''')
rep("addEventListener('keyup',e=>KEYS.delete(e.key.toLowerCase()));",
    "addEventListener('keyup',e=>KEYS.delete(e.key.toLowerCase()));\naddEventListener('pointerdown',()=>SND.init(),true);addEventListener('keydown',()=>SND.init(),true);\ndocument.addEventListener('click',e=>{if(e.target.closest('button'))SND.ready&&SND.fx.click()},true);")
rep("  if(k==='m')$('mapBtn').click();", "  if(k==='m')$('mapBtn').click();\n  if(k==='f')$('ffBtn').click();")
rep("$('zin').onclick=()=>zoom(-18);$('zout').onclick=()=>zoom(18);",
    """$('zin').onclick=()=>zoom(-18);$('zout').onclick=()=>zoom(18);
const syncSoundBtns=()=>{$('sndBtn').setAttribute('aria-pressed',SND.on.sfx);$('sndBtn').textContent=SND.on.sfx?'🔊':'🔇';$('musBtn').setAttribute('aria-pressed',SND.on.music);$('ffBtn').setAttribute('aria-pressed',FF)};
$('sndBtn').onclick=()=>{SND.init();SND.toggle('sfx');syncSoundBtns()};
$('musBtn').onclick=()=>{SND.init();SND.toggle('music');syncSoundBtns()};
$('ffBtn').onclick=()=>{FF=!FF;try{localStorage.setItem('junction3d-ff',FF?'1':'0')}catch(e){}syncSoundBtns()};
syncSoundBtns();""")
rep("$('deckBtn').onclick=takeDeck;", "$('deckBtn').onclick=()=>takeDeck();")

# ---------- fast bots
rep("const speed=(A.id===0?24:busyBot?(A.path&&A.path.length>2?80:50):18)*dt;",
    "const speed=(A.id===0?24:busyBot?(A.path&&A.path.length>2?80:50)*(FF?2.4:1):18)*dt;")
rep("  await sleep(200);\n  if(g!==GEN||S.over)return;\n  await botTurn(q);", "  await sleep(FF?60:200);\n  if(g!==GEN||S.over)return;\n  await botTurn(q);")

# ---------- event sounds
rep("  if(q.human){S.busy=false;render();return}", "  if(q.human){S.busy=false;render();SND.ready&&SND.fx.yourTurn();return}")
rep("{S.lastTurns=S.players.length+1;addLog(", "{S.lastTurns=S.players.length+1;SND.ready&&SND.fx.finalRound();addLog(")
rep("  pickup(city,c){if(FAST)return;", "  pickup(city,c){if(FAST)return;if(SND.ready){const d=Math.hypot(WX(city)-CAM.x,WZ(city)-CAM.z);SND.fx.pickup(Math.max(.25,1-d/90))}")
rep("  S.routes.forEach((r,i)=>{const w=R3[i];if(w.owner!==r.owner){if(r.owner!==null&&w.owner===null)w.popT=now;w.owner=r.owner;",
    "  S.routes.forEach((r,i)=>{const w=R3[i];if(w.owner!==r.owner){if(r.owner!==null&&w.owner===null){w.popT=now;if(SND.ready){const[mx,mz]=routeMid(r);SND.fx.claim(r.len,r.owner===0?1:Math.max(.25,1-Math.hypot(mx-CAM.x,mz-CAM.z)/110))}}w.owner=r.owner;")
rep("    if(so!==undefined&&!c.station){c.station=stationMesh(PLAYERS[so].col);", "    if(so!==undefined&&!c.station){SND.ready&&SND.fx.station();c.station=stationMesh(PLAYERS[so].col);")
rep("  const det=H().tickets.length?ticketScore(H()).det:[];const tc=new Set();",
    "  const det=H().tickets.length?ticketScore(H()).det:[];const nDone=det.filter(Boolean).length;if(nDone>(world.done||0)&&!S.over)SND.ready&&SND.fx.ticketDone();world.done=nDone;const tc=new Set();")
rep("  if(S.over&&!wasOver)fx.confetti();wasOver=S.over;",
    "  if(S.over&&!wasOver){fx.confetti();SND.ready&&(/^Game over\\. You win/.test(S.log[0]&&S.log[0].t)?SND.fx.win():SND.fx.lose())}wasOver=S.over;")
rep("    const el=$('postcard');el.innerHTML=", "    SND.ready&&SND.fx.chime();const el=$('postcard');el.innerHTML=")
rep("  if(A.moving){A.dir=Math.atan2(vx,vz);A.phase+=dt*13}",
    "  if(A.moving){A.dir=Math.atan2(vx,vz);A.phase+=dt*13;const st=Math.floor(A.phase/Math.PI);if(st!==A.stepN){A.stepN=st;if(SND.ready&&!DIRON()){const k=A.id===0?1:Math.max(0,1-Math.hypot(A.x-CAM.x,A.z-CAM.z)/50)*.6;if(k>.05)SND.fx.step(k)}}}")
rep("/* ---- boot ---- */", """/* ---- sounds for rules that open sheets ---- */
{const sc=startClaim;startClaim=function(ri,o){sc(ri,o);if(S.pending&&SND.ready)SND.fx.tunnel(S.pending.extra>0)}}
{const ot=offerTickets;offerTickets=function(...a){ot(...a);SND.ready&&SND.fx.ticket()}}
{const td=takeDeck;takeDeck=function(){const n=Object.values(H().hand).reduce((a,b)=>a+b,0);td();if(Object.values(H().hand).reduce((a,b)=>a+b,0)>n)SND.ready&&SND.fx.deck()}}
/* ---- music mood ---- */
function musicMood(){return S&&S.lastTurns!==null&&!S.over?'tense':'calm'}
function DIRON(){return typeof DIR!=='undefined'&&DIR.on}

/* ---- boot ---- */""")
rep("    uiT-=dt;if(uiT<=0){uiT=.1;stepUI();stepPostcard();stepDistances()}",
    "    uiT-=dt;if(uiT<=0){uiT=.1;stepUI();stepPostcard();stepDistances();SND.setMood(musicMood())}")
rep("<li>Rose, Sandy and Mint walk to everything they claim, so you can watch where they’re heading. Walk into any city to read about its landmark.</li>",
    "<li>Rose, Sandy and Mint walk to everything they claim, so you can watch where they’re heading. Walk into any city to read about its landmark.</li>\n  <li>Sound: 🔊 effects and ♪ music are top right. Waiting on the robots? ⏩ (<span class=\"keys\">F</span>) makes them hurry.</li>")
open(p, "w").write(s)
print("sound added")
