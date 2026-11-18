// ---------------------------------------------------------------- translation (Português do Brasil)
// The page sends the sentences it shows (HTML with only inline tags; code, numbers and names already swapped for
// <span translate="no">§n</span> placeholders by client/lib/translate.js). Each sentence is translated once with
// Google's LanguageApp and kept: in the cache (6 h) and in 16 small Drive files ("translations-pt-0" … "-f"),
// so later visits are instant. A request stops after about 8 seconds and the page asks again for the rest.
// No lock: two students translating the same sentence at once just both save the same answer.

var TR_LANGS_ = { pt: 'pt' };
var TR_BUDGET_MS_ = 8000;

function trHash_(s) {
  var h1 = 0x811c9dc5, h2 = 5381;
  for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = ((h2 * 33) ^ c) >>> 0; }
  return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
}

/** Translate up to 80 sentences. Returns {done: {hash: translation}, left: number still to do (ask again)}. */
function translate(lang, items) {
  if (!whoIs_().email) throw new Error('Sign in with your school Google account.');
  var tl = TR_LANGS_[lang];
  if (!tl) throw new Error('That language isn\'t available.');
  items = (items || []).slice(0, 80).map(function (s) { return String(s).slice(0, 4000); });
  var cache = CacheService.getScriptCache(), out = {}, need = {};
  items.forEach(function (s) { need[trHash_(s)] = s; });
  var hashes = Object.keys(need), hit = cache.getAll(hashes.map(function (h) { return 'tr:' + lang + ':' + h; })) || {};
  hashes.forEach(function (h) { var v = hit['tr:' + lang + ':' + h]; if (v != null) { out[h] = v; delete need[h]; } });
  // saved translations, one small file per first letter of the hash
  var shards = {};
  Object.keys(need).forEach(function (h) { (shards[h.charAt(0)] = shards[h.charAt(0)] || []).push(h); });
  var shardData = {};
  Object.keys(shards).forEach(function (k) {
    shardData[k] = readNamed_('translations-' + lang + '-' + k, {});
    shards[k].forEach(function (h) { if (shardData[k][h] != null) { out[h] = shardData[k][h]; delete need[h]; } });
  });
  // new sentences: ask Google, many at once, until the time runs out
  var fresh = {}, todo = Object.keys(need), t0 = Date.now();
  while (todo.length && Date.now() - t0 < TR_BUDGET_MS_) {
    var batch = [], size = 0;
    while (todo.length && batch.length < 40 && size + need[todo[0]].length < 4500) { size += need[todo[0]].length; batch.push(todo.shift()); }
    if (!batch.length) batch.push(todo.shift());
    trBatch_(batch.map(function (h) { return need[h]; }), tl).forEach(function (t, i) { if (t != null) fresh[batch[i]] = t; });
  }
  var put = {};
  Object.keys(fresh).forEach(function (h) {
    out[h] = fresh[h];
    put['tr:' + lang + ':' + h] = fresh[h];
    var k = h.charAt(0);
    if (!shardData[k]) shardData[k] = readNamed_('translations-' + lang + '-' + k, {});
    shardData[k][h] = fresh[h];
  });
  Object.keys(out).forEach(function (h) { if (!put['tr:' + lang + ':' + h]) put['tr:' + lang + ':' + h] = out[h]; });
  try { cache.putAll(put, 21600); } catch (e) { /* too big for the cache: the Drive copy still has it */ }
  var changed = {};
  Object.keys(fresh).forEach(function (h) { changed[h.charAt(0)] = 1; });
  Object.keys(changed).forEach(function (k) { writeNamed_('translations-' + lang + '-' + k, shardData[k]); });
  return { done: out, left: Object.keys(need).length - Object.keys(fresh).length };
}

/** One call to Google for several sentences: each goes in its own <div id="tN">, and comes back the same way. */
function trBatch_(list, tl) {
  var html = list.map(function (s, i) { return '<div id="t' + i + '">' + s + '</div>'; }).join('');
  var res = retry_(function () { return LanguageApp.translate(html, 'en', tl, { contentType: 'html' }); });
  var got = [], re = /<div id="t(\d+)">([\s\S]*?)<\/div>/g, m;
  while ((m = re.exec(res))) got[+m[1]] = m[2];
  return list.map(function (s, i) {
    if (got[i] != null) return got[i];
    try { return retry_(function () { return LanguageApp.translate(s, 'en', tl, { contentType: 'html' }); }); } catch (e) { return null; }
  });
}
