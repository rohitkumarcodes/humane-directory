# humane.directory

A small static directory of personal websites with RSS/Atom feeds.

## Structure
- `index.html` renders the homepage.
- `about.html` renders the about page.
- `download/index.html` renders the OPML export page.
- `styles/` contains shared and page-specific CSS.
- `scripts/pages/` contains page entry modules.
- `scripts/lib/` contains shared browser-side helpers.
- `scripts/check-data.mjs` and `scripts/check-pages.mjs` provide dependency-free validation.
- `data.json` is the site directory dataset.

## Local preview
Run a simple local server from the repo root:

```bash
python3 -m http.server 8000
```

Then open:
- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/about.html`
- `http://127.0.0.1:8000/download/`

## Checks
Run the lightweight validation scripts with Node:

```bash
node scripts/check-data.mjs
node scripts/check-pages.mjs
```

## OG image
The open graph image is generated from the current `logo.svg`.

To regenerate both the editable source SVG and the published PNG:

```bash
node scripts/generate-og-image.mjs
```

The PNG generation step uses macOS Quick Look plus ImageMagick so the checked-in OG image matches the browser-rendered `logo.svg`.

## `data.json` contract
`data.json` must be an array of objects with:
- `name`: non-empty string
- `url`: absolute URL string
- `feed`: optional absolute URL string
- `description`: non-empty string
- `tags`: non-empty array of non-empty strings

The current runtime normalizes trimmed strings and de-duplicates tags per site.
