import { getCollection } from 'astro:content';
import { countryPath, destinationPath, tourPath, excursionPath, themePath } from './routes';
import { isActiveEntity } from './archive.mjs';
import { buildHeroVideoCatalog, borrowedHeroVideo } from './hero-video-catalog.mjs';
import posters from '../data/media/hero-video-posters.json';

let catalog: Promise<Map<string, any>>;
const routes = {
  countries: countryPath, destinations: destinationPath, tours: tourPath,
  excursions: excursionPath, themes: themePath,
  cases: (data: { slug: string }) => `/cases/${data.slug}/`,
};

async function loadCatalog() {
  const records = [{ image: '/media/home/hero-rio-generated-20261008-v2.webp', path: '/',
    video: { src: '/media/home/home-hero-20261016-v1.mp4', mobileSrc: '/media/home/home-hero-mobile-20261021-v1.mp4' } }];
  for (const [collection, pathFor] of Object.entries(routes)) {
    const entries = await getCollection(collection as keyof typeof routes);
    for (const { data } of entries) {
      if (data.locale !== 'ru' || !isActiveEntity(data) || !data.hero?.src || !data.heroVideo) continue;
      records.push({ image: data.hero.src, path: (pathFor as Function)(data), video: data.heroVideo });
    }
  }
  return buildHeroVideoCatalog(records, posters.items);
}

export async function videoForBorrowedHero(image: string | undefined, pathname: string) {
  if (!image) return undefined;
  catalog ??= loadCatalog();
  const base = import.meta.env.BASE_URL;
  const logicalPath = base !== '/' && pathname.startsWith(base) ? '/' + pathname.slice(base.length) : pathname;
  return borrowedHeroVideo(await catalog, image, logicalPath);
}
