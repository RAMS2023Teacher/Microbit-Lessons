// ---------------------------------------------------------------- lesson sections
function percent_(p, L) {
  var keys = L.section_keys, s = (p && p.sections) || {}, done = 0;
  keys.forEach(function (k) { if (s[k]) done++; });
  return keys.length ? Math.round(100 * done / keys.length) : 0;
}

function lessonStars_(L, p) {
  if (!p) return 0;
  var first = L.has_debug ? p.debug_solved : (p.sections || {}).lab;
  return (first ? 1 : 0) + (p.quiz_total && p.quiz_best === p.quiz_total ? 1 : 0) + (p.challenge_submitted_at ? 1 : 0);
}

// ---------------------------------------------------------------- code checks (never runs student code)
/** Removes # comments outside strings, line by line, like lessons.py. */
function stripComments_(code) {
  return String(code).split('\n').map(function (line) {
    var inStr = null, out = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (inStr) { if (ch === inStr) inStr = null; }
      else if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === '#') break;
      out += ch;
    }
    return out.replace(/\s+$/, '');
  }).join('\n');
}

/** Python regex -> JavaScript regex. The build checks every lesson pattern behaves the same. */
function pyRegex_(pattern) {
  var src = String(pattern), flags = 'm';
  var inline = /^\(\?([aiLmsux]+)\)/.exec(src);      // Python's leading (?i), (?s) ... flags
  if (inline) {
    src = src.slice(inline[0].length);
    if (inline[1].indexOf('i') >= 0) flags += 'i';
    if (inline[1].indexOf('s') >= 0) flags += 's';
  }
  src = src.replace(/\\A/g, '^(?<![\\s\\S])').replace(/\\Z/g, '$(?![\\s\\S])');
  return new RegExp(src, flags);
}

function runChecks_(code, checks) {
  var stripped = stripComments_(code);
  return checks.map(function (c) {
    if (c.type === 'syntax') {
      var err = pythonSyntaxError_(code);
      return err ? { ok: false, message: c.message || err } : { ok: true, message: c.message || '' };
    }
    var hit = pyRegex_(c.pattern).test(stripped);
    return { ok: c.type === 'contains' ? hit : !hit, message: c.message || '' };
  });
}

/**
 * A small Python syntax checker for beginner programs. It finds the mistakes students make
 * (a missing colon, bad indentation, an unclosed bracket or quote, = inside if, a misspelled
 * keyword) and returns a message like Python's, or '' when the code looks fine.
 * The build compares it with real Python on every code sample in the lessons.
 */
var PY_KEYWORDS_ = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'try', 'except', 'finally', 'with',
  'return', 'import', 'from', 'raise', 'pass', 'break', 'continue', 'del', 'global', 'nonlocal', 'assert',
  'yield', 'lambda', 'not', 'async', 'await', 'match', 'case', 'in', 'is', 'and', 'or', 'print'];
var TRIPLE_D_ = '"' + '"' + '"', TRIPLE_S_ = "'" + "'" + "'";

