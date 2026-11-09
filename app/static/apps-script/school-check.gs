/**
 * micro:bit Maker Lab: school account check
 * Finds out what your school's Google accounts allow, before the site is moved into Apps Script.
 * Steps are in docs/SCHOOL_CHECK.md.
 *
 * It saves no names or email addresses. The test Sheet only holds times and run numbers.
 */
const SHEET_ID = 'checkSheetId';
const FOLDER_ID = 'checkFolderId';

function doGet() {
  return HtmlService.createHtmlOutput(PAGE).setTitle('Maker Lab school check');
}

function domain_(email) {
  return String(email).split('@')[1] || '';
}

function mask_(email) {
  return email ? email.charAt(0) + '***@' + domain_(email) : '';
}

/** What Apps Script can tell about the visitor. The full address never reaches the page. */
function whoAmI() {
  let email = '', problem = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    problem = e.message;
  }
  const owner = Session.getEffectiveUser().getEmail() || '';
  return {
    identityVisible: !!email,
    isOwner: !!email && email === owner,
    sameDomain: !!email && domain_(email) === domain_(owner),
    shown: mask_(email),
    problem: problem,
  };
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(SHEET_ID);
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  const book = SpreadsheetApp.create('Maker Lab school check (safe to delete)');
  props.setProperty(SHEET_ID, book.getId());
  return book.getSheets()[0];
}

/** Saves one row the way student work would be saved, and reports how long it took. */
function saveTest(run, index) {
  const started = Date.now();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Timed out waiting for the Sheet.');
  try {
    sheet_().appendRow([new Date(), String(run).slice(0, 12), Number(index) || 0]);
  } finally {
    lock.releaseLock();
  }
  return Date.now() - started;
}

