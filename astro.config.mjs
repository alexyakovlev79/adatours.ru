import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { isLegacyRedirectPath } from './src/lib/routes.ts';
import { isArchivedPath } from './src/lib/archive.mjs';

const site = process.env.SITE_ORIGIN ?? 'https://adatours.ru';
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  prerenderConflictBehavior: 'error',
  integrations: [sitemap({ filter: (page) => !isLegacyRedirectPath(new URL(page).pathname, base) && !isArchivedPath(new URL(page).pathname, base) })],
});
