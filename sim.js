global.window = global;
require('./src/data.js');
require('./src/engine.js');
require('./src/ai.js');
const E = global.Engine, AI = global.AI;
let results = {};
for (const diff of ['easy', 'normal', 'hard']) {
  let over = 0, errs = 0, turns = [], deads = [];
  const N = 20;
  for (let n = 0; n < N; n++) {
    try {
      const g = E.newGame({ humanSeat: Math.random() < .5 ? 'N' : 'S', difficulty: diff });
      let steps = 0;
      while (!g.over && steps < 4000) {
        const t = g.turn;
        AI.step(g, t);
        steps++;
        if (!g.over && g.turn === t && steps % 50 === 0) E.endTurn(g);
      }
      if (g.over) { over++; turns.push(g.turnNo); deads.push(g.players[0].dead.length, g.players[1].dead.length); }
      else console.log('unfinished', diff, n, g.turnNo, g.players[0].dead.length, g.players[1].dead.length);
    } catch (e) { errs++; console.log('ERR', diff, e.stack); }
  }
  results[diff] = {
    games: N, over, errs,
    avgTurns: turns.length ? +(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1) : 0,
    maxTurns: turns.length ? Math.max(...turns) : 0,
    avgDead: deads.length ? +(deads.reduce((a, b) => a + b, 0) / deads.length).toFixed(1) : 0,
  };
}
console.log(JSON.stringify(results, null, 1));
