/* Junction: Delhi Metro — the rules engine.
   One file, no DOM: it runs unchanged inside the Cloudflare Worker (worker/index.js imports it) and inside the
   browser (mp/build.mjs inlines it into metro.html for solo play). Time is always passed in (tick(now)), so the
   headless simulator (mp/metro-sim.mjs) runs on a virtual clock.

   The game in one breath: you drive a metro train. Each turn you either take 2 line passes (face-up or from the
   deck) or DRIVE one unclaimed segment that touches your network, paying passes of that line's colour. Starting
   somewhere your network doesn't reach is a "depot run" and costs one extra pass of any kind. Segments score by
   length, destination tickets score if your network joins both stations, the longest unbroken line gets +10.
   Light disruption: a Signal Failure closes a random free segment every third round, and everyone has one Jam.

   Map facts (station names, line colours, which stations are interchanges) are public facts about the Delhi Metro;
   the schematic itself is drawn by us. Reference: Wikimedia Commons, "Delhi metro rail network.svg" (PlaneMad, CC BY-SA 2.5). */

/* ===== map ===== */
export const LINES={
  R:{name:'Red',col:'#e23a2e'}, Y:{name:'Yellow',col:'#f2c21b'}, B:{name:'Blue',col:'#1f66d6'}, G:{name:'Green',col:'#2fa84f'},
  V:{name:'Violet',col:'#6c3fb4'}, P:{name:'Pink',col:'#f06aa8'}, M:{name:'Magenta',col:'#b0288a'}, O:{name:'Orange',col:'#f28a1e'},
};
export const COLS=Object.keys(LINES);            // pass colours (hand keys); 'W' is the Smart Card (wild)
export const ANY_COL='#8d939c';                  // Grey Line, Aqua Line and Rapid Metro segments take any ONE colour
export const PTS={1:1,2:2,3:4,4:7};              // points per segment length

