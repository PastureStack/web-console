#!/usr/bin/env node
'use strict';

const fs = require('fs');

const themePath = 'app/styles/vendors/_prism-theme.scss';
const commonMarkPath = 'app/components/common-mark/component.js';
const codeBlockPath = 'app/components/code-block/component.js';
const ciPath = 'scripts/ci';
const theme = fs.readFileSync(themePath, 'utf8');
const failures = [];
const variables = {};
const variablePattern = /^\s*--(prism-code-[a-z-]+):\s*(#[0-9a-f]{6});/gmi;
let match;

while ((match = variablePattern.exec(theme)) !== null) {
  variables[match[1]] = match[2].toLowerCase();
}

const readableVariables = [
  'prism-code-foreground',
  'prism-code-comment',
  'prism-code-accent',
  'prism-code-number',
  'prism-code-string',
  'prism-code-function',
  'prism-code-keyword',
  'prism-code-important',
];
const requiredVariables = [
  'prism-code-background',
  'prism-code-border',
  ...readableVariables,
];

for (const name of requiredVariables) {
  if (!variables[name]) {
    failures.push('MISSING_COLOR_' + name);
  }
}

function channel(value) {
  value /= 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const value = hex.slice(1);
  const red = channel(parseInt(value.slice(0, 2), 16));
  const green = channel(parseInt(value.slice(2, 4), 16));
  const blue = channel(parseInt(value.slice(4, 6), 16));

  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) /
    (Math.min(first, second) + 0.05);
}

let minimum = Number.POSITIVE_INFINITY;
const background = variables['prism-code-background'];

if (background) {
  for (const name of readableVariables) {
    const value = variables[name];

    if (!value) {
      continue;
    }

    const ratio = contrast(value, background);
    minimum = Math.min(minimum, ratio);
    if (ratio < 4.5) {
      failures.push('LOW_CONTRAST_' + name + '=' + ratio.toFixed(2));
    }
  }
}

if (!/pre\s*\{[^}]*background:\s*var\(--prism-code-background\);[^}]*color:\s*var\(--prism-code-foreground\);/s.test(theme)) {
  failures.push('PREFORMATTED_SURFACE_CONTRACT_MISSING');
}

for (const selector of [
  'code[class*="language-"]',
  'pre[class*="language-"]',
]) {
  if (!theme.includes(selector)) {
    failures.push('LANGUAGE_SELECTOR_MISSING=' + selector);
  }
}

const commonMark = fs.readFileSync(commonMarkPath, 'utf8');
if (!commonMark.includes('new commonmark.HtmlRenderer()')) {
  failures.push('COMMONMARK_RENDERER_CONTRACT_MISSING');
}

const codeBlock = fs.readFileSync(codeBlockPath, 'utf8');
for (const marker of ["tagName: 'PRE'", "return 'language-'+lang"]) {
  if (!codeBlock.includes(marker)) {
    failures.push('CODE_BLOCK_DOM_CONTRACT_MISSING=' + marker);
  }
}

if (!fs.readFileSync(ciPath, 'utf8').includes('node ./scripts/check-ui-code-block-contrast.js')) {
  failures.push('CI_GATE_MISSING');
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error('failure_count=' + failures.length);
  process.exit(1);
}

console.log(
  'UI_CODE_BLOCK_CONTRAST_OK minimum=' + minimum.toFixed(2) +
  ' background=' + background +
  ' surfaces=commonmark,component,pre'
);
