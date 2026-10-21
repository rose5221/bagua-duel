global.window = global;
require('./src/data.js');
require('./src/engine.js');
require('./src/ai.js');
const E = global.Engine, AI = global.AI;
function sig(g) {
  return [g.turn, g.actionsLeft, g.skillLeft, g.players[0].dead.length, g.players[1].dead.length,
    Object.values(g.board).filter(Boolean).length, Object.keys(g.players[0].skillUsed).length].join('|');
}
let over = 0, stuck = 0, errs = 0, turns = [], deads = [];
const N = 30;
for (let n = 0; n < N; n++) {
  try {
    const g = E.newGame({ humanSeat: Math.random() < .5 ? 'N' : 'S' });
    let steps = 0;
    while (!g.over && steps < 20000) {
      const b = sig(g);
      AI.step(g, g.turn);
      steps++;
      if (!g.over && sig(g) === b) { stuck++; break; }
    }
    if (g.over) { over++; turns.push(g.turnNo); deads.push(g.players[0].dead.length, g.players[1].dead.length); }
    else console.log('unfinished', n, g.turnNo, g.players[0].dead.length, g.players[1].dead.length);
  } catch (e) { errs++; console.log('ERR', e.stack); }
}
console.log(JSON.stringify({ games: N, over, stuck, errs, avgTurns: turns.length ? +(turns.reduce((a,b)=>a+b,0)/turns.length).toFixed(1) : 0, maxTurns: turns.length ? Math.max(...turns) : 0, avgDead: deads.length ? +(deads.reduce((a,b)=>a+b,0)/deads.length).toFixed(1) : 0 }, null, 1));
