# Agent notes

Astro 7 site (static build) + Cloudflare Worker (`worker/index.mjs`) for `/api/*`, data in D1. See `README.md` (Slovenian) for data flow and API.

## Layout

- `src/pages/*.astro` – one page per view; each page has its own script in `src/scripts/`.
- `src/layouts/`, `src/components/` – shared Astro markup.
- `src/lib/*.mjs` – plain logic with `*.test.mjs` next to it.
- Styling: Tailwind classes in the markup, also in HTML built by `src/scripts/`. Theme (colours, breakpoints `sm` 520px / `md` 760px) and base styles in `src/styles/global.css`.

## Check your work

- `npm test` – unit tests.
- `npm run build` – must pass.