function pythonSyntaxError_(code) {
  var lines = String(code).replace(/\r/g, '').split('\n');
  var say = function (n, msg) { return "Python can't read line " + n + ': ' + msg; };
  var close = { ')': '(', ']': '[', '}': '{' };
  var logical = [], stack = [], cur = null, triple = null, tripleLine = 0;
  for (var n = 0; n < lines.length; n++) {
    var raw = lines[n], clean = '', i = 0;
    while (i < raw.length) {
      var ch = raw.charAt(i);
      if (triple) {
        if (raw.substr(i, 3) === triple) { triple = null; clean += 'S'; i += 3; } else i++;
        continue;
      }
      if (ch === '#') break;
      var three = raw.substr(i, 3);
      if (three === TRIPLE_D_ || three === TRIPLE_S_) { triple = three; tripleLine = n + 1; i += 3; continue; }
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < raw.length && raw.charAt(j) !== ch) j += raw.charAt(j) === '\\' ? 2 : 1;
        if (j >= raw.length) return say(n + 1, 'unterminated string literal (a quote is missing)');
        clean += 'S'; i = j + 1; continue;
      }
      if (ch === '(' || ch === '[' || ch === '{') stack.push({ c: ch, line: n + 1 });
      else if (close[ch]) {
        var top = stack.pop();
        if (!top) return say(n + 1, "unmatched '" + ch + "'");
        if (top.c !== close[ch]) return say(n + 1, "closing parenthesis '" + ch + "' does not match opening parenthesis '" + top.c + "'");
      }
      clean += ch; i++;
    }
    if (!cur) {
      if (!clean.trim() && !stack.length && !triple) continue;
      cur = { line: n + 1, indent: (raw.match(/^[ \t]*/) || [''])[0], text: clean.trim() };
    } else {
      cur.text += ' ' + clean.trim();
    }
    if (!stack.length && !triple && !/\\$/.test(clean.replace(/\s+$/, ''))) { logical.push(cur); cur = null; }
  }
  if (triple) return say(tripleLine, 'unterminated triple-quoted string');
  if (stack.length) return say(stack[stack.length - 1].line, "'" + stack[stack.length - 1].c + "' was never closed");
  if (cur) logical.push(cur);

  var indents = [0], expect = false, last = 0;
  for (var k = 0; k < logical.length; k++) {
    var L = logical[k], body = L.text;
    if (/\t/.test(L.indent) && / /.test(L.indent)) return say(L.line, 'inconsistent use of tabs and spaces in indentation');
    var w = L.indent.replace(/\t/g, '        ').length;
    if (expect) {
      if (w <= indents[indents.length - 1]) return say(L.line, 'expected an indented block');
      indents.push(w); expect = false;
    } else if (w > indents[indents.length - 1]) {
      return say(L.line, 'unexpected indent');
    } else {
      while (w < indents[indents.length - 1]) indents.pop();
      if (w !== indents[indents.length - 1]) return say(L.line, 'unindent does not match any outer indentation level');
    }
    var first = (/^[A-Za-z_]\w*/.exec(body) || [''])[0];
    // the first ':' outside brackets (not part of :=)
    var depth = 0, colon = -1;
    for (var c = 0; c < body.length; c++) {
      var x = body.charAt(c);
      if ('([{'.indexOf(x) >= 0) depth++;
      else if (')]}'.indexOf(x) >= 0) depth--;
      else if (x === ':' && depth === 0 && body.charAt(c + 1) !== '=') { colon = c; break; }
    }
    if (/^(if|elif|else|for|while|def|class|try|except|finally|with)$/.test(first)) {
      if (colon < 0) return say(L.line, "expected ':'");
      if (/^(else|try|finally)$/.test(first) && body.slice(first.length, colon).trim()) return say(L.line, "expected ':'");
      if (/^(if|elif|while)$/.test(first)) {
        var cond = body.slice(first.length, colon).replace(/[=!<>]=|:=/g, ''), flat = '', d = 0;
        for (var y = 0; y < cond.length; y++) {
          var z = cond.charAt(y);
          if ('([{'.indexOf(z) >= 0) d++; else if (')]}'.indexOf(z) >= 0) d--; else if (d === 0) flat += z;
        }
        if (flat.indexOf('=') >= 0) return say(L.line, "invalid syntax. Maybe you meant '==' instead of '='?");
      }
      if (!body.slice(colon + 1).trim()) expect = true;
    } else if (first === 'print' && /^print\s+[^\s(=]/.test(body)) {
      return say(L.line, "Missing parentheses in call to 'print'. Did you mean print(...)?");
    } else if (first && PY_KEYWORDS_.indexOf(first) < 0 && /^[A-Za-z_]\w*\s+[A-Za-z_\d(S]/.test(body)
               && !/^[A-Za-z_]\w*\s+(if|else|and|or|in|is|not|for)\b/.test(body)) {
      return say(L.line, 'invalid syntax');
    }
    last = L.line;
  }
  if (expect) return say(last + 1, 'expected an indented block');
  return '';
}

// ---------------------------------------------------------------- quiz
function gradeQuiz_(L, answers) {
  var results = L.quiz.map(function (q, i) {
    var a = answers[i];
    return { correct: a === q.answer, explain: q.explain, answer: q.answer };
  });
  var score = results.filter(function (r) { return r.correct; }).length;
  return { score: score, total: L.quiz.length, results: results };
}
