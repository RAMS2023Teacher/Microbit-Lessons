// Runs the Apps Script file against a fake Google Classroom. Called by tests/test_apps_script.py.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.argv[2], 'utf8');

function world() {
  const store = {}, patched = [], created = [];
  let n = 0;
  const roster = [{ userId: 'u1', profile: { name: { fullName: 'Sam Kim' } } }, { userId: 'u2', profile: { name: { fullName: 'Ana Ruiz' } } },
    { userId: 'u3', profile: { name: { fullName: 'Ben Lee' } } }, { userId: 'u4', profile: { name: { fullName: 'Ben Long' } } }];
  const works = {};
  const Classroom = { Courses: {
    list: () => ({ courses: [{ id: 'c1', name: 'Period 1', section: 'A' }] }),
    Students: { list: () => ({ students: roster }) },
    CourseWork: {
      get: (c, id) => { if (!works[id]) throw new Error('not found'); return works[id]; },
      create: (w) => { assert.ok(w.maxPoints === 100 && w.workType === 'ASSIGNMENT'); const id = 'w' + (++n); works[id] = { ...w, id }; created.push(works[id]); return works[id]; },
      StudentSubmissions: {
        list: (c, w) => ({ studentSubmissions: roster.slice(0, 3).map((r) => ({ id: w + r.userId, userId: r.userId })) }),
        patch: (body, c, w, id, opt) => {
          if (id.endsWith('u3')) throw new Error('boom');
          assert.deepStrictEqual(Object.keys(body), ['draftGrade']);
          assert.strictEqual(opt.updateMask, 'draftGrade');
          patched.push({ id, grade: body.draftGrade });
          return {};
        },
      },
    },
  } };
  const PropertiesService = { getUserProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = v; } }) };
  const sandbox = { Classroom, PropertiesService, HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) }, console, Date, Set, JSON };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.api={doGet,listCourses,loadCourse,sendGrades,suggestMatches};', sandbox);
  return { api: sandbox.api, patched, created, works, store };
}

const pkg = (due) => JSON.stringify({ source: 'microbit-maker-lab', version: 1, assignments: [{ key: 'blink', title: 'Blink', due }],
  students: [{ ref: 's1', name: 'Sam K.', grades: { blink: 80 } }, { ref: 's2', name: 'Ana', grades: { blink: 100 } },
    { ref: 's3', name: 'Ben', grades: { blink: 50 } }, { ref: 's4', name: 'Ben L.', grades: {} }, { ref: 's5', name: 'Zed Q', grades: { blink: 'A' } }] });

let w = world();
assert.match(w.api.doGet().html, /Send draft grades/);
assert.strictEqual(w.api.listCourses()[0].name, 'Period 1 - A');
assert.throws(() => w.api.loadCourse('c1', 'nope'), /not a grades package/);

const loaded = w.api.loadCourse('c1', pkg('2999-01-02'));
assert.strictEqual(loaded.matches.s1, 'u1');       // first name + last initial
assert.strictEqual(loaded.matches.s2, 'u2');       // only one Ana
assert.strictEqual(loaded.matches.s3, '');         // two Bens: never guess
assert.strictEqual(loaded.matches.s4, '');         // Ben L. fits both Lee and Long
assert.strictEqual(loaded.matches.s5, '');

const m = { s1: 'u1', s2: 'u2', s3: 'u3', s4: '', s5: '' };
let r = w.api.sendGrades('c1', pkg('2999-01-02'), m);
assert.strictEqual(r.sent, 2);
assert.strictEqual(r.errors.length, 1);            // one failure doesn't stop the rest
assert.ok(r.skipped.some((t) => t.startsWith('Ben L.')));
assert.deepStrictEqual(w.patched.map((p) => p.grade).sort(), [100, 80]);
assert.strictEqual(JSON.stringify(w.created[0].dueDate), JSON.stringify({ year: 2999, month: 1, day: 2 }));

// Sending again updates grades without making a second assignment, and remembers the matches.
w.api.sendGrades('c1', pkg('2999-01-02'), m);
assert.strictEqual(w.created.length, 1);
assert.strictEqual(w.api.loadCourse('c1', pkg('2999-01-02')).matches.s3, 'u3');

// An assignment deleted in Classroom gets remade. Past due dates are left off.
for (const k of Object.keys(w.works)) delete w.works[k];
w.api.sendGrades('c1', pkg('2001-01-02'), m);
assert.strictEqual(w.created.length, 2);
assert.strictEqual(w.created[1].dueDate, undefined);
console.log('apps script checks passed');
