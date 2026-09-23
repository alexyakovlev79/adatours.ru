import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://adatours.ru',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
