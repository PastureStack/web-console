(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.rc16ShellQuote = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

exports.quote = require('./quote');
exports.parse = require('./parse');

},{"./parse":2,"./quote":3}],2:[function(require,module,exports){
'use strict';

/**
 * @import {
 * 	ControlOperator,
 * 	Env,
 * 	GlobPattern,
 * 	ParseEntry,
 * } from './parse' */

// '<(' is process substitution operator and
// can be parsed the same as control operator
var CONTROL = /** @type {const} */ ('(?:') + /** @type {const} */ ([
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
]).join(/** @type {const} */ ('|')) + /** @type {const} */ (')');
var controlRE = new RegExp('^' + CONTROL + '$');
var META = /** @type {const} */ ('|&;()<> \\t');
var SINGLE_QUOTE = /** @type {const} */ ('\'([^\']*?)\'');
var DOUBLE_QUOTE = /** @type {const} */ ('"((\\\\"|[^"])*?)"');
var hash = /^#$/;

var SQ = /** @type {const} */ ("'");
var DQ = /** @type {const} */ ('"');
var DS = /** @type {const} */ ('$');

var TOKEN = '';
var mult = /** @type {const} */ (0x100000000); // Math.pow(16, 8);
for (var i = 0; i < 4; i++) {
	TOKEN += (mult * Math.random()).toString(16);
}
var startsWithToken = new RegExp('^' + TOKEN);

/**
 * @param {string} s
 * @param {RegExp} r
 */
function matchAll(s, r) {
	var origIndex = r.lastIndex;

	var matches = [];
	var matchObj;

	while ((matchObj = r.exec(s))) {
		matches[matches.length] = matchObj;
		if (r.lastIndex === matchObj.index) {
			r.lastIndex += 1;
		}
	}

	r.lastIndex = origIndex;

	return matches;
}

/**
 * @param {Env} env
 * @param {string} pre
 * @param {string} key
 */
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

/**
 * @param {string} string
 * @param {Env} [env]
 * @param {{ escape?: string, splitUnquoted?: boolean | string }} [opts]
 * @returns {ParseEntry[]}
 */
function parseInternal(string, env, opts) {
	if (!opts) {
		opts = {};
	}
	var BS = opts.escape || '\\';
	var ifs = opts.splitUnquoted === true ? ' \t\n' : (typeof opts.splitUnquoted === 'string' ? opts.splitUnquoted : '');
	var BAREWORD = '(\\' + BS + '[\'"' + META + ']|[^\\s\'"' + META + '])+';

	var chunker = new RegExp([
		'(' + CONTROL + ')', // control chars
		'(' + BAREWORD + '|' + DOUBLE_QUOTE + '|' + SINGLE_QUOTE + ')+'
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
			return /** @type {ControlOperator} */ ({ op: s });
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
		/** @type {string | boolean} */
		var quote = false;
		var esc = false;
		var out = '';
		/** @type {string[]} */
		var words = [];
		var sawQuote = false;
		/** @type {number | null} */
		var pendingNw = null;
		var isGlob = false;
		/** @type {number} */
		var i;

		function parseEnvVar() {
			i += 1;
			/** @type {number | RegExpMatchArray | null} */
			var varend;
			/** @type {string} */
			var varname;
			var char = s.charAt(i);

			if (char === '{') {
				i += 1;
				if (s.charAt(i) === '}') {
					throw new Error('Bad substitution: ' + s.slice(i - 2, i + 1));
				}
				// match braces by depth so a nested `${` keeps its inner `}` from ending the outer substitution
				var depth = 1;
				varend = i;
				while (depth > 0 && varend < s.length) {
					if (s.charAt(varend) === '{' && s.charAt(varend - 1) === '$') {
						depth += 1;
					} else if (s.charAt(varend) === '}') {
						depth -= 1;
					}
					varend += 1;
				}
				if (depth !== 0) {
					throw new Error('Bad substitution: ' + s.slice(i));
				}
				varend -= 1;
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
					i += /** @type {number} */ (varend.index) - 1;
				}
			}
			return getVar(/** @type {NonNullable<typeof env>} */ (env), '', varname);
		}

		function flushRun() {
			if (pendingNw === null) {
				return;
			}
			if (pendingNw === 0) {
				if (out !== '') {
					words[words.length] = out;
					out = '';
				}
			} else {
				words[words.length] = out;
				out = '';
				for (var fe = 1; fe < pendingNw; fe += 1) {
					words[words.length] = '';
				}
			}
			pendingNw = null;
		}

		for (i = 0; i < s.length; i++) {
			var c = s.charAt(i);
			if (ifs && c !== DS) {
				flushRun();
			}
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
				sawQuote = true;
			} else if (controlRE.test(c)) {
				return /** @type {ControlOperator} */ ({ op: s });
			} else if (hash.test(c)) {
				commented = true;
				var commentObj = { comment: string.slice(match.index + i + 1) };
				if (out.length) {
					return /** @type {const} */ ([out, commentObj]);
				}
				return /** @type {const} */ ([commentObj]);
			} else if (c === BS) {
				esc = true;
			} else if (c === DS) {
				var value = parseEnvVar();
				if (!ifs) {
					out += value;
				} else {
					for (var vi = 0; vi < value.length; vi += 1) {
						var vc = value.charAt(vi);
						if (ifs.indexOf(vc) < 0) {
							flushRun();
							out += vc;
						} else if (pendingNw === null) {
							pendingNw = vc === ' ' || vc === '\t' || vc === '\n' ? 0 : 1;
						} else if (vc !== ' ' && vc !== '\t' && vc !== '\n') {
							pendingNw += 1;
						}
					}
				}
			} else {
				out += c;
			}
		}

		if (isGlob) {
			return /** @type {GlobPattern} */ ({ op: 'glob', pattern: out });
		}

		if (ifs) {
			if (pendingNw !== null && pendingNw > 0) {
				words[words.length] = out;
				out = '';
				for (var te = 1; te < pendingNw; te += 1) {
					words[words.length] = '';
				}
			}
			if (out !== '' || (sawQuote && words.length === 0)) {
				words[words.length] = out;
			}
			return words;
		}

		return out;
	}).reduce(function (prev, arg) { // finalize parsed arguments
		if (typeof arg === 'undefined') {
			return prev;
		}
		/** @type {ParseEntry[]} */ ([]).concat(arg).forEach(function (entry) {
			prev[prev.length] = entry;
		});
		return prev;
	}, /** @type {ParseEntry[]} */ ([]));
}

