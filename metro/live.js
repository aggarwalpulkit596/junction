/* Junction: Delhi Metro — Rush Hour Live, the real-time rules engine.
   Same map and passes as rules.js, no turns. Everybody plays at once for a 3-minute round, best of three:
   - every INCOME_MS the depot sends each driver one pass; extra passes float above stations and go to whichever
     train stands there first;
   - tap a free segment you can pay for and your train sets off at once (first tap takes it); segments touching your
     network are reached along your own track, anything else is a depot run (+1 pass of any kind);
   - trains take real time to travel, so you can't claim again until you arrive; you may shuttle along your own
     network for free to pick up floating passes;
   - Signal Failures close a random free segment for a while; everyone has one Jam per round.
   Scoring per round: segments 1/2/4/7, two secret tickets (+value if joined, −half if not), longest unbroken line +10.
   The commute is won on total.

   Imported as is by worker/index.js (game id 'live') and inlined into metro.html by mp/build.mjs (import/export lines
   stripped, so names must not clash with rules.js: makeLiveEngine, LIVE_MODES). Time is always passed in. */
import { LINES, COLS, PTS, C, IDS, SEGS, nm, shuffle, pick, dijkstra, SHORT, SEAT_COLS, BOT_NAMES, MAX_SEATS } from './rules.js';

