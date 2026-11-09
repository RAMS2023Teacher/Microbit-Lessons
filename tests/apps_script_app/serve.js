// Serves the generated Apps Script app on http://localhost:PORT/exec with fake Google services,
// so it can be clicked through in a real browser. Pick the account with ?as=someone@school.org.
const http = require('http'), url = require('url');
const { makeWorld } = require('./fake_google');
const [dist, port] = [process.argv[2], Number(process.argv[3] || 5055)];
const base = `http://localhost:${port}/exec`;
const w = makeWorld(dist, { url: base });
w.call(w.owner, 'setup');
// a pretend Google Classroom to import from
const kid = (email, fullName) => ({ userId: email, profile: { emailAddress: email, name: { fullName } } });
w.state.classroom = {
  courses: [{ id: 'gc1', name: 'Makers', section: 'Period 3', courseState: 'ACTIVE' }, { id: 'gc2', name: 'CS 8', section: 'Block B', courseState: 'ACTIVE' }],
  students: { gc1: [kid('sam@students.school.org', 'Sam King'), kid('lee@students.school.org', 'Lee Park')], gc2: [kid('ava@students.school.org', 'Ava Reyes')] },
};

const RUN = `<script>window.google={script:{run:(function(){
  function make(ok,no){return new Proxy({}, {get:function(_,name){
    if(name==='withSuccessHandler')return function(f){return make(f,no)};
    if(name==='withFailureHandler')return function(f){return make(ok,f)};
    return function(){var args=[].slice.call(arguments);
      fetch('/__run',{method:'POST',credentials:'same-origin',body:JSON.stringify({fn:name,args:args,as:window.__AS})}).then(function(r){return r.json()})
      .then(function(r){if(r.ok){ok&&ok(r.value)}else{no&&no(new Error(r.error))}},function(e){no&&no(e)});};
  }});}
  return make(null,null);})()}};</script>`;

const user = (req) => (/(?:^|;\s*)as=([^;]+)/.exec(req.headers.cookie || '') || [])[1];
http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  // Like real Apps Script: /exec is an outer page; the app runs in a sandboxed iframe on another origin.
  if (u.pathname === '/exec' && process.env.IFRAME && req.headers.host.startsWith('localhost')) {
    const headers = { 'Content-Type': 'text/html; charset=utf-8' };
    let who = user(req) ? decodeURIComponent(user(req)) : w.owner;
    if (u.query.as !== undefined) { who = u.query.as; headers['Set-Cookie'] = 'as=' + encodeURIComponent(who) + '; Path=/'; }
    const q = new URLSearchParams(Object.assign({}, u.query, { as: who })).toString();
    res.writeHead(200, headers);
    return res.end('<!doctype html><html><body style="margin:0"><iframe id="sandboxFrame" sandbox="allow-downloads allow-forms allow-modals ' +
      'allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation" ' +
      'style="border:0;width:100%;height:100vh" src="http://127.0.0.1:' + port + '/exec?' + q + '"></iframe></body></html>');
  }
  if (u.pathname === '/exec') {
    const headers = { 'Content-Type': 'text/html; charset=utf-8' };
    let who = user(req) ? decodeURIComponent(user(req)) : w.owner;
    if (u.query.as !== undefined) { who = u.query.as; headers['Set-Cookie'] = 'as=' + encodeURIComponent(who) + '; Path=/'; }
    const out = w.page(who, u.query.p);
    res.writeHead(200, headers);
    return res.end(out.getContent().replace('<head>', '<head><script>window.__AS=' + JSON.stringify(who) + '</script>' + RUN));
  }
  if (u.pathname === '/__run' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', () => {
      const { fn, args, as } = JSON.parse(body);
      let reply;
      try { reply = { ok: true, value: w.call(as || decodeURIComponent(user(req) || w.owner), fn, args) }; }
      catch (e) { reply = { ok: false, error: e.message }; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply === undefined ? { ok: true } : reply));
    });
  }
  if (u.pathname === '/__advance') { w.advance(Number(u.query.ms) || 120000); res.writeHead(200); return res.end('ok'); }
  res.writeHead(404); res.end('not found');
}).listen(port, () => console.log('Maker Lab (fake Google) on ' + base));
