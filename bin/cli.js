#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const localesPath = args[0] || './locales';

const absLocalesPath = path.resolve(process.cwd(), localesPath);

if (!fs.existsSync(absLocalesPath)) {
  console.log(`Locales directory not found. Creating: ${absLocalesPath}`);
  fs.mkdirSync(absLocalesPath, { recursive: true });
}

const projectRoot = path.resolve(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', '.bin', 'next');
const nextDir = path.join(projectRoot, '.next');

if (!fs.existsSync(nextDir)) {
  console.log('Building tolka for the first time, please wait...');
  const build = spawnSync(nextBin, ['build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      I18N_LOCALES_PATH: absLocalesPath,
    },
  });

  if (build.status !== 0) {
    process.exit(build.status);
  }
}

console.log(`Starting tolka with locales in: ${absLocalesPath}`);

const child = spawn(nextBin, ['start'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    I18N_LOCALES_PATH: absLocalesPath,
  },
});

child.on('close', (code) => {
  process.exit(code);
});
