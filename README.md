# adatours.ru

Official website of Ada Tours — DMC and tour operator for Brazil and Latin America.

## Stack

- Astro 7
- Static output
- GitHub Pages
- Astro Content Collections
- CSS-first UI, minimal client JavaScript

## Preview and production paths

GitHub Pages preview uses:

- `SITE_ORIGIN=https://alexyakovlev79.github.io`
- `SITE_BASE=/adatours.ru`

Production on the custom domain uses:

- `SITE_ORIGIN=https://adatours.ru`
- `SITE_BASE=/`

Components resolve internal links and local media through `import.meta.env.BASE_URL`, so the preview subpath does not leak into production URLs.

The GitHub Pages preview is marked `noindex,nofollow,noarchive`.

## Current prototype

The first visual prototype includes:

- Home
- Brazil country page
- Rio de Janeiro destination page
- Luxury Brazil tour detail
- global header / mobile menu / footer
- 404
- core editorial and tour components

Photography under `public/media/prototype/` is provisional and will be reselected before production.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
