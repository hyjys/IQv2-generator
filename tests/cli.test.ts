import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runCli } from '../scripts/cli.js';
import { createTemplate } from '../src/core/index.js';

const root = process.cwd();
async function execute(args: string[]) {
  let out = '', err = '';
  const code = await runCli(args, { appRoot: root, stdout: text => { out += text; }, stderr: text => { err += text; } });
  return { code, out, err, json: () => JSON.parse(out) };
}

test('CLI creates and validates every portable authoring profile with machine-readable reports', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'iqv2-cli-'));
  try {
    for (const profile of ['quiz', 'exam', 'vocab', 'timeline', 'mockmock', 'mockschool']) {
      const filename = path.join(directory, `${profile}.json`);
      const init = await execute(['init', '--profile', profile, '--out', filename, '--json']);
      assert.equal(init.code, 0, init.out || init.err);
      assert.equal(init.json().profile, profile);
      const valid = await execute(['validate', filename, '--json']);
      assert.equal(valid.code, 0, valid.out || valid.err);
      assert.equal(valid.json().valid, true);
      assert.ok(Array.isArray(valid.json().issues));
      assert.ok(!Object.hasOwn(valid.json(), 'document'));
      const inspect = await execute(['inspect', filename, '--json']);
      assert.equal(inspect.code, 0);
      assert.ok(inspect.json().stats.questions > 0 || inspect.json().stats.entries > 0);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI distinguishes invalid content from usage and I/O failures, and protects existing output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'iqv2-cli-'));
  try {
    const filename = path.join(directory, 'broken.json');
    await writeFile(filename, '{broken', 'utf8');
    const invalid = await execute(['validate', filename, '--json']);
    assert.equal(invalid.code, 1);
    assert.equal(invalid.json().valid, false);
    assert.ok(invalid.json().issues[0].path);
    const usage = await execute(['init', '--profile', 'missing', '--out', filename, '--json']);
    assert.equal(usage.code, 2);
    assert.equal(usage.json().ok, false);
    const protectedOutput = await execute(['init', '--profile', 'quiz', '--out', filename, '--json']);
    assert.equal(protectedOutput.code, 2);
    assert.equal(await readFile(filename, 'utf8'), '{broken');
    assert.equal((await execute(['init', '--profile', 'quiz', '--out', filename, '--force', '--json'])).code, 0);
    assert.equal((await execute(['validate', path.join(directory, 'absent.json'), '--json'])).code, 2);
    assert.equal((await execute(['validate', filename, '--mode', 'answers', '--json'])).code, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI schema supplies canonical paths, limits, media slots and exam guide to agents', async () => {
  const result = await execute(['schema', '--profile', 'mockschool', '--json']);
  assert.equal(result.code, 0);
  const schema = result.json();
  assert.equal(schema.schemaVersion, '2.0');
  assert.ok(schema.mediaSlots.includes('questions[].choiceMedia[][]'));
  assert.equal(schema.limits.imageBytes, 2 * 1024 * 1024);
  assert.ok(schema.documentation.includes('mockschool'));
});

test('CLI rejects render-invalid math rather than reporting a structurally valid document as exportable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'iqv2-cli-'));
  try {
    const filename = path.join(directory, 'math.json');
    const document = createTemplate('quiz');
    if (document.kind !== 'quiz') throw new Error('Unexpected template.');
    document.questions![0].media = [{ type: 'math', latex: '\\frac{', display: true }];
    await writeFile(filename, JSON.stringify(document));
    const result = await execute(['validate', filename, '--json']);
    assert.equal(result.code, 1);
    assert.ok(result.json().issues.some((issue: { code: string }) => issue.code === 'MATH_RENDER'));
    const rendered = await execute(['render', filename, '--out', path.join(directory, 'bad.html'), '--json']);
    assert.equal(rendered.code, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI actually decodes raster pixels and rejects corruption with a valid PNG header', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'iqv2-cli-'));
  try {
    const filename = path.join(directory, 'image.json');
    const document = createTemplate('quiz');
    const valid = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNoD/j0H4QZYAwAYB4LIbC2NhkAAAAASUVORK5CYII=', 'base64');
    document.questions![0].media = [{ type: 'image', src: `data:image/png;base64,${valid.toString('base64')}`, alt: '픽셀 해독 검증' }];
    await writeFile(filename, JSON.stringify(document));
    const accepted = await execute(['validate', filename, '--json']);
    assert.equal(accepted.code, 0, accepted.out);
    const corrupted = Buffer.from(valid);
    const idat = corrupted.indexOf(Buffer.from('IDAT'));
    assert.ok(idat > 0);
    corrupted[idat + 5] ^= 255;
    document.questions![0].media![0] = { type: 'image', src: `data:image/png;base64,${corrupted.toString('base64')}`, alt: '손상된 픽셀' };
    await writeFile(filename, JSON.stringify(document));
    const rejected = await execute(['validate', filename, '--json']);
    assert.equal(rejected.code, 1);
    assert.ok(rejected.json().issues.some((issue: { code: string }) => issue.code === 'IMAGE_DECODE'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