// [id, name, x, y, labelSide] on a 1000×1300 portrait canvas (labelSide: l r t b tl tr bl br). Short names fit a phone.
export const STATION_DATA=[
  ['RIT','Rithala',150,300,'l'],['SBD','Samaypur Badli',470,130,'r'],['MJP','Majlis Park',380,230,'l'],['AZP','Azadpur',470,290,'r'],
  ['NSP','Netaji Subhash',300,330,'bl'],['INL','Inderlok',340,460,'tr'],['KSG','Kashmere Gate',560,440,'l'],['WEL','Welcome',750,430,'t'],
  ['DLG','Dilshad Garden',860,440,'t'],['SHS','Shaheed Sthal',985,380,'t'],['SVH','Shiv Vihar',890,320,'t'],
  ['BHG','Bahadurgarh',30,430,'t'],['PGH','Peeragarhi',140,420,'b'],['PBW','Punjabi Bagh W.',250,520,'r'],['KTN','Kirti Nagar',350,600,'br'],
  ['RJG','Rajouri Garden',250,630,'l'],['JPW','Janakpuri West',130,700,'l'],['DWK','Dwarka',70,800,'l'],['NJF','Najafgarh',15,730,'b'],
  ['DS21','Dwarka Sec. 21',40,960,'r'],
  ['NDL','New Delhi',560,530,'tl'],['RJC','Rajiv Chowk',540,600,'bl'],['MDH','Mandi House',650,610,'br'],['CSC','Central Sectt.',560,680,'r'],
  ['DHK','Dhaula Kuan',380,710,'l'],['INA','INA',520,770,'l'],['LJN','Lajpat Nagar',650,770,'r'],['SKK','Nizamuddin',750,735,'r'],
  ['YMB','Yamuna Bank',760,610,'r'],['MYV','Mayur Vihar I',845,680,'r'],['KKD','Karkarduma',840,520,'l'],['AVH','Anand Vihar',910,500,'t'],
  ['VSH','Vaishali',985,540,'b'],
  ['T1','Airport T1',270,770,'l'],['T3','Airport T3',210,900,'l'],['HKS','Hauz Khas',520,880,'l'],['KLK','Kalkaji Mandir',670,890,'tr'],
  ['QTB','Qutub Minar',480,980,'l'],['SKP','Sikanderpur',430,1120,'r'],['CYB','Cyber City',320,1080,'l'],['HCC','Millennium City',470,1230,'r'],
  ['BDP','Badarpur',730,1050,'r'],['RNS','Ballabhgarh',780,1200,'r'],
  ['NS18','Noida Sec. 18',920,790,'r'],['BTG','Botanical Garden',880,870,'bl'],['NCC','Noida City Centre',930,950,'r'],
  ['NS52','Noida Sec. 52',900,1030,'l'],['NEC','Electronic City',965,1100,'b'],['PCK','Pari Chowk',870,1240,'r'],
];
// [a, b, line, length]. line is a LINES key, or 'A:<name>' for an any-colour segment (Grey Line, Aqua Line, Rapid Metro).
export const SEG_DATA=[
  // Red
  ['RIT','NSP','R',3],['NSP','INL','R',2],['INL','KSG','R',3],['KSG','WEL','R',2],['WEL','DLG','R',2],['DLG','SHS','R',4],
  // Yellow
  ['SBD','AZP','Y',2],['AZP','KSG','Y',3],['KSG','NDL','Y',2],['NDL','RJC','Y',1],['RJC','CSC','Y',1],['CSC','INA','Y',2],
  ['INA','HKS','Y',2],['HKS','QTB','Y',2],['QTB','SKP','Y',3],['SKP','HCC','Y',2],
  // Blue (and its Vaishali branch)
  ['DS21','DWK','B',4],['DWK','JPW','B',3],['JPW','RJG','B',3],['RJG','KTN','B',2],['KTN','RJC','B',4],['RJC','MDH','B',1],
  ['MDH','YMB','B',2],['YMB','MYV','B',1],['MYV','NS18','B',3],['NS18','BTG','B',1],['BTG','NCC','B',2],['NCC','NS52','B',1],
  ['NS52','NEC','B',2],['YMB','KKD','B',3],['KKD','AVH','B',1],['AVH','VSH','B',2],
  // Green
  ['BHG','PGH','G',3],['PGH','PBW','G',3],['PBW','INL','G',2],['INL','KTN','G',2],
  // Violet
  ['KSG','MDH','V',3],['MDH','CSC','V',1],['CSC','LJN','V',2],['LJN','KLK','V',2],['KLK','BDP','V',4],['BDP','RNS','V',4],
  // Pink (the ring)
  ['MJP','AZP','P',1],['AZP','NSP','P',2],['NSP','PBW','P',2],['PBW','RJG','P',1],['RJG','DHK','P',3],['DHK','INA','P',2],
  ['INA','LJN','P',2],['LJN','SKK','P',2],['SKK','MYV','P',1],['MYV','AVH','P',3],['AVH','KKD','P',1],['KKD','WEL','P',2],
  ['WEL','SVH','P',3],['SVH','MJP','P',4],
  // Magenta
  ['JPW','T1','M',3],['T1','HKS','M',4],['HKS','KLK','M',3],['KLK','BTG','M',4],
  // Orange (Airport Express)
  ['NDL','DHK','O',2],['DHK','T3','O',2],['T3','DS21','O',1],
  // any one colour
  ['DWK','NJF','A:Grey Line',2],['SKP','CYB','A:Rapid Metro',2],['NS52','PCK','A:Aqua Line',4],
];
export const C={};STATION_DATA.forEach(([id,name,x,y,side])=>{C[id]={id,name,x,y,side}});
export const IDS=STATION_DATA.map(s=>s[0]);
export const SEGS=SEG_DATA.map(([a,b,line,len],i)=>{
  const any=line.startsWith('A:');
  return{i,a,b,len,c:any?'any':line,line:any?line.slice(2):LINES[line].name+' Line',col:any?ANY_COL:LINES[line].col};
});
export const nm=id=>C[id].name;
export const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export const pick=a=>a[Math.floor(Math.random()*a.length)];

