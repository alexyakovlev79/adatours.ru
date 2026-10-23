import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The same wedding photo is a page hero AND a home interest tile; only the latter needs this rule.
test('home wedding card protects both faces on phone tiles independently of hero-crop registry', () => {
  const component = readFileSync(new URL('../src/components/editorial/InterestCard.astro', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../src/content/themes/svadby-i-romantika.md', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(theme, /id: theme_weddings_romance/);
  assert.match(theme, /hero-enhanced-20261001\.webp/);
  assert.match(home, /<InterestCard[\s\S]*?entityId=\{entry\.data\.id\}[\s\S]*?image=\{entry\.data\.hero\?\.src\}/);
  const mobile = component.split('@media (max-width: 759px)')[1]?.split('@media (max-width: 760px)')[0];
  assert.ok(mobile, 'mobile card CSS exists');
  assert.match(mobile, /theme_weddings_romance[^\n]*--interest-original-position:\s*20% center/);
  assert.match(mobile, /theme_weddings_romance[^\n]*\.interest-card__image img[^\n]*object-position:\s*20% center/);
});
