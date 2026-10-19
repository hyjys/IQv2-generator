#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const bundled = path.join(root, 'electron', 'cli-bundle.cjs');
const hasSources = fs.existsSync(path.join(root, 'src', 'core', 'index.ts'));
const cli = hasSources
  ? require('tsx/cjs/api').require(path.join(__dirname, 'cli.ts'), __filename)
  : require(bundled);
cli.runCli(process.argv.slice(2), { appRoot: root }).then((code) => { process.exitCode = code; }).catch((error) => {
  process.stderr.write(`${error.message}\n`); process.exitCode = 2;
});
