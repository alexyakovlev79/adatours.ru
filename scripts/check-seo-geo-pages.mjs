import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { parseSeoGeoArticle, seoGeoArticleFile } from '../src/lib/seo-geo.mjs';
import { isArchivedPath } from '../src/lib/archive.mjs';
import { createHash } from 'node:crypto';
import { PREFLIGHT_GATE_SINCE } from './lib/seo-geo-recovery.mjs';

const root = join(process.cwd(), 'data', 'seo-geo', 'articles');
const dist = join(process.cwd(), 'dist');
const allFiles = (base) => {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true }).flatMap((item) => {
    const file = join(base, item.name);
    return item.isDirectory() ? allFiles(file) : [file];
  });
};

const registryRoot = join(process.cwd(), 'data', 'seo-geo', 'registry');
const registryUrls = new Set();
const errors = [];
for (const name of ['01-countries.json', '02-interests.json', '03-country-interest.json',
  '04-country-interest-vip.json', '05-tours.json', '06-places.json', '07-excursions.json']) {
  const phase = JSON.parse(readFileSync(join(registryRoot, name), 'utf8'));
  for (const row of phase.entries) {
    registryUrls.add(row.url);
    // Offline release gate: new staging articles must carry proof of a prior
    // passing preflight for these exact article bytes. Historical rows are
    // handled separately by the publishing master.
    if (row.work !== 'prepared' || !row.preparedAt ||
        row.preparedAt < PREFLIGHT_GATE_SINCE) continue;
    if (!/^[0-9a-f]{40}$/.test(row.preflightCommit ?? '') ||
        !/^[0-9a-f]{40}$/.test(row.preflightArticleBlobSha ?? '')) {
      errors.push('Unverified SEO/GEO prepared article: ' + row.url);
      continue;
    }
    const articlePath = seoGeoArticleFile(row.url);
    const absolute = join(process.cwd(), articlePath);
    if (!existsSync(absolute)) {
      errors.push('Prepared SEO/GEO article file missing: ' + row.url);
      continue;
    }
    const bytes = readFileSync(absolute);
    const actual = createHash('sha1').update('blob ' + bytes.length + '\0')
      .update(bytes).digest('hex');
    if (actual !== row.preflightArticleBlobSha) {
      errors.push('SEO/GEO article changed after preflight: ' + row.url);
    }
  }
}
const articles = allFiles(root).filter((file) => file.endsWith('.md'));
const targets = new Set();
let approved = 0;
let retainedUnavailable = 0;
for (const file of articles) {
  try {
    const article = parseSeoGeoArticle(readFileSync(file, 'utf8'), file);
    if (!registryUrls.has(article.targetPath)) throw new Error('SEO/GEO URL is not registered: ' + article.targetPath);
    const expected = seoGeoArticleFile(article.targetPath).replaceAll('/', sep);
    if (relative(process.cwd(), file) !== expected) {
      throw new Error('Article path must mirror its targetPath: ' + expected);
    }
    if (targets.has(article.targetPath)) throw new Error('Duplicate article URL: ' + article.targetPath);
    targets.add(article.targetPath);
    const built = join(dist, article.targetPath, 'index.html');
    if (article.status === 'approved') {
      approved += 1;
      // An archived/temporarily missing page does not delete its editorial article
      // or make unrelated deployments fail. The canonical page can return later.
      if (!existsSync(built)) { retainedUnavailable += 1; continue; }
      const html = readFileSync(built, 'utf8');
      const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html);
      if (noindex) { retainedUnavailable += 1; continue; }
      const marker = 'data-seo-geo-target="' + article.targetPath + '"';
      if (html.split(marker).length !== 2) throw new Error('Expected exactly one built SEO/GEO block: ' + article.targetPath);
      const block = html.slice(html.indexOf(marker));
      const section = block.slice(0, block.indexOf('</section>'));
      if (!section.includes('aria-expanded=') || !section.includes(article.buttonLabel)) {
        throw new Error('SEO/GEO toggle missing from HTML: ' + article.targetPath);
      }
      if (!section.includes('<h2') || section.includes('<img') || /\{\{[^}]+\}\}/.test(section)) {
        throw new Error('SEO/GEO body has no H2 or contains images/unresolved variables: ' + article.targetPath);
      }
      const links = [...section.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);
      for (const href of links) {
        const route = href.split('#')[0];
        // Archive pages return HTTP 200, but must never be recommended from an active article.
        if (isArchivedPath(route)) {
          throw new Error('SEO/GEO link points to an archived tour/excursion: ' + href + ' on ' + article.targetPath);
        }
        if (!route.startsWith('/') || route.startsWith('//') || !existsSync(join(dist, route, 'index.html'))) {
          throw new Error('SEO/GEO internal link missing or not canonical: ' + href + ' on ' + article.targetPath);
        }
      }
    } else if (existsSync(built) && readFileSync(built, 'utf8').includes('data-seo-geo-target="' + article.targetPath + '"')) {
      throw new Error('Draft or paused SEO/GEO article was rendered: ' + article.targetPath);
    }
  } catch (error) {
    errors.push(error.message);
  }
}
for (const file of allFiles(dist).filter((name) => /[/\\]page[/\\][2-9][0-9]*[/\\]index\.html$/.test(name))) {
  const html = readFileSync(file, 'utf8');
  if (html.includes('data-seo-geo-target=')) {
    errors.push('Paginated page contains an SEO/GEO article: ' + relative(dist, file));
  }
}
if (errors.length) {
  errors.forEach((message) => console.error('SEO/GEO error: ' + message));
  process.exit(1);
}
console.log('SEO/GEO: ' + articles.length + ' article files, ' + approved
  + ' approved, ' + retainedUnavailable + ' retained without live canonical, 0 pagination copies; links/HTML checked.');
