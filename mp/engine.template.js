/* Junction online: the server-authoritative rules engine.
   GENERATED into worker/rules.gen.js by `node mp/build.mjs`: the @@MARKER@@ slices are copied verbatim from
   junction.html (the same slices tools3d/build.py uses), so the rules live in one place. Edit this template,
   not the generated file.

   One engine per room. Every player is a seat; bots and timed-out humans play through the same actions
   as humans (botNext). Time is passed in explicitly (tick(now)), so the headless sim can run on a virtual clock. */

/*@@DATA@@*/

export const MODES={
  blitz:  {id:'blitz',  name:'Blitz',  blurb:'5–10 minutes',     trains:18, turnSec:25, ticketSec:30, clockMin:8,  long:false, startOffer:3, keepMin:1, speed:1.5},
  classic:{id:'classic',name:'Classic',blurb:'about 30 minutes', trains:40, turnSec:45, ticketSec:60, clockMin:28, long:true,  startOffer:4, keepMin:2, speed:1},
};
export const SEAT_COLS=['#14b8a6','#ff4fa3','#c8894a','#9be15d'];
export const BOT_NAMES=['Rose','Sandy','Mint','Bolt'];
export const MAX_SEATS=4;
const WX=id=>C[id].x-196,WZ=id=>C[id].y-150,W=id=>[WX(id),WZ(id)];
const routeMid=r=>[(WX(r.a)+WX(r.b))/2,(WZ(r.a)+WZ(r.b))/2];
const BOT_SPEED=60; // world units per second: about how fast robots hurry on their turn in the 3D client

