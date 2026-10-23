/* Runs the dead-end search off the main thread so the board never stutters. */
importScripts('engine.js');
self.onmessage = e => {
  const d = e.data;
  const g = { cols: d.cols, stock: d.stock, completed: d.completed, history: [], won: false };
  let stuck = false;
  try { stuck = self.ES.Engine.isStuck(g); } catch (err) { stuck = false; }
  self.postMessage({ id: d.id, session: d.session, revision: d.revision, stuck });
};