export const LIVE_MODES={
  live:{id:'live',name:'Rush Hour Live',blurb:'3 rounds × 3 minutes, all at once',trains:24,turnSec:0,clockMin:10,
    roundSec:180,rounds:3,breakSec:10,maxTicket:7,missPenalty:.5,incomeMs:3400,spawnMs:2000,maxFloat:8,carMs:900,shuttleCarMs:320,
    failEveryMs:30000,failForMs:12000,jamForMs:20000,botThinkMs:1500,botLazy:.25},
};
export function makeLiveEngine(){
let S=null,EV=[],PACE=1;
const M=()=>LIVE_MODES[S.mode]||LIVE_MODES.live;
function addLog(t,k=''){S.log.unshift({t,k});S.log=S.log.slice(0,40);S.logN=(S.logN||0)+1}
function ev(e){EV.push(e)}
function draw(){if(!S.deck.length){S.deck=shuffle(S.discard);S.discard=[]}return S.deck.pop()||null}
function give(p,c){if(c)p.hand[c]=(p.hand[c]||0)+1}
const handN=p=>Object.values(p.hand).reduce((a,b)=>a+b,0);
const own=p=>S.segs.filter(s=>s.owner===p.id);
const routePts=pid=>S.segs.filter(s=>s.owner===pid).reduce((a,s)=>a+PTS[s.len],0);
const blocked=(s,now)=>!!(s.jam&&s.jam.until>now)||!!(S.fail&&S.fail.si===s.i&&S.fail.until>now);
function network(p){const n=new Set();S.segs.forEach(s=>{if(s.owner===p.id){n.add(s.a);n.add(s.b)}});return n}
const touches=(p,s)=>{const n=network(p);return n.size===0||n.has(s.a)||n.has(s.b)};
function connected(p,a,b){const o=own(p),seen=new Set([a]),q=[a];
  while(q.length){const u=q.shift();if(u===b)return true;for(const s of o){if(s.a!==u&&s.b!==u)continue;const v=s.a===u?s.b:s.a;if(!seen.has(v)){seen.add(v);q.push(v)}}}return false}
function longest(pid){const o=S.segs.filter(s=>s.owner===pid);let best=0;
  const go=(at,used,len)=>{best=Math.max(best,len);for(const s of o){if(used.has(s.i)||(s.a!==at&&s.b!==at))continue;used.add(s.i);go(s.a===at?s.b:s.a,used,len+s.len);used.delete(s.i)}};
  o.forEach(s=>{go(s.a,new Set(),0);go(s.b,new Set(),0)});return best}
// shortest way along your own track from `from` to `to`: {path:[stations], cars}
function ownPath(p,from,to){if(from===to)return{path:[from],cars:0};const d=dijkstra(own(p),from,to,s=>s.len);if(!d)return null;
  const path=[from];let at=from;d.path.forEach(s=>{at=s.a===at?s.b:s.a;path.push(at)});return{path,cars:d.cost}}
const livePts=p=>routePts(p.id)+p.tickets.reduce((a,t)=>a+(connected(p,t.a,t.b)?t.p:0),0);

/* ---- payment (as in rules.js, plus the depot-run extra pass `e`) ---- */
function payOptions(p,s,depot){
  const out=[],W=p.hand.W||0,cols=s.c==='any'?COLS:[s.c];
  for(const c of cols){const h=p.hand[c]||0;
    for(let n=Math.min(s.len,h);n>=0;n--){const w=s.len-n;if(w>W)continue;
      if(!depot){out.push({c,n,w,e:null});continue}
      if(h>=n+1)out.push({c,n,w,e:c});if(W>=w+1)out.push({c,n,w,e:'W'});
      for(const e of COLS)if(e!==c&&(p.hand[e]||0)>=1)out.push({c,n,w,e});
    }}
  out.sort((x,y)=>(x.w+(x.e==='W'?1:0))-(y.w+(y.e==='W'?1:0))||(y.n-x.n)||((p.hand[y.e]||0)-(p.hand[x.e]||0)));
  return out;
}
const sameOpt=(a,b)=>a&&b&&a.c===b.c&&a.n===b.n&&a.w===b.w&&(a.e||null)===(b.e||null);
function payPlan(p,o){const spend=(c,n)=>{p.hand[c]-=n;for(let i=0;i<n;i++)S.discard.push(c);if(!p.hand[c])delete p.hand[c]};
  if(o.n)spend(o.c,o.n);if(o.w)spend('W',o.w);if(o.e)spend(o.e,1)}

/* ===== setup ===== */
function newGame(seats,modeId,now,opts={}){
  const m=LIVE_MODES[modeId]||LIVE_MODES.live;
  S={game:'live',mode:m.id,solo:!!opts.solo,round:0,rounds:m.rounds,phase:'between',over:false,startedAt:now,
     deck:[],discard:[],floats:[],fail:null,nextIncome:0,nextSpawn:0,nextFail:0,roundStart:0,roundEnds:0,breakEnds:now,
     segs:[],log:[],logN:0,final:null,commute:null,lastTurns:null,turnEnds:null,clockEnds:now+m.clockMin*60000*m.rounds,
     players:seats.map((s,i)=>({id:i,name:s.name,col:SEAT_COLS[i],bot:!!s.bot,away:false,hand:{},trains:m.trains,tickets:[],jam:true,at:null,moving:null,wins:0,totals:[],nextThink:0}))};
  addLog(`${m.name}: ${m.rounds} rounds of ${m.roundSec/60} minutes. Everyone drives at once.`);
  newRound(now);
  return S;
}
function newRound(now){
  const m=M();S.round++;S.phase='play';S.roundStart=now;S.roundEnds=now+m.roundSec*1000;S.breakEnds=0;S.final=null;
  const units={};COLS.forEach(c=>units[c]=0);SEGS.forEach(s=>{if(s.c!=='any')units[s.c]+=s.len;else COLS.forEach(c=>units[c]+=s.len/COLS.length)});
  const deck=[];COLS.forEach(c=>{const n=Math.max(7,Math.round(units[c]*.62));for(let i=0;i<n;i++)deck.push(c)});for(let i=0;i<12;i++)deck.push('W');
  S.deck=shuffle(deck);S.discard=[];S.floats=[];S.fail=null;
  S.segs=SEGS.map(s=>({i:s.i,a:s.a,b:s.b,len:s.len,c:s.c,line:s.line,owner:null,jam:null}));
  const shorts=shuffle(SHORT.filter(t=>t.p<=m.maxTicket));
  S.players.forEach(p=>{p.hand={};for(let k=0;k<4;k++)give(p,draw());p.trains=m.trains;p.tickets=shorts.splice(-2);p.jam=true;p.at=null;p.moving=null;p.nextThink=now+600+Math.random()*900});
  S.nextIncome=now+m.incomeMs;S.nextSpawn=now+800;S.nextFail=now+m.failEveryMs;
  for(let k=0;k<4;k++)spawn(now,true);
  addLog(`Round ${S.round} of ${S.rounds}: go!`,'good');ev({k:'round',n:S.round});
}
function spawn(now,quiet){
  const taken=new Set(S.floats.map(f=>f.id)),free=IDS.filter(id=>!taken.has(id));if(!free.length)return;
  const id=pick(free),c=draw();if(!c)return;S.floats.push({id,c});if(!quiet)ev({k:'spawn',id,c});
  grabAt(id,now);
}
// a pass floating where a train stands goes to that train (earliest arrival wins)
function grabAt(id,now){
  const fi=S.floats.findIndex(f=>f.id===id);if(fi<0)return;
  const here=S.players.filter(p=>p.at===id&&!p.moving).sort((a,b)=>(a.arrived||0)-(b.arrived||0));if(!here.length)return;
  const p=here[0],f=S.floats.splice(fi,1)[0];give(p,f.c);ev({k:'grab',s:p.id,id,c:f.c});
}

/* ===== actions ===== */
const err=msg=>({ok:false,err:msg}),done=()=>({ok:true});
function act(seat,a,now){
  S.now=now;const p=S.players[seat],m=M();
  if(!p||!a||typeof a.t!=='string')return err('Bad action.');
  if(S.over)return err('The commute is over.');
  if(S.phase!=='play')return err('Next round is about to start.');
  if(a.t==='jam'){
    const s=S.segs[a.si|0];if(!s)return err('No such segment.');
    if(!p.jam)return err('You’ve used your Jam this round.');
    if(s.owner!==null)return err('You can only jam a free segment.');
    if(blocked(s,now))return err('That segment is already closed.');
    s.jam={s:seat,until:now+m.jamForMs};p.jam=false;ev({k:'jam',s:seat,si:s.i});
    addLog(`${p.name} jammed ${nm(s.a)} to ${nm(s.b)}.`,'danger');return done();
  }
  if(p.moving)return err('Your train is still moving.');
  if(a.t==='go'){
    const id=a.id;if(!C[id])return err('No such station.');if(!p.at)return err('Drive a segment first.');
    const w=ownPath(p,p.at,id);if(!w)return err('Your track doesn’t reach there.');if(w.cars===0)return done();
    p.moving={path:w.path,t0:now,t1:now+w.cars*m.shuttleCarMs*PACE,si:null};ev({k:'go',s:seat,path:w.path,t0:p.moving.t0,t1:p.moving.t1});return done();
  }
  if(a.t==='drive'){
    const s=S.segs[a.si|0];if(!s)return err('No such segment.');
    if(s.owner!==null)return err('Too late, that segment is taken.');
    if(blocked(s,now))return err(S.fail&&S.fail.si===s.i?'Signal failure: closed for now.':'Jammed: closed for now.');
    if(p.trains<s.len)return err(`You only have ${p.trains} train${p.trains===1?'':'s'} left.`);
    const depot=!touches(p,s),opts=payOptions(p,s,depot);
    const o=a.o?opts.find(x=>sameOpt(x,a.o)):opts[0];if(!o)return err(depot?'A depot run costs one extra pass.':`You need ${s.len} ${s.c==='any'?'matching':LINES[s.c].name} pass${s.len>1?'es':''}.`);
    let path=[s.a,s.b],shuttle=0;
    if(!depot&&p.at){const wa=ownPath(p,p.at,s.a),wb=ownPath(p,p.at,s.b);const w=[wa,wb].filter(Boolean).sort((x,y)=>x.cars-y.cars)[0];
      if(w){const end=w.path[w.path.length-1];path=w.path.concat(end===s.a?s.b:s.a);shuttle=w.cars}}
    payPlan(p,o);s.owner=seat;p.trains-=s.len;
    p.moving={path,t0:now,t1:now+(shuttle*m.shuttleCarMs+s.len*m.carMs)*PACE,si:s.i};
    ev({k:'drive',s:seat,si:s.i,path,t0:p.moving.t0,t1:p.moving.t1,depot});
    addLog(`${p.name} drove ${nm(s.a)} to ${nm(s.b)} (${s.line}, +${PTS[s.len]}).`);
    return done();
  }
  return err('Unknown action.');
}

/* ===== the clock ===== */
function arrive(p,now){const end=p.moving.path[p.moving.path.length-1];p.at=end;p.moving=null;p.arrived=now;grabAt(end,now)}
function endRound(now){
  const lens=S.players.map(p=>longest(p.id)),maxL=Math.max(...lens);
  const rows=S.players.map((p,k)=>{let tp=0;const det=p.tickets.map(t=>{const ok=connected(p,t.a,t.b);tp+=ok?t.p:-Math.ceil(t.p*M().missPenalty);return ok});
    const rp=routePts(p.id),ex=(maxL>0&&lens[k]===maxL)?10:0;return{s:p.id,rp,tp,ex,total:rp+tp+ex,len:lens[k],det,tickets:p.tickets}}).sort((a,b)=>b.total-a.total||b.rp-a.rp);
  S.final={round:S.round,rows,maxL};
  rows.forEach(r=>S.players[r.s].totals.push(r.total));
  const w=S.players[rows[0].s];w.wins++;
  S.players.forEach(p=>{p.moving=null});
  addLog(`Round ${S.round}: ${w.name} wins with ${rows[0].total}.`,'good');ev({k:'roundEnd',n:S.round});
  if(S.round>=S.rounds){
    S.commute=S.players.map(p=>({s:p.id,total:p.totals.reduce((a,b)=>a+b,0),wins:p.wins,totals:p.totals})).sort((a,b)=>b.total-a.total||b.wins-a.wins);
    S.over=true;S.phase='over';addLog(`Commute over. ${S.players[S.commute[0].s].name} wins with ${S.commute[0].total} points.`,'good');ev({k:'over'});
  }else{S.phase='between';S.breakEnds=now+M().breakSec*1000;S.roundEnds=0}
}
function tick(now){
  EV=[];S.now=now;const m=M();
  if(S.over)return EV;
  if(S.phase==='between'){if(now>=S.breakEnds)newRound(now);else return EV}
  // arrivals
  S.players.forEach(p=>{if(p.moving&&now>=p.moving.t1)arrive(p,now)});
  // income and floating passes
  let guard=0;while(now>=S.nextIncome&&guard++<10){S.players.forEach(p=>{const c=draw();if(c){give(p,c);ev({k:'income',s:p.id,c})}});S.nextIncome+=m.incomeMs*PACE}
  guard=0;while(now>=S.nextSpawn&&guard++<10){if(S.floats.length<m.maxFloat)spawn(now);S.nextSpawn+=m.spawnMs*PACE}
  // closures
  S.segs.forEach(s=>{if(s.jam&&s.jam.until<=now)s.jam=null});
  if(S.fail&&S.fail.until<=now)S.fail=null;
  if(now>=S.nextFail){S.nextFail=now+m.failEveryMs*PACE;const free=S.segs.filter(s=>s.owner===null&&!s.jam);
    if(free.length&&S.roundEnds-now>m.failForMs){const s=pick(free);S.fail={si:s.i,until:now+m.failForMs};ev({k:'fail',si:s.i});addLog(`Signal failure between ${nm(s.a)} and ${nm(s.b)}.`,'danger')}}
  // robots (and humans who are away)
  S.players.forEach(p=>{if(!(p.bot||p.away)||now<p.nextThink)return;p.nextThink=now+(m.botThinkMs*(.7+Math.random()*.6))*PACE;
    if(p.moving||Math.random()<m.botLazy)return;const a=botNext(p,now);if(a)act(p.id,a,now)});
  // round end
  const dead=S.players.every(p=>p.trains<=0||!S.segs.some(s=>s.owner===null&&s.len<=p.trains));
  if(now>=S.roundEnds||dead||S.segs.every(s=>s.owner!==null))endRound(now);
  return EV;
}
function nextWake(now){
  if(!S||S.over)return null;
  if(S.phase==='between')return S.breakEnds;
  const ts=[S.roundEnds,S.nextIncome,S.nextSpawn,S.nextFail];
  if(S.fail)ts.push(S.fail.until);S.segs.forEach(s=>{if(s.jam)ts.push(s.jam.until)});
  S.players.forEach(p=>{if(p.moving)ts.push(p.moving.t1);if(p.bot||p.away)ts.push(p.nextThink)});
  return Math.max(now+40,Math.min(...ts.filter(t=>t>0)));
}

/* ===== robots ===== */
function wanted(p,now){
  const want=new Map(),net=network(p);
  for(const t of p.tickets){
    if(connected(p,t.a,t.b))continue;
    const d=dijkstra(S.segs,t.a,t.b,s=>s.owner===p.id?0:s.owner===null?(blocked(s,now)?s.len+1.5:s.len+(net.size&&!net.has(s.a)&&!net.has(s.b)?.6:0)):Infinity);
    if(!d||d.cost>p.trains+1)continue;
    d.path.forEach((s,k)=>{if(s.owner===null)want.set(s.i,(want.get(s.i)||0)+t.p/(1+k*.15))});
  }
  return want;
}
function bestDrive(p,cands,now){let best=null;
  for(const{s,pr}of cands){if(s.owner!==null||blocked(s,now)||p.trains<s.len)continue;const depot=!touches(p,s),o=payOptions(p,s,depot)[0];if(!o)continue;
    const sc=s.len*2+pr*.3-(o.w+(o.e==='W'?1:0))*1.5-(depot?1.5:0);if(!best||sc>best.sc)best={s,o,sc}}
  return best}
function botNext(p,now){
  const want=wanted(p,now);
  if(p.jam&&now-S.roundStart>40000&&Math.random()<.12){
    const rival=S.players.filter(q=>q.id!==p.id).sort((a,b)=>livePts(b)-livePts(a))[0],rw=wanted(rival,now);let best=null;
    for(const[si,pr]of rw){const s=S.segs[si];if(s.owner!==null||blocked(s,now))continue;if(!best||pr>best.pr)best={si,pr}}
    if(best)return{t:'jam',si:best.si};
  }
  const best=bestDrive(p,[...want].map(([si,pr])=>({s:S.segs[si],pr})),now);
  if(best)return{t:'drive',si:best.s.i,o:best.o};
  const net=network(p);
  if(handN(p)>=9||!want.size){
    const alt=bestDrive(p,S.segs.filter(s=>(net.has(s.a)||net.has(s.b)||!net.size)&&(s.len>=2||p.trains<=3)).map(s=>({s,pr:s.len})),now);
    if(alt)return{t:'drive',si:alt.s.i,o:alt.o};
  }
  // go and fetch a floating pass on my own track (prefer colours my tickets need)
  if(p.at&&net.size){const need={};for(const si of want.keys()){const s=S.segs[si];if(s.c!=='any')need[s.c]=(need[s.c]||0)+1}
    let bestF=null;for(const f of S.floats){if(!net.has(f.id)||f.id===p.at)continue;const w=ownPath(p,p.at,f.id);if(!w)continue;const sc=(f.c==='W'?3:need[f.c]?2:1)-w.cars*.25;if(!bestF||sc>bestF.sc)bestF={id:f.id,sc}}
    if(bestF)return{t:'go',id:bestF.id}}
  return null;
}

/* ===== views ===== */
function view(v){
  const n=S.players.length,R=s=>s===null||s===undefined?s:(s-v+n)%n,order=S.players.map((_,i)=>(v+i)%n),roundOver=S.phase!=='play';
  return{
    game:'live',mode:S.mode,solo:S.solo,phase:S.phase,over:S.over,round:S.round,rounds:S.rounds,turn:-1,drawn:0,lastTurns:null,
    roundStart:S.roundStart,roundEnds:S.roundEnds,breakEnds:S.breakEnds,nextIncome:S.nextIncome,incomeMs:M().incomeMs*PACE,startedAt:S.startedAt,
    deckN:S.deck.length,discardN:S.discard.length,ticketDeckN:0,market:[],
    floats:S.floats,owners:S.segs.map(s=>R(s.owner)),
    jams:S.segs.map(s=>s.jam&&s.jam.until>S.now?{s:R(s.jam.s),until:s.jam.until}:null),
    fail:S.fail&&S.fail.until>S.now?S.fail.si:null,
    players:order.map(s=>{const p=S.players[s],me=s===v;
      return{seat:s,name:p.name,col:p.col,bot:p.bot,away:p.away,trains:p.trains,handN:handN(p),hand:me?p.hand:null,
        tickets:me||roundOver?p.tickets:null,ticketsN:p.tickets.length,done:me?p.tickets.map(t=>connected(p,t.a,t.b)):null,
        jam:p.jam,at:p.at,moving:p.moving,pts:livePts(p),wins:p.wins,totals:p.totals,choosing:false}}),
    offer:null,log:S.log.slice(0,12),logN:S.logN||0,
    final:S.final?{...S.final,rows:S.final.rows.map(r=>({...r,s:R(r.s)}))}:null,
    commute:S.commute?S.commute.map(r=>({...r,s:R(r.s)})):null,maxL:S.final?S.final.maxL:0,
    clockEnds:S.clockEnds,turnEnds:S.roundEnds,ticketEnds:0,
  };
}
function rotEv(e,v){if(e.s===undefined)return e;const n=S.players.length;return{...e,s:(e.s-v+n)%n}}

return{
  newGame,
  act(seat,a,now){EV=[];const r=act(seat,a,now);return{...r,ev:EV}},
  tick,nextWake,view,rotEv,
  botNext:(s,now)=>botNext(S.players[s],now??S.now??0),
  payOptions:(seat,si)=>{const p=S.players[seat],s=S.segs[si];return s.owner!==null?[]:payOptions(p,s,!touches(p,s))},
  touches:(seat,si)=>touches(S.players[seat],S.segs[si]),
  blocked:(si)=>blocked(S.segs[si],S.now||0),
  load(x){S=x},get S(){return S},setPace(k){PACE=k>0?k:1},
  setPos(){},
  setAway(seat,away){const p=S&&S.players[seat];if(p)p.away=!!away},
  takeOver(seat,name){const p=S&&S.players[seat];if(p){p.bot=false;p.away=false;p.name=name;addLog(`${name} joined and took over a robot’s train.`,'good')}},
  toBot(seat){const p=S&&S.players[seat];if(p){p.bot=true;p.away=false}},
};
}
export { makeLiveEngine as makeEngine, LIVE_MODES as MODES, SEAT_COLS, BOT_NAMES, MAX_SEATS };