/** Makes the test folder once, before a class test starts, so 30 saves don't race to create it. */
function prepareFolder() {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Timed out preparing the folder.');
  try {
    let id = props.getProperty(FOLDER_ID);
    if (!id) {
      id = DriveApp.createFolder('Maker Lab school check files (safe to delete)').getId();
      props.setProperty(FOLDER_ID, id);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Design B: one small file per student. No shared lock, so students never wait for each other. */
function saveFileTest(run, index) {
  const started = Date.now();
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(FOLDER_ID));
  const body = JSON.stringify({ run: String(run).slice(0, 12), student: Number(index) || 0, at: new Date().toISOString() });
  const file = folder.createFile('student-' + (Number(index) || 0) + '-' + String(run).slice(0, 12) + '.json', body, 'application/json');
  file.setContent(body + ' ');   // a second save to the same file, like a student saving again
  return Date.now() - started;
}

/** Design C: save to the fast cache now; a background job copies it into the Sheet later. */
function saveCacheTest(run, index) {
  const started = Date.now();
  CacheService.getScriptCache().put('save:' + String(run).slice(0, 12) + ':' + (Number(index) || 0),
    JSON.stringify({ at: new Date().toISOString() }), 21600);
  return Date.now() - started;
}

/** The background copy for design C: all cached saves go into the Sheet in one write. */
function flushCacheTest(run, count) {
  const started = Date.now();
  const keys = [];
  for (let i = 1; i <= Math.min(Number(count) || 0, 100); i++) keys.push('save:' + String(run).slice(0, 12) + ':' + i);
  const found = CacheService.getScriptCache().getAll(keys);
  const rows = Object.keys(found).map((k) => [new Date(), k.split(':')[1], Number(k.split(':')[2])]);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Timed out waiting for the Sheet.');
  try {
    if (rows.length) {
      const sh = sheet_();
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    }
  } finally {
    lock.releaseLock();
  }
  return { copied: rows.length, ms: Date.now() - started };
}

const PAGE = String.raw`<!doctype html><html><head><base target="_blank"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font:16px/1.5 system-ui,sans-serif;color:#12283f;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:1.5rem;margin-bottom:0}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:8px 6px;border-bottom:1px solid #d7e6f2;vertical-align:top}
td:first-child{width:2em}td:last-child{white-space:nowrap;text-align:right}button{font:inherit;font-weight:700;padding:6px 14px;border:0;border-radius:999px;background:#0b6fb0;color:#fff;cursor:pointer;margin:2px}
button.no{background:#fff;color:#0b6fb0;border:1px solid #0b6fb0}button:disabled{opacity:.5}small{color:#44566c}textarea{width:100%;font:13px monospace;box-sizing:border-box;padding:8px}
.sim{width:240px;height:198px;border:0}.hide{display:none}
</style></head><body>
<h1>Maker Lab school check</h1>
<p>Press each blue button. Nothing here saves your name or email.</p>
<table><tbody id="rows"></tbody></table>
<iframe id="sim" class="sim" title="micro:bit simulator test" sandbox="allow-scripts allow-same-origin"></iframe>
<h2>Your results</h2>
<p>Send this text back. It has no names or email addresses.</p>
<textarea id="out" rows="14" readonly aria-label="Results"></textarea>
<script>
var RUN=Math.random().toString(36).slice(2,10),state={},order=[],SIM='https://python-simulator.usermbit.org';
var $=function(id){return document.getElementById(id)};
function row(key,label,html){order.push(key);state[key]={label:label,icon:'…',note:'not tested yet'};var tr=$('rows').appendChild(document.createElement('tr'));tr.id='r-'+key;tr.appendChild(document.createElement('td'));var td=tr.appendChild(document.createElement('td'));td.appendChild(document.createElement('b')).textContent=label;td.appendChild(document.createElement('br'));td.appendChild(document.createElement('small'));var a=tr.appendChild(document.createElement('td'));if(html)html(a);draw(key)}
function draw(key){var tr=$('r-'+key),s=state[key];tr.children[0].textContent=s.icon;tr.querySelector('small').textContent=s.note;var lines=['Maker Lab school check'];order.forEach(function(k){lines.push(state[k].icon+' '+state[k].label+': '+state[k].note)});lines.push('Browser: '+navigator.userAgent);$('out').value=lines.join('\n')}
function set(key,ok,note){state[key].icon=ok===true?'✅':ok===false?'❌':'…';state[key].note=note;draw(key)}
function button(cell,label,fn,cls){var b=cell.appendChild(document.createElement('button'));b.textContent=label;if(cls)b.className=cls;b.addEventListener('click',fn);return b}
function call(name,args){return new Promise(function(ok,no){var r=google.script.run.withSuccessHandler(ok).withFailureHandler(no);r[name].apply(r,args||[])})}
function yesNo(key,yes,no){return function(cell){button(cell,'Yes',function(){set(key,true,yes)});button(cell,'No',function(){set(key,false,no)},'no')}}

row('open','This page opens for this account');set('open',true,'the page loaded');
row('who','Knows who is signed in');
row('save','Saves to a Google Sheet');
row('storage','Remembers settings in the browser');
row('simulator','Loads the micro:bit simulator');
row('usb','Send to micro:bit over USB',function(c){button(c,'Try it',tryUsb)});
row('download','Downloads a .hex file',function(c){button(c,'Download',tryDownload);button(c,'It worked',function(){set('download',true,'the file downloaded')},'no');button(c,'It did not',function(){set('download',false,'the file did not download')},'no')});
row('copy','Copies to the clipboard',function(c){button(c,'Try it',tryCopy)});
row('createai','CreateAI opens',function(c){var a=c.appendChild(document.createElement('a'));a.href='https://createai.microbit.org/';a.textContent='Open it';a.rel='noopener';c.appendChild(document.createTextNode(' '));yesNo('createai','it opened','it was blocked')(c)});
row('classsize','A: Whole class saves to one Sheet',function(c){button(c,'Run test',function(){tryClass('classsize','saveTest')})});
row('classfiles','B: Whole class saves, one file per student',function(c){button(c,'Run test',function(){call('prepareFolder').then(function(){tryClass('classfiles','saveFileTest')}).catch(function(e){set('classfiles',false,e.message)})})});
row('classcache','C: Whole class saves to a fast cache',function(c){button(c,'Run test',function(){tryClass('classcache','saveCacheTest',function(){return call('flushCacheTest',[RUN+'c',30]).then(function(r){return ', then copied '+r.copied+' of 30 into the Sheet in '+Math.round(r.ms/100)/10+' seconds'})})})});

call('whoAmI').then(function(w){var note=w.identityVisible?('yes, '+(w.isOwner?'script owner':'another account')+(w.sameDomain?', same school domain':', different domain')):('no'+(w.problem?': '+w.problem:', Google did not share the account'));set('who',w.identityVisible,note);if(w.shown)$('r-who').querySelector('small').textContent=note+' ('+w.shown+')'}).catch(function(e){set('who',false,e.message)});
call('saveTest',[RUN,0]).then(function(ms){set('save',true,'saved in '+Math.round(ms/100)/10+' seconds')}).catch(function(e){set('save',false,e.message)});
try{localStorage.setItem('mlcheck','1');var kept=localStorage.getItem('mlcheck')==='1';localStorage.removeItem('mlcheck');set('storage',kept,kept?'works':'nothing was kept')}catch(e){set('storage',false,e.name)}

var simDone=false,simTimer=setTimeout(function(){if(!simDone)set('simulator',false,'no answer after 20 seconds, it may be filtered')},20000);
window.addEventListener('message',function(e){if(e.origin===SIM&&e.source===$('sim').contentWindow&&e.data&&e.data.kind==='ready'&&!simDone){simDone=true;clearTimeout(simTimer);set('simulator',true,'it loaded and reported ready')}});
$('sim').src=SIM+'/v/0.1/simulator.html';

function tryUsb(){if(!('serial' in navigator)){set('usb',false,'this browser has no USB serial here');return}navigator.serial.requestPort({filters:[{usbVendorId:0x0d28}]}).then(function(){set('usb',true,'a micro:bit was chosen')}).catch(function(e){if(e.name==='NotFoundError')set('usb',true,'the device picker opened');else set('usb',false,e.name+': '+e.message)})}
function tryDownload(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['test'],{type:'application/octet-stream'}));a.download='maker-lab-test.hex';document.body.appendChild(a);a.click();a.remove();set('download',null,'pressed: did maker-lab-test.hex appear?')}
function tryCopy(){if(!navigator.clipboard){set('copy',false,'no clipboard here');return}navigator.clipboard.writeText('maker lab test').then(function(){set('copy',true,'works')}).catch(function(e){set('copy',false,e.name)})}
function tryClass(key,fn,after){var n=30,good=0,slow=0,bad='',t0=Date.now(),run=fn==='saveCacheTest'?RUN+'c':RUN;set(key,null,'running 30 saves at once… (up to a minute)');var jobs=[];for(var i=1;i<=n;i++){jobs.push(call(fn,[run,i]).then(function(ms){good++;slow=Math.max(slow,ms)}).catch(function(e){bad=e.message}))}Promise.all(jobs).then(function(){var note=good+' of '+n+' saved, slowest '+Math.round(slow/100)/10+' s, all done in '+Math.round((Date.now()-t0)/100)/10+' s'+(bad?', error: '+bad:'');if(after&&good===n)return after().then(function(extra){set(key,true,note+extra)}).catch(function(e){set(key,false,note+', copy failed: '+e.message)});set(key,good===n,note)})}
</script></body></html>`;
