// Runs the school check script against fake Google services. Called by tests/test_apps_script.py.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.argv[2], 'utf8');
function world(active, owner, opts) {
  const rows = [], props = {}; let made = 0, locked = false;
  const sheet = { appendRow: (r) => rows.push(r) };
  const s = {
    Session: { getActiveUser: () => ({ getEmail: () => { if (opts && opts.throwIdentity) throw new Error('nope'); return active; } }), getEffectiveUser: () => ({ getEmail: () => owner }) },
    SpreadsheetApp: { create: () => { made++; return { getId: () => 'id1', getSheets: () => [sheet] }; }, openById: () => ({ getSheets: () => [sheet] }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !(opts && opts.busy) && (locked = true), releaseLock: () => { locked = false; } }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) }, Date, String, Number,
  };
  vm.createContext(s);
  vm.runInContext(src + '\nthis.api={doGet,whoAmI,saveTest};', s);
  return { api: s.api, rows, made: () => made, locked: () => locked };
}
const page = world('a', 'a@s.org').api.doGet().html;
new vm.Script(page.split('<script>')[1].split('</script>')[0]);     // the page's script must parse
assert.match(page, /usermbit\.org/);

let w = world('teacher@s.org', 'teacher@s.org').api.whoAmI();
assert.ok(w.identityVisible && w.isOwner && w.sameDomain);
assert.strictEqual(w.shown, 't***@s.org');
assert.ok(!JSON.stringify(w).includes('teacher@'));                 // full address never sent

w = world('kid@s.org', 'teacher@s.org').api.whoAmI();
assert.ok(w.identityVisible && !w.isOwner && w.sameDomain);
w = world('', 'teacher@s.org').api.whoAmI();
assert.ok(!w.identityVisible && !w.isOwner && w.shown === '');
w = world('', 'teacher@s.org', { throwIdentity: true }).api.whoAmI();
assert.strictEqual(w.problem, 'nope');

const x = world('k@s.org', 't@s.org');
x.api.saveTest('run', 1); x.api.saveTest('run', 2);
assert.strictEqual(x.made(), 1);                                    // one Sheet, reused
assert.strictEqual(x.rows.length, 2);
assert.strictEqual(x.locked(), false);
assert.ok(!JSON.stringify(x.rows).includes('@'));                   // no emails saved
assert.throws(() => world('k', 't', { busy: true }).api.saveTest('r', 1), /Timed out/);
console.log('school check passed');
