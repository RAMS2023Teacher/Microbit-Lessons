/**
 * micro:bit Maker Lab to Google Classroom
 * Paste this whole file into a new project at script.google.com.
 * Setup steps are on your class's "Send grades to Google Classroom" page.
 *
 * It runs under your own Google account. Grades are saved as DRAFTS:
 * students can't see them until you return them in Classroom.
 */
const SOURCE = 'microbit-maker-lab';
const MAX_POINTS = 100;
const TIME_LIMIT_MS = 5 * 60 * 1000;   // Apps Script stops long runs, so finish cleanly before that

function doGet() {
  return HtmlService.createHtmlOutput(PAGE).setTitle('Maker Lab to Classroom');
}

function allPages_(fetchPage, key) {
  let out = [], pageToken;
  do {
    const r = fetchPage(pageToken);
    out = out.concat(r[key] || []);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

function listCourses() {
  return allPages_((pageToken) => Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50, pageToken }), 'courses')
    .map((c) => ({ id: c.id, name: c.section ? c.name + ' - ' + c.section : c.name }));
}

function parsePackage_(text) {
  let pkg;
  try { pkg = JSON.parse(text); } catch (e) { throw new Error('That is not a grades package. Copy it from the Maker Lab page again.'); }
  if (!pkg || pkg.source !== SOURCE || pkg.version !== 1 || !Array.isArray(pkg.assignments) || !Array.isArray(pkg.students)) {
    throw new Error('That is not a grades package. Copy it from the Maker Lab page again.');
  }
  return pkg;
}

function roster_(courseId) {
  return allPages_((pageToken) => Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken }), 'students')
    .map((s) => ({ id: s.userId, name: (s.profile && s.profile.name && s.profile.name.fullName) || 'Unknown student' }));
}

function words_(name) {
  return String(name).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Suggests a roster id for each student. Only suggests when exactly one person fits. */
function suggestMatches(students, roster, saved) {
  const rosterIds = new Set(roster.map((r) => r.id));
  const onlyOne = (test) => {
    const hits = roster.filter(test);
    return hits.length === 1 ? hits[0].id : '';
  };
  const out = {};
  students.forEach((s) => {
    if (saved[s.ref] && rosterIds.has(saved[s.ref])) { out[s.ref] = saved[s.ref]; return; }
    const w = words_(s.name);
    const first = w[0], last = w[w.length - 1];
    out[s.ref] = onlyOne((r) => words_(r.name).join(' ') === w.join(' '));
    if (!out[s.ref] && w.length > 1) {        // "Sam K." or "Sam Kim"
      out[s.ref] = onlyOne((r) => {
        const n = words_(r.name);
        return n[0] === first && n[n.length - 1].charAt(0) === last.charAt(0);
      });
    }
    if (!out[s.ref] && w.length === 1) out[s.ref] = onlyOne((r) => words_(r.name)[0] === first);
  });
  return out;
}

function matchKey_(courseId) { return 'match:' + courseId; }

function loadCourse(courseId, pkgText) {
  const pkg = parsePackage_(pkgText);
  const roster = roster_(courseId);
  const saved = JSON.parse(PropertiesService.getUserProperties().getProperty(matchKey_(courseId)) || '{}');
  return { roster, matches: suggestMatches(pkg.students, roster, saved), students: pkg.students, assignments: pkg.assignments };
}

function futureDue_(due) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due || '');
  if (!m) return null;
  const date = { year: +m[1], month: +m[2], day: +m[3] };
  // Classroom only accepts due dates that haven't passed yet.
  return new Date(date.year, date.month - 1, date.day, 23, 59) > new Date() ? date : null;
}

function ensureCourseWork_(courseId, a, props) {
  const key = 'work:' + courseId + ':' + a.key;
  const known = props.getProperty(key);
  if (known) {
    try { return Classroom.Courses.CourseWork.get(courseId, known).id; } catch (e) { /* deleted in Classroom: make a new one */ }
  }
  const work = { title: a.title, description: 'Grades from micro:bit Maker Lab.', workType: 'ASSIGNMENT', state: 'PUBLISHED', maxPoints: MAX_POINTS };
  const due = futureDue_(a.due);
  if (due) { work.dueDate = due; work.dueTime = { hours: 23, minutes: 59 }; }
  const id = Classroom.Courses.CourseWork.create(work, courseId).id;
  props.setProperty(key, id);
  return id;
}

