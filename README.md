# tolka ✨

![Banner](./assets/banner.png)

A local UI for your locales. 
No cloud, no account, just your files.

## Features

- **Edit translations** — Inline editing with auto-save
- **Nested keys** — Supports dot notation (e.g. `common.greeting`)
- **AI translation** — Generate missing translations (optional)
- **Bulk translate** — Fill all missing values at once
- **Metadata** — Notes, tags, and status per key
- **Search & filter** — Find keys quickly, show/hide languages

## Quick Start

```bash
npx tolka-cli [/path/to/your/locales]
```

Starts a local server at [http://localhost:3000](http://localhost:3000). Defaults to `./src/locales` if no path is given.

## File Format

Expects JSON files in the specified directory:

```
locales/
├── en.json
├── fr.json
└── de.json
```

Each locale file is a flat or nested JSON object:

```json
{
  "common.greeting": "Hello",
  "common.farewell": "Goodbye",
  "errors.notFound": "Page not found"
}
```

## AI Translation

To use AI-powered translation, set your OpenAI API key:

```bash
OPENAI_API_KEY=sk-... npx tolka-cli ./locales
```

## Requirements

- Node.js 18+

## Links

- [tolka.dev](https://tolka.dev)
- [GitHub](https://github.com/jeremieamstutz/tolka)
- MIT License