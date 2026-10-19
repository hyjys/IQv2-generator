import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createTemplate, parseDocument, validateRasterDecoding, schemaGuide } from '../src/core/index.js';
import type { RasterDecoder, ValidationReport } from '../src/core/types.js';
import { renderDocument, printStyles, validateRenderDocument } from '../src/render/index.js';

type Profile = 'quiz' | 'exam' | 'vocab' | 'timeline' | 'mockmock' | 'mockschool';
type Mode = 'questions' | 'answers' | 'study';
type PdfRequest = { title: string; html: string; mode: 'questions' | 'answers' };
export type CliContext = {
  appRoot?: string;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  decodeRaster?: RasterDecoder;
  exportPdf?: (request: PdfRequest, destination: string) => Promise<{ path: string } | null>;
};
const PROFILES: Profile[] = ['quiz', 'exam', 'vocab', 'timeline', 'mockmock', 'mockschool'];
const MAX_DOCUMENT = 50 * 1024 * 1024;
const HELP = `IQv2 Generator — offline authoring and validation CLI

Usage:
  iqv2 init --profile quiz|exam|vocab|timeline|mockmock|mockschool --out FILE [--force] [--json]
  iqv2 validate FILE [--json] [--warnings-as-errors]
  iqv2 inspect FILE [--json]
  iqv2 schema [--profile PROFILE] [--json]
  iqv2 render FILE --out FILE.html [--mode questions|answers|study] [--force] [--json]
  iqv2 pdf FILE --out-dir DIRECTORY [--force] [--json]

Exit codes: 0 success; 1 invalid document; 2 usage, I/O, or runtime failure.
The pdf command writes both questions.pdf and answers.pdf. No network or API key.
Packaged executable: "IQv2 Generator" --cli <command> [options]
`;

function parseArgs(args: string[]) {
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  const values = new Set(['profile', 'out', 'mode', 'out-dir']);
  const booleans = new Set(['json', 'force', 'warnings-as-errors', 'help']);
  for (let at = 0; at < args.length; at++) {
    const argument = args[at];
    if (argument === '--') { positional.push(...args.slice(at + 1)); break; }
    if (!argument.startsWith('--')) { positional.push(argument); continue; }
    const [key, ...rest] = argument.slice(2).split('=');
    if (flags.has(key)) throw new Error(`Duplicate option: --${key}`);
    if (booleans.has(key)) {
      if (rest.length) throw new Error(`--${key} does not take a value.`);
      flags.set(key, true);
    } else if (values.has(key)) {
      const value = rest.length ? rest.join('=') : args[++at];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: --${key}`);
      flags.set(key, value);
    } else throw new Error(`Unknown option: --${key}`);
  }
  return { positional, flags };
}

function getString(flags: Map<string, string | boolean>, key: string, required = false) {
  const value = flags.get(key);
  if (typeof value === 'string') return value;
  if (required) throw new Error(`Required option: --${key}`);
  return undefined;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

async function writeOutput(filename: string, text: string, force: boolean) {
  const absolute = path.resolve(filename);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, text, { encoding: 'utf8', flag: force ? 'w' : 'wx' });
  return absolute;
}

async function readDocument(filename: string) {
  const absolute = path.resolve(filename);
  const stat = await fs.stat(absolute);
  if (!stat.isFile() || stat.size > MAX_DOCUMENT) throw new Error('Input must be a JSON file of at most 50 MiB.');
  const text = (await fs.readFile(absolute, 'utf8')).replace(/^\uFEFF/, '');
  return { path: absolute, text };
}

async function nodeRasterDecoder(dataUrl: string) {
  // Force a full pixel decode; metadata alone accepts truncated/corrupt images.
  const sharp = (await import('sharp')).default;
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const { info } = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height };
}

async function readValidated(filename: string, context: CliContext) {
  const input = await readDocument(filename);
  const report = parseDocument(input.text);
  if (report.document && report.valid) {
    report.issues.push(...validateRenderDocument(report.document).map(issue => ({ ...issue, severity: 'error' as const })));
    const imageIssues = await validateRasterDecoding(report.document, context.decodeRaster || nodeRasterDecoder);
    report.issues = report.issues.filter(issue => issue.code !== 'PIXEL_DECODE_REQUIRED');
    report.issues.push(...imageIssues);
    report.valid = !report.issues.some(issue => issue.severity === 'error');
  }
  return { input, report };
}

function reportText(report: ValidationReport) {
  const lines = [report.valid ? 'VALID' : 'INVALID'];
  for (const issue of report.issues) lines.push(`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`);
  lines.push(`${report.stats.questions} questions, ${report.stats.entries} entries, ${report.stats.totalPoints} points, ${report.stats.images} images`);
  return `${lines.join('\n')}\n`;
}

async function offlineHtml(root: string, document: unknown, mode: Mode) {
  let css;
  try { css = await fs.readFile(path.join(root, 'dist', 'render-assets.css'), 'utf8'); }
  catch {
    const { buildOfflineAssetCss } = await import('../src/render/assets.js');
    css = await buildOfflineAssetCss(root);
  }
  const title = (document as { meta?: { title?: string } }).meta?.title || 'IQv2';
  const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="iqv2-offline-assets" content="embedded"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${escapeHtml(title)}</title><style>${css}\n${printStyles}</style></head><body>${renderDocument(document, mode)}</body></html>`;
}

async function childPdf(root: string, args: string[], stdout: (text: string) => void, stderr: (text: string) => void) {
  const outDir = args.findIndex(value => value === '--out-dir');
  if (outDir === -1 && !args.some(value => value.startsWith('--out-dir='))) throw new Error('Required option: --out-dir');
  const requireAtRoot = createRequire(path.join(root, 'package.json'));
  const electron = requireAtRoot('electron') as string;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, [root, '--cli', ...args], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk: Buffer) => stdout(chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => stderr(chunk.toString()));
  return new Promise<number>((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 2)); });
}

