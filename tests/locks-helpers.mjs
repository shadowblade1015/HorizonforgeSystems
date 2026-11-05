// Deterministic Web Locks adapter. Each world is one storage-origin partition;
// request callbacks hold ownership until their returned promise settles.
export function lockWorld({ deferred = false } = {}) {
  const held = new Map();
  function endpoint() {
    return { request(name, options, callback) {
      const request = () => {
        if (options.mode !== 'exclusive' || !options.ifAvailable) throw Error('Expected nonqueued exclusive acquisition');
        if (held.has(name)) return callback(null);
        const token = {}; held.set(name, token);
        let work;
        try { work = callback({ name, mode: 'exclusive' }); }
        catch (e) { held.delete(name); throw e; }
        return Promise.resolve(work).finally(() => { if (held.get(name) === token) held.delete(name); });
      };
      return deferred ? Promise.resolve().then(request) : request();
    } };
  }
  return { endpoint, held };
}
