#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const localesPath = args[0] || './src/locales';

const absLocalesPath = path.resolve(process.cwd(), localesPath);

if (!fs.existsSync(absLocalesPath)) {
  console.log(`Locales directory not found. Creating: ${absLocalesPath}`);
  fs.mkdirSync(absLocalesPath, { recursive: true });
}

process.env.I18N_LOCALES_PATH = absLocalesPath;

const projectRoot = path.resolve(__dirname, '..');
const nextDir = path.join(projectRoot, '.next');

async function main() {
  if (!fs.existsSync(nextDir)) {
    console.log('Building tolka for the first time, please wait...');
    const build = require('next/dist/build').default;
    await build(projectRoot);
  }

  console.log(`Starting tolka with locales in: ${absLocalesPath}`);

  const next = require('next');
  const app = next({ dev: false, dir: projectRoot });
  await app.prepare();

  const http = require('http');
  const handle = app.getRequestHandler();
  const port = process.env.PORT || 3000;

  http.createServer(handle).listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`> Ready on ${url}`);
    require('open').default(url);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
