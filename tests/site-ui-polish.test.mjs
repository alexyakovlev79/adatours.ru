import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage shows every About subsection and keeps canonical links', () => {
  const home = source('src/pages/index.astro');
  const routes = source('src/lib/site.ts');
  assert.match(home, /import \{ ABOUT_NAV_LINKS \}/);
  assert.match(home, /home-proof-links"[\s\S]*ABOUT_NAV_LINKS\.map/);
  for (const route of ['/press/', '/webinars/', '/partners/', '/team/anna-avanesova/']) {
    assert.ok(routes.includes(`href: '${route}'`), route);
  }
});

test('About, MICE and DMC section menus use accessible mobile disclosures', () => {
  for (const file of ['AboutNav', 'MiceNav', 'DmcNav']) {
    const html = source(`src/components/commercial/${file}.astro`);
    assert.match(html, /<details>/);
    assert.match(html, /<summary>/);
    assert.match(html, /aria-current=\{active === link\.id \? 'page'/);
    assert.match(html, /current\.label/);
    assert.match(html, /:focus-visible/);
  }
});

test('footer hierarchy separates primary links, sublinks, contacts, legal and centred credit', () => {
  const html = source('src/components/global/SiteFooter.astro');
  for (const value of ['ABOUT_NAV_LINKS.slice(1)', 'DMC_NAV_LINKS.slice(1)', 'MICE_NAV_LINKS.slice(1)',
    'footer__navigation', 'footer__subnav', 'footer__contact', 'footer__legal', 'footer__credit']) {
    assert.ok(html.includes(value), value);
  }
  assert.match(html, /\.footer__credit\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
  assert.match(html, /@media \(max-width: 480px\)/);
});

test('editorial icons add mobile landmarks without external media requests', () => {
  const components = [
    'src/components/commercial/CommercialDetails.astro',
    'src/components/authority/AuthoritySourceList.astro',
    'src/components/authority/AuthorityPartnerList.astro',
  ];
  for (const path of components) {
    const html = source(path);
    assert.match(html, /<svg\b/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /https:\/\/.*\.svg/i);
  }
});

test('Multi-country home banner has a daylight image without its dark overlay', () => {
  const home = source('src/pages/index.astro');
  const band = source('src/components/editorial/DestinationBand.astro');
  const multi = home.match(/<DestinationBand[\s\S]*?eyebrow="Multi-country"[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(multi, /image="\/media\/home\/hero-rio-generated-20261008-v2\.webp"/);
  assert.match(multi, /noOverlay/);
  assert.doesNotMatch(multi, /strongOverlay/);
  assert.match(band, /\.band--no-overlay \.band__overlay \{ background: none; \}/);
});

test('footer puts Contacts before About and stays two-column on phones', () => {
  const footer = source('src/components/global/SiteFooter.astro');
  assert.match(footer, /primary: \[NAV_LINKS\[8\], NAV_LINKS\[7\]\]/);
  assert.match(footer, /@media \(max-width: 480px\)[\s\S]*?\.footer__navigation \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});