/** Creates any missing assignments and saves draft grades. Safe to run again. */
function sendGrades(courseId, pkgText, matches) {
  const started = Date.now();
  const pkg = parsePackage_(pkgText);
  const props = PropertiesService.getUserProperties();
  props.setProperty(matchKey_(courseId), JSON.stringify(matches));
  const results = { sent: 0, skipped: [], errors: [], unfinished: false };

  pkg.students.forEach((s) => { if (!matches[s.ref]) results.skipped.push(s.name + ': not matched to the roster'); });

  for (const a of pkg.assignments) {
    const todo = pkg.students.filter((s) => matches[s.ref] && validGrade_(s.grades[a.key]));
    if (!todo.length) continue;
    let workId, subs;
    try {
      workId = ensureCourseWork_(courseId, a, props);
      subs = allPages_((pageToken) => Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, workId, { pageSize: 100, pageToken }), 'studentSubmissions');
    } catch (e) {
      results.errors.push(a.title + ': ' + e.message);
      continue;
    }
    const byUser = {};
    subs.forEach((sub) => { byUser[sub.userId] = sub.id; });
    for (const s of todo) {
      if (Date.now() - started > TIME_LIMIT_MS) { results.unfinished = true; return results; }
      const subId = byUser[matches[s.ref]];
      if (!subId) { results.skipped.push(s.name + ': no submission for ' + a.title); continue; }
      try {
        Classroom.Courses.CourseWork.StudentSubmissions.patch({ draftGrade: s.grades[a.key] }, courseId, workId, subId, { updateMask: 'draftGrade' });
        results.sent++;
      } catch (e) {
        results.errors.push(s.name + ', ' + a.title + ': ' + e.message);
      }
    }
  }
  return results;
}

function validGrade_(g) { return typeof g === 'number' && g >= 0 && g <= MAX_POINTS; }

const PAGE = String.raw`<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font:16px/1.5 system-ui,sans-serif;color:#12283f;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:1.5rem}textarea,select{width:100%;font:inherit;padding:8px;box-sizing:border-box;border:1px solid #9fc3de;border-radius:8px}
button{font:inherit;font-weight:700;padding:9px 16px;border:0;border-radius:999px;background:#0b6fb0;color:#fff;cursor:pointer;margin:10px 0}
button:disabled{opacity:.5}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{text-align:left;padding:6px;border-bottom:1px solid #d7e6f2}
.card{background:#f3f9fe;padding:14px 16px;border-radius:12px;margin:14px 0}.bad{color:#b32626}.ok{color:#176b2c}[hidden]{display:none}
</style></head><body>
<h1>Maker Lab to Google Classroom</h1>
<div class="card"><b>1. Paste your grades</b><p>Copy them from your class's page in Maker Lab.</p>
<textarea id="pkg" rows="4" aria-label="Grades package"></textarea>
<button id="load">Continue</button></div>
<div class="card" id="courseBox" hidden><b>2. Pick your Classroom class</b><select id="course" aria-label="Classroom class"></select><button id="next">Match students</button></div>
<div class="card" id="matchBox" hidden><b>3. Check each student</b><p>Only students with a grade are sent. Fix any blank ones.</p><table><tbody id="rows"></tbody></table>
<p id="summary"></p><button id="send">Send draft grades</button></div>
<div class="card" id="doneBox" hidden><b>Finished</b><div id="done"></div></div>
<p id="msg" class="bad" role="status"></p>
<script>
var $=function(id){return document.getElementById(id)},data=null;
function fail(e){$('msg').textContent=e.message||String(e);busy(false)}
function busy(on){['load','next','send'].forEach(function(id){$(id).disabled=on});if(on)$('msg').textContent=''}
function run(name,args,done){busy(true);var r=google.script.run.withFailureHandler(fail).withSuccessHandler(function(v){busy(false);done(v)});r[name].apply(r,args)}
$('load').onclick=function(){run('listCourses',[],function(list){var s=$('course');s.textContent='';list.forEach(function(c){var o=s.appendChild(document.createElement('option'));o.value=c.id;o.textContent=c.name});if(!list.length){fail('No active classes where you are the teacher.');return}$('courseBox').hidden=false})};
$('next').onclick=function(){run('loadCourse',[$('course').value,$('pkg').value],function(v){data=v;var t=$('rows');t.textContent='';v.students.forEach(function(s){var tr=t.appendChild(document.createElement('tr')),a=tr.appendChild(document.createElement('td'));a.textContent=s.name;var b=tr.appendChild(document.createElement('td')),sel=b.appendChild(document.createElement('select'));sel.dataset.ref=s.ref;sel.setAttribute('aria-label','Classroom student for '+s.name);var none=sel.appendChild(document.createElement('option'));none.value='';none.textContent='Do not send';v.roster.forEach(function(r){var o=sel.appendChild(document.createElement('option'));o.value=r.id;o.textContent=r.name});sel.value=v.matches[s.ref]||'';});$('summary').textContent=v.assignments.length+' Classroom assignment(s) will be made if they do not exist yet. Students will see those assignments, but not the draft grades.';$('matchBox').hidden=false})};
$('send').onclick=function(){if(!confirm('Send draft grades to this class? Students see the assignment, not the grades, until you return them.'))return;var m={};document.querySelectorAll('#rows select').forEach(function(s){m[s.dataset.ref]=s.value});run('sendGrades',[$('course').value,$('pkg').value,m],function(r){var d=$('done');d.textContent='';var line=function(t,c){var p=d.appendChild(document.createElement('p'));p.textContent=t;if(c)p.className=c};line(r.sent+' draft grade(s) saved. Open Classroom to review and return them.','ok');if(r.unfinished)line('Time ran out before finishing. Press Send again to continue.','bad');r.skipped.forEach(function(t){line('Skipped: '+t)});r.errors.forEach(function(t){line('Problem: '+t,'bad')});$('doneBox').hidden=false})};
</script></body></html>`;
