// tools/design-doc.mjs
//
// Renders docs/design-intent.md to the .docx the competition asks for, and —
// more importantly — enforces the two rules that are easy to breach by accident
// and fatal to breach at all:
//
//   1. 500 words maximum.
//   2. NO IDENTIFYING INFORMATION.
//
// Both are checked here rather than proofread by eye. A word count drifts past
// 500 one edit at a time, and an identifying detail arrives by autopilot — a
// repo URL pasted as a reference, a name in a credit line — at the exact moment
// nobody is looking for it.
//
// Dev-only. Never bundled, never in the zip.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'docs', 'design-intent.md');
const OUT = join(ROOT, 'docs', 'design-intent.docx');

export const WORD_LIMIT = 500;

/**
 * Patterns that would identify the entrant. Judging is anonymous, and the rules
 * say text only with no identifying information — so a bare URL is a breach
 * even when it identifies nobody by name.
 */
export const IDENTIFYING = [
  [/https?:\/\/\S+/i, 'a URL'],
  [/\bgithub\.com\S*/i, 'a GitHub reference'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an email address'],
  [/\bwritten by\b|\bauthor(?:ed)?\s+by\b|\bcreated by\b|\bby the team at\b/i, 'a byline'],
  [/\bcopyright\b|\(c\)\s*\d{4}|©/i, 'a copyright line'],
];

/**
 * Strips markdown to the prose a judge actually reads.
 *
 * HTML comments go first and entirely: the source file carries the rules
 * themselves in a comment, and counting those toward the limit — or scanning
 * them for identifying text — would have the checker fail on its own notes.
 */
export function extractProse(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

export function countWords(prose) {
  return prose.split(/\s+/).filter(Boolean).length;
}

/** @returns {string[]} one message per rule broken; empty means clean. */
export function findProblems(prose) {
  const problems = [];
  const words = countWords(prose);
  if (words > WORD_LIMIT) problems.push(`${words} words, over the ${WORD_LIMIT}-word limit`);
  for (const [pattern, what] of IDENTIFYING) {
    const hit = prose.match(pattern);
    if (hit) problems.push(`contains ${what}: ${JSON.stringify(hit[0].slice(0, 60))}`);
  }
  return problems;
}

/** Splits the markdown into {heading, body[]} blocks, in order. */
export function parseBlocks(markdown) {
  const blocks = [];
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');

  for (const line of withoutComments.split('\n')) {
    const text = line.trim();
    if (!text) continue;

    const heading = text.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ level: heading[1].length, heading: heading[2], body: [] });
    } else if (blocks.length) {
      blocks[blocks.length - 1].body.push(text);
    }
  }
  return blocks;
}

/** Renders bold/italic markdown spans into docx TextRuns. */
function runs(text) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let at = 0;

  for (const m of text.matchAll(pattern)) {
    if (m.index > at) out.push(new TextRun(text.slice(at, m.index)));
    const token = m[0];
    if (token.startsWith('**')) out.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    else out.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    at = m.index + token.length;
  }
  if (at < text.length) out.push(new TextRun(text.slice(at)));
  return out.length ? out : [new TextRun(text)];
}

export function buildDocument(blocks) {
  const children = [];

  for (const block of blocks) {
    if (block.level === 1) {
      children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: runs(block.heading),
      }));
    } else {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(block.heading) }));
    }
    for (const line of block.body) {
      children.push(new Paragraph({ spacing: { after: 140 }, children: runs(line) }));
    }
  }

  return new Document({ sections: [{ children }] });
}

async function main() {
  const markdown = await readFile(SOURCE, 'utf8');
  const prose = extractProse(markdown);
  const problems = findProblems(prose);

  if (problems.length) {
    for (const p of problems) console.error(`FAIL  ${p}`);
    process.exitCode = 1;
    return;
  }

  await writeFile(OUT, await Packer.toBuffer(buildDocument(parseBlocks(markdown))));
  console.log(`OK  docs/design-intent.docx  ${countWords(prose)}/${WORD_LIMIT} words`);
}

if (process.argv[1] && process.argv[1].endsWith('design-doc.mjs')) await main();
