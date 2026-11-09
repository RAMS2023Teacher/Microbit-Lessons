// A small in-memory stand-in for the Google services Maker Lab uses, so the generated
// Apps Script files can run in Node (tests) and behind a local web server (browser tests).
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');

function makeWorld(dist, opts) {
  opts = opts || {};
  const owner = opts.owner || 'teacher@school.org';
  const state = { user: owner, files: {}, folders: {}, props: {}, cache: {}, nextId: 1, clock: Date.now() };
  const newId = (p) => p + (state.nextId++);
  const tick = () => (state.clock += 1000);

  function fileObj(id) {
    const f = state.files[id];
    if (!f) throw new Error('No item with the given ID could be found.');
    return {
      getId: () => id, getName: () => f.name,
      setContent: (t) => { f.content = String(t); f.modified = tick(); return fileObj(id); },
      getBlob: () => ({ getDataAsString: () => f.content }),
      getLastUpdated: () => new Date(f.modified),
    };
  }
  function folderObj(id) {
    if (!state.folders[id]) throw new Error('No item with the given ID could be found.');
    return {
      getId: () => id,
      createFolder: (name) => { const nid = newId('fo'); state.folders[nid] = { name, parent: id }; return folderObj(nid); },
      createFile: (name, content, mime) => {
        const nid = newId('fi');
        state.files[nid] = { name, content: String(content), mime, parent: id, modified: tick() };
        return fileObj(nid);
      },
      searchFiles: (q) => {
        const m = /modifiedDate > '([^']+)'/.exec(q);
        const since = m ? Date.parse(m[1] + 'Z') : 0;
        const hits = Object.keys(state.files).filter((k) => state.files[k].parent === id && state.files[k].modified > since);
        let i = 0;
        return { hasNext: () => i < hits.length, next: () => fileObj(hits[i++]) };
      },
    };
  }
  // the script sees this world's clock, so tests can move time forward
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(state.clock); }
    static now() { return state.clock; }
  }
  const blob = (bytes, type) => ({ bytes: Buffer.from(bytes), type, getDataAsString: () => Buffer.from(bytes).toString('utf8') });

  const g = {
    console, JSON, Math, Date: FakeDate, Object, Array, String, Number, Boolean, RegExp, Error, encodeURIComponent, decodeURIComponent,
    Session: {
      getActiveUser: () => ({ getEmail: () => state.user || '' }),
      getEffectiveUser: () => ({ getEmail: () => owner }),
      getScriptTimeZone: () => 'America/New_York',
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in state.props ? state.props[k] : null),
      setProperty: (k, v) => { state.props[k] = String(v); },
      deleteProperty: (k) => { delete state.props[k]; },
      getProperties: () => Object.assign({}, state.props),
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (k in state.cache ? state.cache[k] : null),
      put: (k, v) => { if (String(v).length > 100000) throw new Error('Argument too large: value'); state.cache[k] = String(v); },
      remove: (k) => { delete state.cache[k]; },
    }) },
    DriveApp: {
      createFolder: (name) => { const id = newId('fo'); state.folders[id] = { name, parent: 'root' }; return folderObj(id); },
      getFolderById: folderObj, getFileById: fileObj,
    },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const iso = new Date(d).toISOString();
        if (fmt === 'yyyy-MM-dd') return iso.slice(0, 10);
        return iso.slice(0, 19);
      },
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, type) => blob(bytes, type),
      ungzip: (b) => blob(zlib.gunzipSync(b.bytes)),
    },
    UrlFetchApp: { fetch: (url) => {
      const name = /v1\.1\.1/.test(url) ? 'micropython-v1.hex' : 'micropython-v2.hex';
      const text = fs.readFileSync(path.join(__dirname, '../../app/static/vendor/microbit', name), 'utf8');
      return { getContentText: () => text };
    } },
    ScriptApp: { getService: () => ({ getUrl: () => opts.url || 'https://script.google.com/a/macros/school.org/s/TEST/exec' }) },
    HtmlService: {
      createHtmlOutputFromFile: (name) => ({ getContent: () => fs.readFileSync(path.join(dist, name + '.html'), 'utf8') }),
      createHtmlOutput: (html) => {
        const out = { html, title: '', setTitle(t) { out.title = t; return out; }, addMetaTag() { return out; }, getContent: () => out.html };
        return out;
      },
    },
  };
  vm.createContext(g);
  for (const f of fs.readdirSync(dist).filter((n) => n.endsWith('.gs')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(dist, f), 'utf8'), g, { filename: f });
  }
  /** Calls a server function as a given Google account, like google.script.run does (JSON in, JSON out). */
  function call(user, fn, args) {
    state.user = user;
    if (typeof g[fn] !== 'function' || fn.endsWith('_')) throw new Error('Script function not found: ' + fn);
    const out = g[fn].apply(null, JSON.parse(JSON.stringify(args || [])));
    return out === undefined ? undefined : JSON.parse(JSON.stringify(out));
  }
  function page(user, p) {
    state.user = user;
    return g.doGet({ parameter: p ? { p } : {} });
  }
  return { g, state, call, page, owner, advance: (ms) => { state.clock += ms; } };
}

module.exports = { makeWorld };
