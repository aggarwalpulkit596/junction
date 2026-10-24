// Robustness check of the online engine: humans who never act, drop out, come back, or are replaced must never stall a game.
//   node mp/timeout-check.mjs
import * as EUROPE from '../worker/rules.gen.js';
import * as METRO from '../metro/rules.js';
for (const [game, { makeEngine, MODES }] of Object.entries({ europe: EUROPE, metro: METRO })) for (const mode of Object.keys(MODES)) for (const scenario of ['idle','away','return','takeover']) {
  let worst=0,stalls=0,busy=0;
  for (let g=0;g<30;g++){
    const E=makeEngine();let now=0;
    E.newGame([{name:'A'},{name:'B'},{name:'Rose',bot:true},{name:'Mint',bot:true}],mode,now);
    if(scenario!=='idle')E.setAway(1,true);
    let n=0;
    while(!E.S.over&&n++<20000){
      E.tick(now);const w=E.nextWake(now);if(w===null)break;
      if(w<=now)busy++;
      if(scenario==='return'&&E.S.round===4&&E.S.players[1].away)E.setAway(1,false);
      if(scenario==='takeover'&&E.S.round===3&&E.S.players[2].bot&&E.S.turn===2&&(E.S.plan||E.S.thinkAt)){E.takeOver(2,'Cy')}
      now=Math.max(now+1,w);
    }
    if(!E.S.over)stalls++;worst=Math.max(worst,now/60000);
  }
  console.log(game,mode,scenario,'stalls',stalls,'max minutes',worst.toFixed(1),'zero-delay wakes',busy);
  if(stalls)process.exitCode=1;
}
