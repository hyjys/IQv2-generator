const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');

async function runNode(root, args) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const timeout = setTimeout(() => child.kill(), 90_000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  clearTimeout(timeout);
  if (code !== 0) throw new Error(`CLI subprocess exited ${code}: ${stdout}\n${stderr}`);
  return JSON.parse(stdout);
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts', 'desktop-smoke');
  await fs.access(path.join(root, 'dist', 'index.html'));
  await fs.mkdir(output, { recursive: true });
  await fs.rm(path.join(output, 'report.json'), { force: true });
  const env = { ...process.env, IQV2_SMOKE_OUTPUT: output };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [root, '--smoke-test'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const timeout = setTimeout(() => { child.kill(); process.stderr.write('Electron smoke test timed out after 90 seconds.\n'); }, 90_000);
  const exit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  clearTimeout(timeout);
  if (exit !== 0) throw new Error(`Electron smoke test exited with ${exit}.`);
  const report = JSON.parse(await fs.readFile(path.join(output, 'report.json'), 'utf8'));
  if (!report.passed || report.checks.length < 9) throw new Error('Electron smoke report is incomplete.');
  const cliInput = path.join(output, 'cli-input.json');
  await runNode(root, ['scripts/iqv2.cjs', 'init', '--profile', 'mockschool', '--out', cliInput, '--force', '--json']);
  const cliPdf = await runNode(root, ['scripts/iqv2.cjs', 'pdf', cliInput, '--out-dir', path.join(output, 'cli-pdf'), '--force', '--json']);
  if (!cliPdf.ok || !cliPdf.paths?.questions || !cliPdf.paths?.answers) throw new Error('CLI must report both PDF outputs.');
  for (const filename of [cliPdf.paths.questions, cliPdf.paths.answers]) {
    const bytes = await fs.readFile(filename);
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length < 1000) throw new Error(`Invalid CLI PDF: ${filename}`);
  }
  report.checks.push('cli-json-output', 'cli-both-pdf-outputs');
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`Desktop smoke passed (${report.platform}, Electron ${report.electron}). Artifacts: ${output}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
