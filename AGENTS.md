# Repo Notes

- This is a static site with no app framework or build step.
- For local preview, start the server from the repo root with `python3 -m http.server 8000 --bind 127.0.0.1`.
- Main routes to verify are `http://127.0.0.1:8000/`, `http://127.0.0.1:8000/about.html`, and `http://127.0.0.1:8000/download/`.
- Validate changes with `node scripts/check-data.mjs` and `node scripts/check-pages.mjs`.