// shortest path by segment cost (costFn(seg) → number or Infinity)
export function dijkstra(segs,from,to,costFn){
  const dist={},prev={},done=new Set();IDS.forEach(id=>dist[id]=Infinity);dist[from]=0;
  for(;;){
    let u=null;for(const id of IDS)if(!done.has(id)&&dist[id]<Infinity&&(u===null||dist[id]<dist[u]))u=id;
    if(u===null)return null;if(u===to)break;done.add(u);
    for(const s of segs){if(s.a!==u&&s.b!==u)continue;const v=s.a===u?s.b:s.a,c=costFn(s);if(c===Infinity)continue;
      if(dist[u]+c<dist[v]){dist[v]=dist[u]+c;prev[v]=s}}
  }
  const path=[];let v=to;while(v!==from){const s=prev[v];path.unshift(s);v=s.a===v?s.b:s.a}
  return{cost:dist[to],path};
}
// Destination tickets: every pair of stations 5+ segment-units apart, worth the shortest distance (long ones +2).
export const TICKETS=(()=>{const T=[];for(let i=0;i<IDS.length;i++)for(let j=i+1;j<IDS.length;j++){
  const d=dijkstra(SEGS,IDS[i],IDS[j],s=>s.len);if(!d||d.cost<5)continue;
  const long=d.cost>=11;T.push({a:IDS[i],b:IDS[j],p:d.cost+(long?2:0),long})}return T})();
export const LONG=TICKETS.filter(t=>t.long),SHORT=TICKETS.filter(t=>!t.long);

/* ===== modes ===== */
export const MODES={
  rush:{id:'rush',name:'Rush Hour',blurb:'5–10 minutes',trains:16,turnSec:25,ticketSec:30,clockMin:10,long:false,startOffer:3,keepMin:1,think:1},
  full:{id:'full',name:'Full Line',blurb:'about 20 minutes',trains:24,turnSec:40,ticketSec:50,clockMin:25,long:true,startOffer:4,keepMin:2,think:1.2},
};
export const SEAT_COLS=['#14b8a6','#ff4fa3','#c8894a','#9be15d'];
export const BOT_NAMES=['Rose','Sandy','Mint','Bolt'];
export const MAX_SEATS=4;
export const FAIL_EVERY=3;      // a Signal Failure at the start of every 3rd round
export const JAM_ROUNDS=2;      // a Jam closes a segment for this many rounds

