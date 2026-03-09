#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const localesPath = args[0] || './locales';

// Resolve absolute path
const absLocalesPath = path.resolve(process.cwd(), localesPath);

if (!fs.existsSync(absLocalesPath)) {
  console.error(`Locales directory not found: ${absLocalesPath}`);
  console.log("Creating locales directory...");
  fs.mkdirSync(absLocalesPath, { recursive: true });
}

console.log(`Starting i18n-studio with locales in: ${absLocalesPath}`);

// For dev purposes, we run next dev. In production, this would run next start.
const projectRoot = path.resolve(__dirname, '..');
// We need to find the next binary. In bun, it might be in node_modules/.bin/next
const nextBin = path.join(projectRoot, 'node_modules', '.bin', 'next');

const child = spawn(nextBin, ['dev'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { 
    ...process.env, 
    I18N_LOCALES_PATH: absLocalesPath
  }
});

child.on('close', (code) => {
  process.exit(code);
});