/** @type {typeof import('./parse')} */
module.exports = function parse(s, env, opts) {
	var mapped = parseInternal(s, env, opts);
	if (typeof env !== 'function') {
		return mapped;
	}
	return mapped.reduce(function (acc, s) {
		if (typeof s === 'object') {
			acc[acc.length] = s;
			return acc;
		}
		var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
		if (xs.length === 1) {
			acc[acc.length] = xs[0];
			return acc;
		}
		xs.filter(Boolean).forEach(function (x) {
			acc[acc.length] = startsWithToken.test(x)
				? JSON.parse(x.split(TOKEN)[1])
				: x;
		});
		return acc;
	}, /** @type {ParseEntry[]} */ ([]));
};

},{}],3:[function(require,module,exports){
'use strict';

/** @import { ControlOperator } from './parse' */

/** @type {ControlOperator['op'][]} */
var OPS = /** @type {const} */ ([
	'||',
	'&&',
	';;',
	'|&',
	'<(',
	'<<<',
	'>>',
	'>&',
	'<&',
	'&',
	';',
	'(',
	')',
	'|',
	'<',
	'>'
]);
var LINE_TERMINATORS = /[\n\r\u2028\u2029]/;
var GLOB_SHELL_SPECIAL = /[\s#!"$&'():;<=>@\\^`|]/g;

/** @type {typeof import('./quote')} */
module.exports = function quote(xs) {
	return xs.map(function (s) {
		if (s === '') {
			return /** @type {const} */ ('\'\'');
		}
		if (s && typeof s === 'object') {
			if ('op' in s && s.op === 'glob') {
				if (typeof s.pattern !== 'string') {
					throw new TypeError('glob token requires a string `pattern`');
				}
				if (LINE_TERMINATORS.test(s.pattern)) {
					throw new TypeError('glob `pattern` must not contain line terminators');
				}
				return s.pattern.replace(GLOB_SHELL_SPECIAL, '\\$&');
			}
			if ('op' in s && typeof s.op === 'string') {
				if (OPS.indexOf(s.op) < 0) {
					throw new TypeError('invalid `op` value: ' + JSON.stringify(s.op));
				}
				return s.op.replace(/[\s\S]/g, '\\$&');
			}
			if ('comment' in s && typeof s.comment === 'string') {
				if (LINE_TERMINATORS.test(s.comment)) {
					throw new TypeError('`comment` must not contain line terminators');
				}
				return '#' + s.comment;
			}
			throw new TypeError('unrecognized object token shape');
		}
		if ((/["\s\\]/).test(s) && !(/'/).test(s)) {
			return "'" + s.replace(/(['])/g, '\\$1') + "'";
		}
		if ((/["'\s]/).test(s)) {
			return '"' + s.replace(/(["\\$`!])/g, '\\$1') + '"';
		}
		return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}~])/g, '$1\\$2');
	}).join(' ');
};

},{}]},{},[1])(1)
});
