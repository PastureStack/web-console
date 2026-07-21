(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.rc16ShellQuote = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

// '<(' is process substitution operator and
// can be parsed the same as control operator
var CONTROL = '(?:' + [
	'\\|\\|',
	'\\&\\&',
	';;',
	'\\|\\&',
	'\\<\\(',
	'\\<\\<\\<',
	'>>',
	'>\\&',
	'<\\&',
	'[&;()|<>]'
].join('|') + ')';
var controlRE = new RegExp('^' + CONTROL + '$');
var META = '|&;()<> \\t';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';
var hash = /^#$/;

var SQ = "'";
var DQ = '"';
var DS = '$';

var TOKEN = '';
var mult = 0x100000000; // Math.pow(16, 8);
for (var i = 0; i < 4; i++) {
	TOKEN += (mult * Math.random()).toString(16);
}
var startsWithToken = new RegExp('^' + TOKEN);

function matchAll(s, r) {
	var origIndex = r.lastIndex;

	var matches = [];
	var matchObj;

	while ((matchObj = r.exec(s))) {
		matches.push(matchObj);
		if (r.lastIndex === matchObj.index) {
			r.lastIndex += 1;
		}
	}

	r.lastIndex = origIndex;

	return matches;
}

function getVar(env, pre, key) {
	var r = typeof env === 'function' ? env(key) : env[key];
	if (typeof r === 'undefined' && key != '') {
		r = '';
	} else if (typeof r === 'undefined') {
		r = '$';
	}

	if (typeof r === 'object') {
		return pre + TOKEN + JSON.stringify(r) + TOKEN;
	}
	return pre + r;
}

function parseInternal(string, env, opts) {
	if (!opts) {
		opts = {};
	}
	var BS = opts.escape || '\\';
	var BAREWORD = '(\\' + BS + '[\'"' + META + ']|[^\\s\'"' + META + '])+';

	var chunker = new RegExp([
		'(' + CONTROL + ')', // control chars
		'(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')+'
	].join('|'), 'g');

	var matches = matchAll(string, chunker);

	if (matches.length === 0) {
		return [];
	}
	if (!env) {
		env = {};
	}

	var commented = false;

	return matches.map(function (match) {
		var s = match[0];
		if (!s || commented) {
			return void undefined;
		}
		if (controlRE.test(s)) {
			return { op: s };
		}

		// Hand-written scanner/parser for Bash quoting rules:
		//
		// 1. inside single quotes, all characters are printed literally.
		// 2. inside double quotes, all characters are printed literally
		//    except variables prefixed by '$' and backslashes followed by
		//    either a double quote or another backslash.
		// 3. outside of any quotes, backslashes are treated as escape
		//    characters and not printed (unless they are themselves escaped)
		// 4. quote context can switch mid-token if there is no whitespace
		//     between the two quote contexts (e.g. all'one'"token" parses as
		//     "allonetoken")
		var quote = false;
		var esc = false;
		var out = '';
		var isGlob = false;
		var i;

		function parseEnvVar() {
			i += 1;
			var varend;
			var varname;
			var char = s.charAt(i);

			if (char === '{') {
				i += 1;
				if (s.charAt(i) === '}') {
					throw new Error('Bad substitution: ' + s.slice(i - 2, i + 1));
				}
				varend = s.indexOf('}', i);
				if (varend < 0) {
					throw new Error('Bad substitution: ' + s.slice(i));
				}
				varname = s.slice(i, varend);
				i = varend;
			} else if ((/[*@#?$!_-]/).test(char)) {
				varname = char;
				i += 1;
			} else {
				var slicedFromI = s.slice(i);
				varend = slicedFromI.match(/[^\w\d_]/);
				if (!varend) {
					varname = slicedFromI;
					i = s.length;
				} else {
					varname = slicedFromI.slice(0, varend.index);
					i += varend.index - 1;
				}
			}
			return getVar(env, '', varname);
		}

		for (i = 0; i < s.length; i++) {
			var c = s.charAt(i);
			isGlob = isGlob || (!quote && (c === '*' || c === '?'));
			if (esc) {
				out += c;
				esc = false;
			} else if (quote) {
				if (c === quote) {
					quote = false;
				} else if (quote == SQ) {
					out += c;
				} else { // Double quote
					if (c === BS) {
						i += 1;
						c = s.charAt(i);
						if (c === DQ || c === BS || c === DS) {
							out += c;
						} else {
							out += BS + c;
						}
					} else if (c === DS) {
						out += parseEnvVar();
					} else {
						out += c;
					}
				}
			} else if (c === DQ || c === SQ) {
				quote = c;
			} else if (controlRE.test(c)) {
				return { op: s };
			} else if (hash.test(c)) {
				commented = true;
				var commentObj = { comment: string.slice(match.index + i + 1) };
				if (out.length) {
					return [out, commentObj];
				}
				return [commentObj];
			} else if (c === BS) {
				esc = true;
			} else if (c === DS) {
				out += parseEnvVar();
			} else {
				out += c;
			}
		}

		if (isGlob) {
			return { op: 'glob', pattern: out };
		}

		return out;
	}).reduce(function (prev, arg) { // finalize parsed arguments
		// TODO: replace this whole reduce with a concat
		return typeof arg === 'undefined' ? prev : prev.concat(arg);
	}, []);
}

module.exports = function parse(s, env, opts) {
	var mapped = parseInternal(s, env, opts);
	if (typeof env !== 'function') {
		return mapped;
	}
	return mapped.reduce(function (acc, s) {
		if (typeof s === 'object') {
			return acc.concat(s);
		}
		var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
		if (xs.length === 1) {
			return acc.concat(xs[0]);
		}
		return acc.concat(xs.filter(Boolean).map(function (x) {
			if (startsWithToken.test(x)) {
				return JSON.parse(x.split(TOKEN)[1]);
			}
			return x;
		}));
	}, []);
};

},{}],2:[function(require,module,exports){
'use strict';

module.exports = function quote(xs) {
	return xs.map(function (s) {
		if (s === '') {
			return '\'\'';
		}
		if (s && typeof s === 'object') {
			return s.op.replace(/(.)/g, '\\$1');
		}
		if ((/["\s\\]/).test(s) && !(/'/).test(s)) {
			return "'" + s.replace(/(['])/g, '\\$1') + "'";
		}
		if ((/["'\s]/).test(s)) {
			return '"' + s.replace(/(["\\$`!])/g, '\\$1') + '"';
		}
		return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, '$1\\$2');
	}).join(' ');
};

},{}],"shell-quote":[function(require,module,exports){
'use strict';

exports.quote = require('./quote');
exports.parse = require('./parse');

},{"./parse":1,"./quote":2}]},{},[])("shell-quote")
});
