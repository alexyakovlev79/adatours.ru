# Ada Tours EN — one source, two GitHub Pages deployments

Date: 2026-11-02. Branch: `main`.

**Owner decision:** No downloaded ZIP, no standalone static-HTML showcase,
no duplicate source/content in two repositories. English and Russian sites
must use a **single canonical code/data repository** for all shared files.

## GitHub repository roles

| Repository | Contents and ownership |
| --- | --- |
| `alexyakovlev79/adatours.ru` | **Only source of truth**: Astro code, shared layouts, tour/excursion/country/destination IDs, canonical offers and prices, image asset links, RU text, EN text overlays, multilingual routing, SEO, tests, all build scripts and the reusable deployment workflow |
| `alexyakovlev79/adatours-en` | **Deployment shell only**: its `README.md` and a tiny `.github/workflows/deploy.yml` caller. No tour MD, no EN overlay, no pictures, no npm package, no generated HTML committed to Git |

The second repository must be **public** and use GitHub Pages → **GitHub
Actions** as its publishing source. Its GitHub description:

> English Ada Tours website deployment only. Shared source code, content, pricing and media are maintained in alexyakovlev79/adatours.ru.

The target's only build workflow must be a **caller**, invoking
`alexyakovlev79/adatours.ru/.github/workflows/en-pages-reusable-deploy.yml@main`.
The prepared minimal caller file is
`infra/en-pages-repository/.github/workflows/deploy.yml` in the source
repository. After the empty target repository is created, place this
single tiny file there. It is distinct orchestration metadata, not a
duplicate build pipeline. Everything else is read directly from the
current canonical source branch during each run. Never duplicate that
file's target-specific wrapper in the canonical source except as
temporary installation bootstrap/reference.

## First accessible address

`https://alexyakovlev79.github.io/adatours-en/` — redirects within the
same Pages host to `/adatours-en/en/tours/`.

GitHub Pages serves generated HTML as a website; the output is uploaded
as a **Pages deployment artifact**, never as a user ZIP and never committed
to a second Git tree. This is an *early live URL for a real website build*,
not yet a complete, indexed English production launch. The current 22
pages are 3 Tours, 11 Excursions, 3 Countries, 4 Destinations and a
catalogue. English public editorial/SEO metadata/forms and the remaining
catalogue still need completing.

The deployed staging uses `lang=en`,
`noindex,nofollow,noarchive,nosnippet`, no canonical/hreflang before
release verification, no live form and **no public EN release flags**.
It never changes `adatours.ru`, the original `main` workflow, or the
legacy `adatours.com` domain. Its base path is the dedicated repository
name (`/adatours-en/`) and its route namespace is `/en/`, not the
historical `/en-pilot-private/`. The builder rejects wrong origins,
bases or accidental release flags.

## How to activate once the target exists

1. Create the public repository `alexyakovlev79/adatours-en`, initialise
   a README, no new code/license/.gitignore.
2. Set **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Add the minimal `.github/workflows/deploy.yml` caller from
   `infra/en-pages-repository/.github/workflows/deploy.yml`. A connected
   GitHub agent may perform this once repository creation is confirmed.
4. Run the target repository's **Actions → Ada Tours EN → Run workflow**.
   The target workflow invokes the canonical reusable workflow and builds
   from the source repository's `main` branch.
5. Check the caller's `deploy` receipt, then open the Pages URL.
   Do **not** claim the website is live before its target Pages run succeeds.

Each future deployment always rebuilds code, shared prices, and texts
from the single canonical repository, so there is no sync/copy-back
state. The target's daily scheduled run checks the latest source branch;
a manual run is available for immediate deployment. Avoid duplicated
webhooks, Pages workers, extra repositories or independent prices.

## Remaining gates

Do not confuse the first accessible staging URL with the fully
translated, public EN production site. Shared Country/Destination
layout integration, commercial forms, Pagefind, SEO title/description,
Schema.org, exact reciprocal hreflang, Word 2027 tariff synchronization,
editorial review and full catalog translation are still to be verified.
Only a separate explicit release decision may change the approved
English domain or its indexability.

**No more Windows ZIP or HTML-preview package preparation.**

## Source integration — 2 November 2026

Existing [PR #59](https://github.com/alexyakovlev79/adatours.ru/pull/59) was merged into canonical `main` as
[`fd646513`](https://github.com/alexyakovlev79/adatours.ru/commit/fd64651398429c9b596847b18f060fe96169297e).
The merged tree passed [RU PR CI #41421457383](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41421457383).
The source-compatible 22-page staging EN build and Pages deploy passed
[EN #41421279503](https://github.com/alexyakovlev79/adatours-en/actions/runs/41421279503).
The reusable workflow and checked-in target caller template now refer to `main`.
The actual `adatours-en` caller must be switched and its new Pages deployment
verified independently; the source commit does not by itself confirm that cutover.
Noindex staging is retained; live English forms, mass translation, public
SEO/hreflang/schema and DNS release remain gated.