export function makeEngine(){
let S=null,EV=[],PACE=1; // PACE < 1 speeds robots up (tests only)
const render=()=>{},sheet=()=>{}; // the sliced scoring code mentions these; the server has no UI
function addLog(t,k=''){S.log.unshift({t,k});S.log=S.log.slice(0,40);S.logN=(S.logN||0)+1}
function ev(e){EV.push(e)}
function draw(){if(!S.deck.length){S.deck=shuffle(S.discard);S.discard=[]}return S.deck.pop()||null}
function give(p,c){if(c)p.hand[c]=(p.hand[c]||0)+1}
const handN=p=>Object.values(p.hand).reduce((a,b)=>a+b,0);
const routePts=pid=>S.routes.filter(r=>r.owner===pid).reduce((s,r)=>s+PTS[r.len],0);

/* face-up cards float above cities (as in the 3D game): each market slot has a card and a city */
function setSlot(i,c){S.market[i]=c;S.marketCity[i]=c?pickCity(i):null}
function pickCity(i){
  const used=new Set(S.marketCity.filter((c,j)=>j!==i&&c));
  let cands=IDS.filter(id=>!used.has(id));
  const far=cands.filter(id=>S.pos.every(P=>!P||Math.hypot(P[0]-WX(id),P[1]-WZ(id))>10));
  if(far.length)cands=far;
  return pick(cands);
}
function fixMarket(quiet){
  for(let i=0;i<5;i++)if(!S.market[i])setSlot(i,draw());
  let t=0;
  while(S.market.filter(c=>c==='loco').length>=3&&t<3){
    S.discard.push(...S.market.filter(Boolean));for(let i=0;i<5;i++)setSlot(i,draw());t++;
    if(!quiet)addLog('Three locomotives were floating at once, so all the cards were redealt.');
  }
}

/*@@PAYMENT@@*/

/*@@WANTED@@*/

/*@@SCORING@@*/

/* ===== game setup ===== */
function newGame(seats,modeId,now){
  const M=MODES[modeId]||MODES.blitz;
  const deck=[];COLS.forEach(c=>{for(let i=0;i<12;i++)deck.push(c)});for(let i=0;i<14;i++)deck.push('loco');
  shuffle(deck);
  const longs=shuffle(LONG.map(t=>({...t}))),shorts=shuffle(SHORT.map(t=>({...t})));
  S={mode:M.id,deck,discard:[],market:[],marketCity:[],ticketDeck:[],turn:0,round:1,drawn:0,over:false,lastTurns:null,
     phase:'tickets',stationAt:{},log:[],startTrains:M.trains,offers:{},pending:null,plan:null,thinkAt:null,final:null,
     routes:ROUTES.map(r=>({...r,owner:null})),pos:seats.map(()=>null),
     startedAt:now,clockEnds:now+M.clockMin*60000,ticketEnds:now+M.ticketSec*1000,turnEnds:null,turnStart:null,
     players:seats.map((s,i)=>({id:i,name:s.name,col:SEAT_COLS[i],bot:!!s.bot,away:false,hand:{},trains:M.trains,stations:3,tickets:[]}))};
  const [mx,mz]=W('MUN');S.pos=S.players.map((p,i)=>[mx+[-4,4,-4,4][i],mz+[4,4,-4,-4][i]]);
  S.players.forEach(p=>{for(let k=0;k<4;k++)give(p,draw())});
  for(let k=0;k<5;k++)setSlot(k,draw());fixMarket(true);
  S.players.forEach(p=>{
    const list=M.long?[longs.pop(),...shorts.splice(-(M.startOffer-1))]:shorts.splice(-M.startOffer);
    S.offers[p.id]={list,min:M.keepMin,initial:true};
  });
  S.ticketDeck=shorts;
  addLog(`${M.name} game: ${M.trains} trains each, ${M.clockMin} minute clock. Choose your destination tickets.`);
  return S;
}

/* ===== actions (humans and bots go through the same door) ===== */
const sameOpt=(a,b)=>a&&b&&a.c===b.c&&a.n===b.n&&a.w===b.w;
const err=msg=>({ok:false,err:msg}),done=()=>({ok:true});
function act(seat,a,now){
  S.now=now;const p=S.players[seat];
  if(!p||!a||typeof a.t!=='string')return err('Bad action.');
  if(S.over)return err('The game is over.');
  if(a.t==='keep')return keep(p,a.idx,now);
  if(S.phase!=='play')return err('Everyone is still choosing tickets.');
  if(S.turn!==seat)return err('It’s not your turn.');
  if(S.offers[seat])return err('Choose which tickets to keep first.');
  if(a.t==='tunnel'){
    const P=S.pending;if(!P||P.seat!==seat)return err('No tunnel to resolve.');
    const r=S.routes[P.ri];S.pending=null;
    if(a.go&&(P.ex||!P.extra)){payPlan(p,P.o);if(P.extra)payPlan(p,P.ex);claim(p,r);ev({k:'claim',s:seat,ri:r.i})}
    else{addLog(`${p.name} backed off the ${nm(r.a)} to ${nm(r.b)} tunnel.`);ev({k:'puff',s:seat,ri:r.i})}
    endTurn(now);return done();
  }
  if(S.pending)return err('Resolve the tunnel first.');
  if(a.t==='market'){
    const i=a.i|0,c=S.market[i];if(!c)return err('That card is gone.');
    if(c==='loco'&&S.drawn===1)return err('A floating locomotive can’t be your second card.');
    const city=S.marketCity[i];
    give(p,c);ev({k:'pick',s:seat,city,c});setSlot(i,draw());fixMarket();
    addLog(`${p.name} took ${c==='loco'?'a floating locomotive':'a '+c+' card'} in ${nm(city)}.`);
    if(c==='loco'){endTurn(now);return done()}
    S.drawn++;afterDraw(now);return done();
  }
  if(a.t==='deck'){
    const c=draw();if(!c)return err('The deck is empty.');give(p,c);ev({k:'deck',s:seat});
    addLog(`${p.name} drew a card from the deck.`);
    S.drawn++;afterDraw(now);return done();
  }
  if(S.drawn)return err('Take one more card to finish your turn.');
  if(a.t==='tickets'){
    if(!S.ticketDeck.length)return err('No tickets left.');
    S.offers[seat]={list:S.ticketDeck.splice(0,3),min:1,initial:false};ev({k:'tix',s:seat});
    S.turnEnds=Math.max(S.turnEnds,now+15000); // a fair moment to read them
    return done();
  }
  if(a.t==='claim'){
    const r=S.routes[a.ri|0];if(!r)return err('No such route.');
    if(r.owner!==null)return err('That route is taken.');
    if(p.trains<r.len)return err(`You only have ${p.trains} trains left.`);
    const o=payOptions(p,r).find(x=>sameOpt(x,a.o));if(!o)return err('You can’t pay for that route.');
    if(!r.tunnel){payPlan(p,o);claim(p,r);ev({k:'claim',s:seat,ri:r.i});endTurn(now);return done()}
    const rev=[draw(),draw(),draw()].filter(Boolean);S.discard.push(...rev);
    const extra=tunnelExtra(o,rev),ex=extraPlan(p,o,extra);
    ev({k:'tunnel',s:seat,ri:r.i,rev,extra});
    if(!extra){payPlan(p,o);claim(p,r);ev({k:'claim',s:seat,ri:r.i});endTurn(now);return done()}
    if(!ex){addLog(`${p.name} hit ${extra} extra in the ${nm(r.a)} to ${nm(r.b)} tunnel and had to back off.`);ev({k:'puff',s:seat,ri:r.i});endTurn(now);return done()}
    S.pending={seat,ri:r.i,o,extra,ex,rev};S.turnEnds=Math.max(S.turnEnds,now+12000);
    return done();
  }
  if(a.t==='station'){
    const id=a.city;if(!C[id])return err('No such city.');
    if(S.stationAt[id]!==undefined)return err('There’s already a station there.');
    if(p.stations<=0)return err('You have no stations left.');
    const o=stationOptions(p,4-p.stations).find(x=>sameOpt(x,a.o));if(!o)return err('You can’t pay for a station.');
    payPlan(p,o);S.stationAt[id]=seat;p.stations--;ev({k:'station',s:seat,city:id});
    addLog(`${p.name} built a station in ${nm(id)}.`,'good');
    endTurn(now);return done();
  }
  return err('Unknown action.');
}
function keep(p,idx,now){
  const off=S.offers[p.id];if(!off)return err('No tickets to choose.');
  const k=[...new Set((Array.isArray(idx)?idx:[]).map(i=>i|0).filter(i=>i>=0&&i<off.list.length))];
  if(k.length<off.min)return err(`Keep at least ${off.min}.`);
  off.list.forEach((t,i)=>{if(k.includes(i))p.tickets.push(t);else if(!t.long)S.ticketDeck.push(t)});
  delete S.offers[p.id];
  addLog(`${p.name} kept ${k.length} ticket${k.length>1?'s':''}.`);
  if(off.initial){if(!Object.keys(S.offers).length)startPlay(now);return done()}
  endTurn(now);return done();
}
function startPlay(now){
  S.phase='play';S.turn=0;S.drawn=0;S.turnStart=now;S.turnEnds=now+MODES[S.mode].turnSec*1000;
  addLog(`${S.players[0].name} goes first.`);ev({k:'turn',s:0});
}
function afterDraw(now){
  if(S.drawn>=2)return endTurn(now);
  if(!(S.deck.length+S.discard.length)&&!S.market.some(c=>c&&c!=='loco')){addLog('No cards left to draw.');endTurn(now)}
}
function endTurn(now){
  if(S.over)return;
  const p=S.players[S.turn],M=MODES[S.mode];
  if(S.lastTurns===null){
    const why=p.trains<=2?`Only ${p.trains} train${p.trains===1?'':'s'} left for ${p.name}.`:S.routes.every(r=>r.owner!==null)?'Every route is taken.':now>=S.clockEnds?'Time’s up on the game clock.':null;
    if(why){S.lastTurns=S.players.length+1;addLog(`${why} Everyone gets one final turn.`,'danger');ev({k:'final'})}
  }
  if(S.lastTurns!==null){S.lastTurns--;if(S.lastTurns<=0){finish();return}}
  S.turn=(S.turn+1)%S.players.length;S.drawn=0;S.plan=null;S.thinkAt=null;S.pending=null;
  if(S.turn===0){S.round++;if(S.round>60){finish();return}}
  S.turnStart=now;S.turnEnds=now+M.turnSec*1000;ev({k:'turn',s:S.turn});
}
function finish(){
  S.over=true;S.phase='over';S.plan=null;S.thinkAt=null;S.pending=null;S.offers={};
  const lens=S.players.map(p=>longest(p.id)),maxL=Math.max(...lens);
  S.final=S.players.map((p,k)=>{const ts=ticketScore(p),rp=routePts(p.id),tp=ts.s,st=p.stations*4,ex=(maxL>0&&lens[k]===maxL)?10:0;
    return{s:p.id,rp,tp,st,ex,total:rp+tp+st+ex,len:lens[k],det:ts.det}}).sort((a,b)=>b.total-a.total||b.tp-a.tp);
  S.maxL=maxL;
  const w=S.players[S.final[0].s];
  addLog(`Game over. ${w.name} wins with ${S.final[0].total} pts.`,'good');ev({k:'over'});
}

/* ===== bots: decide the next action for a seat (also used when a human's turn timer runs out) ===== */
function cost(p,t){const d=dijkstra(S.routes,t.a,t.b,r=>r.owner===p.id?0:r.owner===null?r.len:Infinity);return d?d.cost:99}
function botKeepIdx(p,off){
  const sc=off.list.map((t,i)=>({i,c:off.initial?dijkstra(ROUTES,t.a,t.b,r=>r.len).cost:cost(p,t)})).sort((a,b)=>a.c-b.c);
  if(off.initial&&off.min>=2)return sc.slice(0,off.min).map(x=>x.i);
  const out=[sc[0].i];
  sc.slice(1).forEach(x=>{if(x.c<=Math.min(4,p.trains-sc[0].c-2))out.push(x.i)});
  while(out.length<off.min)out.push(sc[out.length].i);
  return out;
}
function botNext(p){
  const off=S.offers[p.id];
  if(off)return{t:'keep',idx:botKeepIdx(p,off)};
  if(S.pending&&S.pending.seat===p.id)return{t:'tunnel',go:!!(S.pending.ex||!S.pending.extra)};
  const want=wanted(p);
  if(S.drawn===0){
    let best=null;
    for(const[ri,pr]of want){
      const r=S.routes[ri],o=payOptions(p,r)[0];if(!o)continue;
      const sc=r.len*2+pr*.3-o.w*1.5;if(!best||sc>best.sc)best={r,o,sc};
    }
    if(best)return{t:'claim',ri:best.r.i,o:best.o};
    if(handN(p)>=9){
      const mine=new Set();S.routes.forEach(r=>{if(r.owner===p.id){mine.add(r.a);mine.add(r.b)}});
      let alt=null;
      S.routes.forEach(r=>{if(r.owner!==null)return;const o=payOptions(p,r)[0];if(!o||p.trains-r.len<0)return;
        const sc=r.len+((mine.has(r.a)||mine.has(r.b))?2:0)-o.w*1.5;if(!alt||sc>alt.sc)alt={r,o,sc}});
      if(alt&&alt.r.len>=2)return{t:'claim',ri:alt.r.i,o:alt.o};
    }
    if(!want.size){
      if(p.trains>=Math.min(12,Math.round(S.startTrains*.45))&&S.ticketDeck.length&&p.tickets.length<5)return{t:'tickets'};
      let any=null;
      S.routes.forEach(r=>{if(r.owner!==null)return;const o=payOptions(p,r)[0];if(o&&(!any||r.len>any.r.len))any={r,o}});
      if(any&&(any.r.len>=2||p.trains<=4))return{t:'claim',ri:any.r.i,o:any.o};
    }
    if(Math.random()<.22){const li=S.market.indexOf('loco');if(li>=0)return{t:'market',i:li}}
  }
  const need={};let mostC=null,mostN=-1;
  COLS.forEach(c=>{if((p.hand[c]||0)>mostN){mostN=p.hand[c]||0;mostC=c}});
  for(const ri of want.keys()){const r=S.routes[ri],c=r.color==='gray'?mostC:r.color;need[c]=(need[c]||0)+r.len-(p.hand[c]||0)}
  let idx=-1,bv=0;S.market.forEach((c,i)=>{if(c&&c!=='loco'&&(need[c]||0)>bv){bv=need[c];idx=i}});
  if(idx>=0)return{t:'market',i:idx};
  if(S.deck.length+S.discard.length)return{t:'deck'};
  const j=S.market.findIndex(x=>x&&x!=='loco');if(j>=0)return{t:'market',i:j};
  if(S.drawn===0&&S.market.indexOf('loco')>=0)return{t:'market',i:S.market.indexOf('loco')};
  return null; // no cards anywhere: pass the turn
}
/* where a robot walks before it acts */
function targetOf(a){
  if(a.t==='market'&&S.market[a.i])return W(S.marketCity[a.i]);
  if(a.t==='claim')return routeMid(S.routes[a.ri]);
  if(a.t==='station')return W(a.city);
  return null;
}

/* ===== the clock: bots walk to their target, then act; humans who run out of time are auto-played =====
   Each call does everything that is due at `now` and returns the events; nextWake(now) says when to call again. */
const AWAY_GRACE=3000,THINK=700;
const autoSeat=(p,now)=>p.bot||now>=S.turnEnds||(p.away&&now>=S.turnStart+AWAY_GRACE);
function run(seat,a,now){const r=act(seat,a,now);if(!r.ok&&S.phase==='play'&&S.turn===seat&&!S.over){S.offers[seat]&&delete S.offers[seat];endTurn(now)}}
function tick(now){
  EV=[];S.now=now;
  for(let guard=0;!S.over&&guard<40;guard++){
    if(S.phase==='tickets'){
      const due=Object.keys(S.offers).map(Number).filter(s=>{const p=S.players[s];return p.bot||p.away||now>=S.ticketEnds});
      if(!due.length)break;
      due.forEach(s=>keep(S.players[s],botKeepIdx(S.players[s],S.offers[s]),now));
      continue;
    }
    const p=S.players[S.turn];
    if(!autoSeat(p,now))break;
    if(S.plan){if(now<S.plan.at)break;const a=S.plan.a;S.plan=null;run(p.id,a,now);continue}
    const a=botNext(p);
    if(!a){endTurn(now);continue}
    const timedOut=!p.bot&&!p.away&&now>=S.turnEnds,tgt=timedOut?null:targetOf(a);
    if(!tgt){ // decisions with nowhere to walk: a short think (none when a human's time ran out)
      if(!timedOut){if(!S.thinkAt){S.thinkAt=now+THINK*PACE;break}if(now<S.thinkAt)break}
      S.thinkAt=null;run(p.id,a,now);continue;
    }
    const from=S.pos[p.id]||tgt,d=Math.hypot(tgt[0]-from[0],tgt[1]-from[1]);
    const walk=Math.min(4200,350+d/(BOT_SPEED*MODES[S.mode].speed)*1000);
    S.plan={a,at:now+walk*PACE};S.pos[p.id]=tgt;
    ev({k:'goto',s:p.id,x:+tgt[0].toFixed(1),z:+tgt[1].toFixed(1)});
  }
  return EV;
}
function nextWake(now){
  if(!S||S.over)return null;
  if(S.phase==='tickets'){
    if(Object.keys(S.offers).some(s=>S.players[s].bot||S.players[s].away))return now;
    return S.ticketEnds;
  }
  const p=S.players[S.turn];
  if(p.bot||(p.away&&now>=S.turnStart+AWAY_GRACE)){if(S.plan)return S.plan.at;if(S.thinkAt)return S.thinkAt;return now}
  if(p.away)return Math.min(S.turnEnds,S.turnStart+AWAY_GRACE);
  return S.turnEnds;
}

/* a human takes the controls back: drop whatever the robot was walking off to do */
function handBack(seat){if(S.turn===seat){S.plan=null;S.thinkAt=null}}

/* ===== what one seat may see: everything public, plus its own hand, tickets and offers.
   Seats are rotated so the viewer is always player 0 (the 3D client's "you"). ===== */
function view(v){
  const n=S.players.length,R=s=>s===null||s===undefined?s:(s-v+n)%n,order=S.players.map((_,i)=>(v+i)%n);
  const P=S.pending;
  return{
    mode:S.mode,phase:S.phase,over:S.over,turn:R(S.turn),round:S.round,drawn:S.drawn,lastTurns:S.lastTurns,
    market:S.market,marketCity:S.marketCity,deckN:S.deck.length,discardN:S.discard.length,ticketDeckN:S.ticketDeck.length,
    owners:S.routes.map(r=>R(r.owner)),
    stationAt:Object.fromEntries(Object.entries(S.stationAt).map(([c,s])=>[c,R(s)])),
    players:order.map(s=>{const p=S.players[s],mine=s===v;
      return{seat:s,name:p.name,col:p.col,bot:p.bot,away:p.away,trains:p.trains,stations:p.stations,handN:handN(p),
        hand:mine?p.hand:null,tickets:mine||S.over?p.tickets:null,ticketsN:p.tickets.length,choosing:!!S.offers[s]}}),
    offer:S.offers[v]||null,
    pending:P?(P.seat===v?{ri:P.ri,o:P.o,extra:P.extra,ex:P.ex,rev:P.rev,mine:true}:{ri:P.ri,rev:P.rev,s:R(P.seat)}):null,
    log:S.log.slice(0,12),logN:S.logN||0,
    turnEnds:S.turnEnds,ticketEnds:S.ticketEnds,clockEnds:S.clockEnds,startedAt:S.startedAt,
    final:S.final?S.final.map(r=>({...r,s:R(r.s)})):null,maxL:S.maxL||0,
  };
}
function rotEv(e,v){if(e.s===undefined)return e;const n=S.players.length;return{...e,s:(e.s-v+n)%n}}

return{
  newGame,
  act(seat,a,now){EV=[];const r=act(seat,a,now);return{...r,ev:EV}},
  tick,nextWake,view,rotEv,
  botNext:s=>botNext(S.players[s]),
  load(x){S=x},get S(){return S},setPace(k){PACE=k>0?k:1},
  setPos(seat,x,z){if(S&&S.pos&&seat<S.pos.length&&Number.isFinite(x)&&Number.isFinite(z))S.pos[seat]=[x,z]},
  setAway(seat,away){const p=S&&S.players[seat];if(!p)return;p.away=!!away;if(!away&&!p.bot)handBack(seat)},
  takeOver(seat,name){const p=S&&S.players[seat];if(p){p.bot=false;p.away=false;p.name=name;handBack(seat);addLog(`${name} joined and took over a robot’s seat.`,'good')}},
  toBot(seat){const p=S&&S.players[seat];if(p){p.bot=true;p.away=false}},
};
}