/* ===== engine ===== */
export function makeEngine(){
let S=null,EV=[],PACE=1;
function addLog(t,k=''){S.log.unshift({t,k});S.log=S.log.slice(0,40);S.logN=(S.logN||0)+1}
function ev(e){EV.push(e)}
function draw(){if(!S.deck.length){S.deck=shuffle(S.discard);S.discard=[]}return S.deck.pop()||null}
function give(p,c){if(c)p.hand[c]=(p.hand[c]||0)+1}
const handN=p=>Object.values(p.hand).reduce((a,b)=>a+b,0);
const routePts=pid=>S.segs.filter(s=>s.owner===pid).reduce((a,s)=>a+PTS[s.len],0);
const blocked=s=>!!(s.jam&&s.jam.until>S.round)||!!(S.fail&&S.fail.si===s.i&&S.fail.until>S.round);
function network(p){const n=new Set();S.segs.forEach(s=>{if(s.owner===p.id){n.add(s.a);n.add(s.b)}});return n}
const touches=(p,s)=>{const n=network(p);return n.size===0||n.has(s.a)||n.has(s.b)};
function fixMarket(quiet){
  for(let i=0;i<5;i++)if(!S.market[i])S.market[i]=draw();
  let t=0;while(S.market.filter(c=>c==='W').length>=3&&t<3){S.discard.push(...S.market.filter(Boolean));S.market=[];for(let i=0;i<5;i++)S.market[i]=draw();t++;
    if(!quiet)addLog('Three Smart Cards were face up at once, so the market was redealt.')}
}

/* ---- payment: a segment costs `len` passes of its colour (any one colour for grey segments); Smart Cards are wild.
   A depot run (the segment doesn't touch your network) costs one extra pass of any kind: `e` is that pass. ---- */
function payOptions(p,s,depot){
  const out=[],W=p.hand.W||0,cols=s.c==='any'?COLS:[s.c];
  for(const c of cols){const h=p.hand[c]||0;
    for(let n=Math.min(s.len,h);n>=0;n--){const w=s.len-n;if(w>W)continue;
      if(!depot){out.push({c,n,w,e:null});continue}
      if(h>=n+1)out.push({c,n,w,e:c});
      if(W>=w+1)out.push({c,n,w,e:'W'});
      for(const e of COLS)if(e!==c&&(p.hand[e]||0)>=1)out.push({c,n,w,e});
    }}
  // fewest wilds first, then most of the main colour, then an extra pass from the colour you hold most of
  out.sort((x,y)=>(x.w+(x.e==='W'?1:0))-(y.w+(y.e==='W'?1:0))||(y.n-x.n)||((p.hand[y.e]||0)-(p.hand[x.e]||0)));
  return out;
}
const sameOpt=(a,b)=>a&&b&&a.c===b.c&&a.n===b.n&&a.w===b.w&&(a.e||null)===(b.e||null);
function payPlan(p,o){
  const spend=(c,n)=>{p.hand[c]-=n;for(let i=0;i<n;i++)S.discard.push(c);if(!p.hand[c])delete p.hand[c]};
  if(o.n)spend(o.c,o.n);if(o.w)spend('W',o.w);if(o.e)spend(o.e,1);
}
// the stations a train passes: along your own network from where it stands to the segment, then the segment.
// A depot run is a segment that touches none of your track (your train is hauled there, one extra pass).
function drivePath(p,s){
  const depot=!touches(p,s),own=S.segs.filter(x=>x.owner===p.id);
  const walk=(prev,to)=>{const out=[];for(let v=to;v!==null&&v!==undefined;v=prev[v])out.unshift(v);return out};
  if(!depot&&p.at&&C[p.at]){
    const prev={[p.at]:null},q=[p.at];
    while(q.length){const u=q.shift();for(const x of own){if(x.a!==u&&x.b!==u)continue;const v=x.a===u?x.b:x.a;if(!(v in prev)){prev[v]=u;q.push(v)}}}
    const to=[s.a,s.b].filter(id=>id in prev).sort((x,y)=>walk(prev,x).length-walk(prev,y).length)[0];
    if(to){const path=walk(prev,to);path.push(to===s.a?s.b:s.a);return{path,depot:false}}
  }
  return{path:[s.a,s.b],depot};
}
function claim(p,s,path){s.owner=p.id;p.trains-=s.len;p.at=path[path.length-1];
  addLog(`${p.name} drove ${nm(s.a)} to ${nm(s.b)} (${s.line}, +${PTS[s.len]}).`)}

/* ---- scoring ---- */
function connected(p,a,b){const own=S.segs.filter(s=>s.owner===p.id),seen=new Set([a]),q=[a];
  while(q.length){const u=q.shift();if(u===b)return true;for(const s of own){if(s.a!==u&&s.b!==u)continue;const v=s.a===u?s.b:s.a;if(!seen.has(v)){seen.add(v);q.push(v)}}}return false}
function ticketScore(p){let s=0;const det=p.tickets.map(t=>{const ok=connected(p,t.a,t.b);s+=ok?t.p:-t.p;return ok});return{s,det}}
function longest(pid){const own=S.segs.filter(s=>s.owner===pid);let best=0;
  const go=(at,used,len)=>{best=Math.max(best,len);for(const s of own){if(used.has(s.i)||(s.a!==at&&s.b!==at))continue;used.add(s.i);go(s.a===at?s.b:s.a,used,len+s.len);used.delete(s.i)}};
  own.forEach(s=>{go(s.a,new Set(),0);go(s.b,new Set(),0)});return best}

/* ===== game setup ===== */
function newGame(seats,modeId,now,opts={}){
  const M=MODES[modeId]||MODES.rush;
  // the deck follows the map: more passes for lines with more track
  const units={};COLS.forEach(c=>units[c]=0);SEGS.forEach(s=>{if(s.c!=='any')units[s.c]+=s.len;else COLS.forEach(c=>units[c]+=s.len/COLS.length)});
  const deck=[];COLS.forEach(c=>{const n=Math.max(7,Math.round(units[c]*.62));for(let i=0;i<n;i++)deck.push(c)});for(let i=0;i<12;i++)deck.push('W');
  shuffle(deck);
  const longs=shuffle(LONG.map(t=>({...t}))),shorts=shuffle(SHORT.map(t=>({...t})));
  const far=opts.solo?365*864e5:0; // solo: no turn timer and no game clock
  S={game:'metro',mode:M.id,solo:!!opts.solo,deck,discard:[],market:[],ticketDeck:[],turn:0,round:1,drawn:0,over:false,lastTurns:null,
     phase:'tickets',log:[],startTrains:M.trains,offers:{},plan:null,thinkAt:null,final:null,fail:null,
     segs:SEGS.map(s=>({i:s.i,a:s.a,b:s.b,len:s.len,c:s.c,line:s.line,owner:null,jam:null})),
     startedAt:now,clockEnds:now+M.clockMin*60000+far,ticketEnds:now+M.ticketSec*1000+far,turnEnds:null,turnStart:null,
     players:seats.map((s,i)=>({id:i,name:s.name,col:SEAT_COLS[i],bot:!!s.bot,away:false,hand:{},trains:M.trains,tickets:[],jam:true,at:null}))};
  S.players.forEach(p=>{for(let k=0;k<4;k++)give(p,draw())});
  fixMarket(true);
  S.players.forEach(p=>{const list=M.long?[longs.pop(),...shorts.splice(-(M.startOffer-1))]:shorts.splice(-M.startOffer);S.offers[p.id]={list,min:M.keepMin,initial:true}});
  S.ticketDeck=shorts;
  addLog(`${M.name}: ${M.trains} trains each${opts.solo?'':`, ${M.clockMin} minute clock`}. Choose your destination tickets.`);
  return S;
}

/* ===== actions (humans and bots go through the same door) ===== */
const err=msg=>({ok:false,err:msg}),done=()=>({ok:true});
function act(seat,a,now){
  S.now=now;const p=S.players[seat];
  if(!p||!a||typeof a.t!=='string')return err('Bad action.');
  if(S.over)return err('The game is over.');
  if(a.t==='keep')return keep(p,a.idx,now);
  if(S.phase!=='play')return err('Everyone is still choosing tickets.');
  if(S.turn!==seat)return err('It’s not your turn.');
  if(S.offers[seat])return err('Choose which tickets to keep first.');
  if(a.t==='market'){
    const i=a.i|0,c=S.market[i];if(!c)return err('That pass is gone.');
    if(c==='W'&&S.drawn===1)return err('A face-up Smart Card can’t be your second pass.');
    give(p,c);S.market[i]=draw();fixMarket();ev({k:'pick',s:seat,i,c});
    addLog(`${p.name} took ${c==='W'?'a Smart Card':'a '+LINES[c].name+' pass'}.`);
    if(c==='W'){endTurn(now);return done()}
    S.drawn++;afterDraw(now);return done();
  }
  if(a.t==='deck'){
    const c=draw();if(!c)return err('The deck is empty.');give(p,c);ev({k:'deck',s:seat});
    addLog(`${p.name} drew a pass from the deck.`);
    S.drawn++;afterDraw(now);return done();
  }
  if(S.drawn)return err('Take one more pass to finish your turn.');
  if(a.t==='tickets'){
    if(!S.ticketDeck.length)return err('No tickets left.');
    S.offers[seat]={list:S.ticketDeck.splice(0,3),min:1,initial:false};ev({k:'tix',s:seat});
    S.turnEnds=Math.max(S.turnEnds,now+15000);
    return done();
  }
  if(a.t==='jam'){
    const s=S.segs[a.si|0];if(!s)return err('No such segment.');
    if(!p.jam)return err('You’ve used your Jam.');
    if(s.owner!==null)return err('You can only jam a free segment.');
    if(blocked(s))return err('That segment is already closed.');
    s.jam={s:seat,until:S.round+JAM_ROUNDS};p.jam=false;ev({k:'jam',s:seat,si:s.i});
    addLog(`${p.name} jammed ${nm(s.a)} to ${nm(s.b)} for ${JAM_ROUNDS} rounds.`,'danger');
    return done();
  }
  if(a.t==='drive'){
    const s=S.segs[a.si|0];if(!s)return err('No such segment.');
    if(s.owner!==null)return err('That segment is taken.');
    if(blocked(s))return err(S.fail&&S.fail.si===s.i?'Signal failure: that segment is closed this round.':'That segment is jammed.');
    if(p.trains<s.len)return err(`You only have ${p.trains} train${p.trains===1?'':'s'} left.`);
    const {path,depot}=drivePath(p,s);
    const o=payOptions(p,s,depot).find(x=>sameOpt(x,a.o));if(!o)return err(depot?'A depot run costs one extra pass.':'You can’t pay for that segment.');
    payPlan(p,o);claim(p,s,path);ev({k:'drive',s:seat,si:s.i,path,depot});
    if(depot)addLog(`${p.name} made a depot run to get there.`);
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
  S.phase='play';S.turn=0;S.drawn=0;S.turnStart=now;S.turnEnds=now+turnMs();
  addLog(`${S.players[0].name} goes first.`);ev({k:'turn',s:0});
}
const turnMs=()=>S.solo?365*864e5:MODES[S.mode].turnSec*1000;
function afterDraw(now){
  if(S.drawn>=2)return endTurn(now);
  if(!(S.deck.length+S.discard.length)&&!S.market.some(c=>c&&c!=='W')){addLog('No passes left to draw.');endTurn(now)}
}
function endTurn(now){
  if(S.over)return;
  const p=S.players[S.turn];
  if(S.lastTurns===null){
    const why=p.trains<=2?`Only ${p.trains} train${p.trains===1?'':'s'} left for ${p.name}.`:S.segs.every(s=>s.owner!==null)?'Every segment is taken.':now>=S.clockEnds?'Time’s up on the game clock.':null;
    if(why){S.lastTurns=S.players.length+1;addLog(`${why} Everyone gets one final turn.`,'danger');ev({k:'final'})}
  }
  if(S.lastTurns!==null){S.lastTurns--;if(S.lastTurns<=0){finish();return}}
  S.turn=(S.turn+1)%S.players.length;S.drawn=0;S.plan=null;S.thinkAt=null;
  if(S.turn===0){S.round++;if(S.round>60){finish();return}newRound()}
  S.turnStart=now;S.turnEnds=now+turnMs();ev({k:'turn',s:S.turn});
}
function newRound(){
  S.segs.forEach(s=>{if(s.jam&&s.jam.until<=S.round)s.jam=null});
  if(S.fail&&S.fail.until<=S.round)S.fail=null;
  if(S.round>=FAIL_EVERY&&S.round%FAIL_EVERY===0&&S.lastTurns===null){
    const free=S.segs.filter(s=>s.owner===null&&!s.jam);
    if(free.length){const s=pick(free);S.fail={si:s.i,until:S.round+1};ev({k:'fail',si:s.i});
      addLog(`Signal failure between ${nm(s.a)} and ${nm(s.b)}: closed this round.`,'danger')}
  }
}
function finish(){
  S.over=true;S.phase='over';S.plan=null;S.thinkAt=null;S.offers={};
  const lens=S.players.map(p=>longest(p.id)),maxL=Math.max(...lens);
  S.final=S.players.map((p,k)=>{const ts=ticketScore(p),rp=routePts(p.id),ex=(maxL>0&&lens[k]===maxL)?10:0;
    return{s:p.id,rp,tp:ts.s,ex,total:rp+ts.s+ex,len:lens[k],det:ts.det}}).sort((a,b)=>b.total-a.total||b.tp-a.tp);
  S.maxL=maxL;
  addLog(`Game over. ${S.players[S.final[0].s].name} wins with ${S.final[0].total} points.`,'good');ev({k:'over'});
}

/* ===== bots (also play for humans who time out or drop) ===== */
// segments on the cheapest paths of unfinished tickets → priority
function wanted(p){
  const want=new Map(),net=network(p);
  for(const t of p.tickets){
    if(connected(p,t.a,t.b))continue;
    const d=dijkstra(S.segs,t.a,t.b,s=>s.owner===p.id?0:s.owner===null?(blocked(s)?s.len+1.5:s.len+(net.size&&!net.has(s.a)&&!net.has(s.b)?.6:0)):Infinity);
    if(!d||d.cost>p.trains+1)continue;
    d.path.forEach((s,k)=>{if(s.owner===null)want.set(s.i,(want.get(s.i)||0)+t.p/(1+k*.15))});
  }
  return want;
}
function cost(p,t){const d=dijkstra(S.segs,t.a,t.b,s=>s.owner===p.id?0:s.owner===null?s.len:Infinity);return d?d.cost:99}
function botKeepIdx(p,off){
  const sc=off.list.map((t,i)=>({i,c:off.initial?dijkstra(SEGS,t.a,t.b,s=>s.len).cost:cost(p,t)})).sort((a,b)=>a.c-b.c);
  if(off.initial&&off.min>=2)return sc.slice(0,off.min).map(x=>x.i);
  const out=[sc[0].i];
  sc.slice(1).forEach(x=>{if(x.c<=Math.min(5,p.trains-sc[0].c-2))out.push(x.i)});
  while(out.length<off.min)out.push(sc[out.length].i);
  return out;
}
function bestDrive(p,cands){ // cands: [{s, pr}] → the segment worth driving now, with its payment
  let best=null;
  for(const{s,pr}of cands){
    if(s.owner!==null||blocked(s)||p.trains<s.len)continue;
    const depot=!touches(p,s),o=payOptions(p,s,depot)[0];if(!o)continue;
    const sc=s.len*2+pr*.3-(o.w+(o.e==='W'?1:0))*1.5-(depot?1.5:0);
    if(!best||sc>best.sc)best={s,o,sc};
  }
  return best;
}
function botJam(p){
  if(!p.jam||S.round<3||S.lastTurns!==null||Math.random()>.3)return null;
  const rival=S.players.filter(q=>q.id!==p.id).sort((a,b)=>routePts(b.id)-routePts(a.id))[0];
  const want=wanted(rival);let best=null;
  for(const[si,pr]of want){const s=S.segs[si];if(s.owner!==null||blocked(s))continue;if(!best||pr>best.pr)best={si,pr}}
  return best?{t:'jam',si:best.si}:null;
}
function botNext(p){
  const off=S.offers[p.id];
  if(off)return{t:'keep',idx:botKeepIdx(p,off)};
  const want=wanted(p);
  if(S.drawn===0){
    const j=botJam(p);if(j)return j;
    const best=bestDrive(p,[...want].map(([si,pr])=>({s:S.segs[si],pr})));
    if(best)return{t:'drive',si:best.s.i,o:best.o};
    const net=network(p);
    if(handN(p)>=8){ // plenty of passes: grow the network anyway
      const alt=bestDrive(p,S.segs.filter(s=>s.len>=2&&(net.has(s.a)||net.has(s.b)||!net.size)).map(s=>({s,pr:s.len})));
      if(alt)return{t:'drive',si:alt.s.i,o:alt.o};
    }
    if(!want.size){
      if(p.trains>=Math.min(10,Math.round(S.startTrains*.45))&&S.ticketDeck.length&&p.tickets.length<5)return{t:'tickets'};
      const any=bestDrive(p,S.segs.map(s=>({s,pr:(net.has(s.a)||net.has(s.b))?3:0})));
      if(any&&(any.s.len>=2||p.trains<=4))return{t:'drive',si:any.s.i,o:any.o};
    }
    if(Math.random()<.2){const wi=S.market.indexOf('W');if(wi>=0)return{t:'market',i:wi}}
  }
  // draw what the wanted segments need
  const need={};let mostC=COLS[0],mostN=-1;COLS.forEach(c=>{if((p.hand[c]||0)>mostN){mostN=p.hand[c]||0;mostC=c}});
  for(const si of want.keys()){const s=S.segs[si],c=s.c==='any'?mostC:s.c;need[c]=(need[c]||0)+s.len-(p.hand[c]||0)}
  let idx=-1,bv=0;S.market.forEach((c,i)=>{if(c&&c!=='W'&&(need[c]||0)>bv){bv=need[c];idx=i}});
  if(idx>=0)return{t:'market',i:idx};
  if(S.deck.length+S.discard.length)return{t:'deck'};
  const j=S.market.findIndex(x=>x&&x!=='W');if(j>=0)return{t:'market',i:j};
  if(S.drawn===0&&S.market.indexOf('W')>=0)return{t:'market',i:S.market.indexOf('W')};
  return null;
}

/* ===== the clock: bots think, then act; humans who run out of time are auto-played ===== */
const AWAY_GRACE=3000,THINK=1100;
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
    const timedOut=!p.bot&&!p.away&&now>=S.turnEnds;
    if(!timedOut){ // a short think so people can follow along (none when a human's time ran out)
      const k=(MODES[S.mode].think||1)*(S.drawn?.55:1);
      if(!S.thinkAt){S.thinkAt=now+THINK*k*PACE;break}if(now<S.thinkAt)break;
    }
    S.thinkAt=null;
    const a=botNext(p);
    if(!a){endTurn(now);continue}
    run(p.id,a,now);
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
  if(p.bot||(p.away&&now>=S.turnStart+AWAY_GRACE)){if(S.thinkAt)return S.thinkAt;return now}
  if(p.away)return Math.min(S.turnEnds,S.turnStart+AWAY_GRACE);
  return S.turnEnds;
}
function handBack(seat){if(S.turn===seat){S.plan=null;S.thinkAt=null}}

/* ===== what one seat may see: everything public, plus its own hand, tickets and offers.
   Seats are rotated so the viewer is always player 0. ===== */
function view(v){
  const n=S.players.length,R=s=>s===null||s===undefined?s:(s-v+n)%n,order=S.players.map((_,i)=>(v+i)%n);
  return{
    game:'metro',mode:S.mode,solo:S.solo,phase:S.phase,over:S.over,turn:R(S.turn),round:S.round,drawn:S.drawn,lastTurns:S.lastTurns,
    market:S.market,deckN:S.deck.length,discardN:S.discard.length,ticketDeckN:S.ticketDeck.length,
    owners:S.segs.map(s=>R(s.owner)),
    jams:S.segs.map(s=>s.jam&&s.jam.until>S.round?{s:R(s.jam.s),until:s.jam.until}:null),
    fail:S.fail&&S.fail.until>S.round?S.fail.si:null,
    players:order.map(s=>{const p=S.players[s],me=s===v;
      return{seat:s,name:p.name,col:p.col,bot:p.bot,away:p.away,trains:p.trains,handN:handN(p),hand:me?p.hand:null,
        tickets:me||S.over?p.tickets:null,ticketsN:p.tickets.length,choosing:!!S.offers[s],jam:p.jam,at:p.at,pts:routePts(s),
        done:me?p.tickets.map(t=>connected(p,t.a,t.b)):null}}),
    offer:S.offers[v]||null,
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
  payOptions:(seat,si)=>{const p=S.players[seat],s=S.segs[si];return s.owner!==null?[]:payOptions(p,s,!touches(p,s))},
  touches:(seat,si)=>touches(S.players[seat],S.segs[si]),
  blocked:si=>blocked(S.segs[si]),
  load(x){S=x},get S(){return S},setPace(k){PACE=k>0?k:1},
  setPos(){},
  setAway(seat,away){const p=S&&S.players[seat];if(!p)return;p.away=!!away;if(!away&&!p.bot)handBack(seat)},
  takeOver(seat,name){const p=S&&S.players[seat];if(p){p.bot=false;p.away=false;p.name=name;handBack(seat);addLog(`${name} joined and took over a robot’s seat.`,'good')}},
  toBot(seat){const p=S&&S.players[seat];if(p){p.bot=true;p.away=false}},
};
}
