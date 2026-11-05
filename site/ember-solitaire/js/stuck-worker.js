/* One position search at a time. Board terminates obsolete/timed-out workers. */
importScripts('engine.js');
self.onmessage = e => {
  const d = e.data;
  const g = { cols: d.cols, stock: d.stock, completed: d.completed, history: [], won: false };
  const identity = { id: d.id, session: d.session, revision: d.revision };
  if (!d.type) { // Compatibility for the original stuck-only message shape.
    let stuck = false;
    try { stuck = self.ES.Engine.isStuck(g); } catch (_) { /* Unknown, never stuck on failure. */ }
    self.postMessage(Object.assign(identity, { stuck })); return;
  }
  Object.assign(identity, { type: d.type, workEpoch: d.workEpoch });
  const started = performance.now();
  try {
    if (d.type === 'endgame') {
      const plan = self.ES.Engine.solveEndgame(g, 20000);
      // Null does not prove impossibility: the existing DFS has a node budget.
      self.postMessage(Object.assign(identity, { status: plan ? 'solved' : 'no-plan-within-budget', plan, elapsedMs: performance.now() - started }));
    } else if (d.type === 'stuck') {
      const stuck = self.ES.Engine.isStuck(g);
      self.postMessage(Object.assign(identity, { status: 'checked', stuck, elapsedMs: performance.now() - started }));
    } else throw Error('Unsupported search');
  } catch (_) {
    self.postMessage(Object.assign(identity, { status: 'unavailable', stuck: false, plan: null, elapsedMs: performance.now() - started }));
  }
};
