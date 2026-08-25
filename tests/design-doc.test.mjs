// The two rules the Design Intent Document must obey, and the checker that
// enforces them.
//
// Both are submission-fatal and neither is visible in the finished file: a word
// count drifts past 500 one edit at a time, and an identifying detail arrives on
// autopilot — a repo URL pasted as a reference, a name in a credit line — at
// exactly the moment nobody is proofreading for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  WORD_LIMIT, extractProse, countWords, findProblems, parseBlocks, buildDocument,
} from '../tools/design-doc.mjs';

const SOURCE = new URL('../docs/design-intent.md', import.meta.url);
const markdown = await readFile(SOURCE, 'utf8');
const prose = extractProse(markdown);

test('the document as written is inside the word limit', () => {
  const words = countWords(prose);
  assert.ok(words <= WORD_LIMIT, `${words} words, over the ${WORD_LIMIT}-word limit`);
  assert.ok(words > 200, `${words} words is too thin to describe a design`);
});

test('the document as written carries no identifying information', () => {
  assert.deepEqual(findProblems(prose), []);
});

test('the checker actually catches an over-long document', () => {
  // Without this, a broken checker and a compliant document look identical.
  const tooLong = 'word '.repeat(WORD_LIMIT + 1);
  const problems = findProblems(tooLong);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /over the 500-word limit/);
});

test('the checker catches every shape of identifying information', () => {
  const cases = [
    ['See https://example.com/repo for the source.', /URL/],
    ['Mirrored at github.com/someone/emberline.', /URL|GitHub/],
    ['Contact someone@example.com with questions.', /email/],
    ['Written by a person.', /byline/],
    ['Created by a small team.', /byline/],
    ['Copyright 2026.', /copyright/],
    ['© 2026.', /copyright/],
  ];
  for (const [text, expected] of cases) {
    const problems = findProblems(text);
    assert.ok(problems.length > 0, `no problem reported for ${JSON.stringify(text)}`);
    assert.ok(problems.some((p) => expected.test(p)),
      `wrong problem for ${JSON.stringify(text)}: ${problems.join('; ')}`);
  }
});

test('clean prose is reported clean, so the checker is not just always angry', () => {
  assert.deepEqual(findProblems('A furnace thaws a circle of ground. The circle is the map.'), []);
});

test('the checker ignores the source file\'s own notes', () => {
  // The markdown carries the rules themselves in an HTML comment. If comments
  // counted, the checker would fail on its own instructions — and if they were
  // scanned, the word "copyright" appearing in a note would be a false alarm.
  const withNote = '<!-- rule: no copyright lines, see https://example.com -->\n\nA short body.';
  assert.deepEqual(findProblems(extractProse(withNote)), []);
  assert.equal(countWords(extractProse(withNote)), 3);
});

test('markdown syntax is not counted as words', () => {
  // "## The night" is two words, not three, and bold markers are not words.
  assert.equal(countWords(extractProse('## The night\n\n**Seven** nights.')), 4);
});

test('the document is structured, not one wall of text', () => {
  // A judge reads this in under two minutes. Headings are what make that
  // possible, and they are the first thing lost in a rewrite.
  const blocks = parseBlocks(markdown);
  assert.ok(blocks.length >= 5, `only ${blocks.length} sections`);
  assert.equal(blocks[0].level, 1, 'the document must open with a title');
  for (const b of blocks) assert.ok(b.heading.length > 0);
  assert.ok(blocks.slice(1).every((b) => b.body.length > 0), 'a section has a heading but no prose');
});

test('the document renders to a real docx without throwing', () => {
  const doc = buildDocument(parseBlocks(markdown));
  assert.ok(doc, 'no document produced');
});

test('the title names the game and nothing else', () => {
  const [title] = parseBlocks(markdown);
  assert.match(title.heading, /EMBERLINE/);
  assert.deepEqual(findProblems(title.heading), []);
});
