import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isAllowedNavigation, isContentOrigin, isSingleJsonInput, checkedText } = require('../electron/services.cjs');

test('service navigation accepts only exact HTTPS Akademiya origins without credentials', () => {
  for (const url of ['https://hafs.akademiya.kr/tools/exam-papers', 'https://iq.akademiya.kr/?view=create', 'https://akademiya.kr/oauth/authorize']) assert.equal(isAllowedNavigation(url), true, url);
  for (const url of ['http://hafs.akademiya.kr/', 'https://hafs.akademiya.kr.evil.example/', 'https://hafs.akademiya.kr@evil.example/', 'https://user:password@hafs.akademiya.kr/', 'https://hafs.akademiya.kr:8443/', 'file:///etc/passwd', 'javascript:alert(1)', 'https://accounts.google.com/']) assert.equal(isAllowedNavigation(url), false, url);
  assert.equal(isContentOrigin('https://akademiya.kr/oauth/authorize'), false);
});

test('staged JSON is offered only for single explicit JSON file inputs', () => {
  assert.equal(isSingleJsonInput('selectSingle', ['type', 'file', 'accept', 'application/json,.json']), true);
  assert.equal(isSingleJsonInput('selectSingle', ['type', 'file', 'accept', 'image/png']), false);
  assert.equal(isSingleJsonInput('selectMultiple', ['type', 'file', 'accept', '.json']), false);
  assert.equal(isSingleJsonInput('selectSingle', ['type', 'file', 'accept', '.json', 'multiple', '']), false);
  assert.equal(isSingleJsonInput('selectSingle', ['type', 'file', 'accept', '.json', 'webkitdirectory', '']), false);
  assert.equal(isSingleJsonInput('selectSingle', ['type', 'text', 'accept', '.json']), false);
});

test('staged data is bounded portable JSON rather than arbitrary file contents', () => {
  const text = JSON.stringify({ schemaVersion: '2.0', kind: 'exam', meta: { title: 'test' }, questions: [] });
  assert.equal(checkedText(text), text);
  assert.throws(() => checkedText('{invalid'));
  assert.throws(() => checkedText(JSON.stringify({ schemaVersion: '1.0', kind: 'exam' })));
  assert.throws(() => checkedText('x'.repeat(15 * 1024 * 1024 + 1)));
});
