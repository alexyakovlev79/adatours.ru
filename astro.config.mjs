import { defineConfig } from 'astro/config';
import { resolveAstroBuildContext } from './src/lib/i18n/build-context.mjs';
import sitemap from '@astrojs/sitemap';
import { isLegacyRedirectPath } from './src/lib/routes.ts';
import { isArchivedPath } from './src/lib/archive.mjs';

const { site, base } = resolveAstroBuildContext(process.env);

export default defineConfig({
  site,
  base,
  output: 'static',
  // Reuse CSS files across pages instead of repeating small sheets in every HTML file.
  build: { inlineStylesheets: 'never' },
  compressHTML: true,
  trailingSlash: 'always',
  prerenderConflictBehavior: 'error',
  integrations: [sitemap({ filter: (page) => !isLegacyRedirectPath(new URL(page).pathname, base) && !isArchivedPath(new URL(page).pathname, base) })],
});