/** Shared by the Node launcher and the packaged Electron executable. */
export async function runCli(args: string[], context: CliContext = {}): Promise<number> {
  const stdout = context.stdout || ((text: string) => { process.stdout.write(text); });
  const stderr = context.stderr || ((text: string) => { process.stderr.write(text); });
  const root = context.appRoot || process.cwd();
  const json = args.includes('--json');
  try {
    const { positional, flags } = parseArgs(args);
    const command = positional[0] || 'help';
    if (flags.has('help') || command === 'help') { stdout(HELP); return 0; }
    const allowed: Record<string, string[]> = {
      init: ['profile', 'out', 'force', 'json'], validate: ['json', 'warnings-as-errors'], inspect: ['json'],
      schema: ['profile', 'json'], render: ['out', 'mode', 'force', 'json'], pdf: ['out-dir', 'force', 'json'],
    };
    if (!allowed[command]) throw new Error(`Unknown command: ${command}`);
    for (const key of flags.keys()) if (!allowed[command].includes(key)) throw new Error(`--${key} is not supported by ${command}.`);
    const expectsFile = ['validate', 'inspect', 'render', 'pdf'].includes(command);
    if (positional.length !== (expectsFile ? 2 : 1)) throw new Error(expectsFile ? `${command} requires exactly one input JSON file.` : `${command} does not take positional arguments.`);
    const emit = (value: unknown, text: string) => stdout(json ? `${JSON.stringify(value, null, 2)}\n` : text);
    if (command === 'init') {
      const profile = getString(flags, 'profile', true) as Profile;
      if (!PROFILES.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
      const document = createTemplate(profile);
      const destination = await writeOutput(getString(flags, 'out', true)!, `${JSON.stringify(document, null, 2)}\n`, flags.has('force'));
      emit({ ok: true, command, profile, path: destination }, `Created ${profile}: ${destination}\n`);
      return 0;
    }
    if (command === 'schema') {
      const profile = (getString(flags, 'profile') || 'quiz') as Profile;
      if (!PROFILES.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
      const base = await fs.readFile(path.join(root, 'resources', 'skills', 'iqv2-generator', 'references', 'IQV2-SCHEMA.md'), 'utf8');
      const extra = ['mockmock', 'mockschool'].includes(profile) ? await fs.readFile(path.join(root, 'resources', 'skills', profile === 'mockmock' ? 'mockmocktest' : 'mockschooltest', 'references', 'OUTPUT-SCHEMA.md'), 'utf8') : '';
      emit({ ...schemaGuide, profile, documentation: `${base}\n${extra}` }, `${base}\n${extra}`);
      return 0;
    }
    const { input, report } = await readValidated(positional[1], context);
    if (command === 'validate') {
      const failed = !report.valid || (flags.has('warnings-as-errors') && report.issues.some(issue => issue.severity === 'warning'));
      emit({ ...report, document: undefined, path: input.path, ok: !failed }, reportText(report));
      return failed ? 1 : 0;
    }
    if (command === 'inspect') {
      const document = report.document as { kind?: string; schemaVersion?: string; meta?: unknown } | undefined;
      emit({ path: input.path, valid: report.valid, profile: report.profile, kind: document?.kind, schemaVersion: document?.schemaVersion, meta: document?.meta, stats: report.stats, issues: report.issues }, reportText(report));
      return report.valid ? 0 : 1;
    }
    if (!report.valid || !report.document) {
      emit({ ok: false, path: input.path, issues: report.issues }, reportText(report));
      return 1;
    }
    if (command === 'render') {
      const mode = (getString(flags, 'mode') || 'questions') as Mode;
      if (!['questions', 'answers', 'study'].includes(mode)) throw new Error(`Unknown render mode: ${mode}`);
      const html = await offlineHtml(root, report.document, mode);
      const destination = await writeOutput(getString(flags, 'out', true)!, html, flags.has('force'));
      emit({ ok: true, command, mode, path: destination, issues: report.issues }, `Rendered ${mode}: ${destination}\n`);
      return 0;
    }
    if (!context.exportPdf) return await childPdf(root, args, stdout, stderr);
    const directory = path.resolve(getString(flags, 'out-dir', true)!);
    await fs.mkdir(directory, { recursive: true });
    const destinations = ['questions', 'answers'].map(mode => path.join(directory, `${mode}.pdf`));
    if (!flags.has('force')) for (const filename of destinations) {
      try { await fs.access(filename); throw new Error(`Output exists; use --force: ${filename}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const title = report.document.meta.title || 'IQv2';
    for (const [index, mode] of (['questions', 'answers'] as const).entries()) {
      const html = await offlineHtml(root, report.document, mode);
      await context.exportPdf({ title, html, mode }, destinations[index]);
    }
    emit({ ok: true, command, paths: { questions: destinations[0], answers: destinations[1] }, issues: report.issues }, `Created ${destinations.join('\nCreated ')}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const printFailure = error && typeof error === 'object' && 'code' in error && error.code === 'PRINT_PREFLIGHT' && 'issues' in error && Array.isArray(error.issues);
    if (json) stdout(`${JSON.stringify({ ok: false, error: { code: printFailure ? 'PRINT_PREFLIGHT' : 'CLI_ERROR', message }, ...(printFailure ? { issues: error.issues } : {}) })}\n`);
    else stderr(`Error: ${message}\n`);
    return printFailure ? 1 : 2;
  }
}
