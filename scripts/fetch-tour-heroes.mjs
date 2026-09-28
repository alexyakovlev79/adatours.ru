import { mkdir, writeFile } from 'node:fs/promises';

const targets = [
  {
    url: 'https://brasiltours.ru/image/cache/countries/brazil/new-pics/lensojs/oblozhka-1920x1080.webp',
    path: 'public/media/tours/brazil-adventure-17d-hero.webp',
  },
  {
    url: 'https://brasiltours.ru/image/cache/Lenis%20Maranhenses-1920x1080.webp',
    path: 'public/media/tours/brazil-dunes-13d-hero.webp',
  },
  {
    url: 'https://brasiltours.ru/image/cache/countries/brazil/new-pics/porto-de-galinhas/porto-de-galinhas-4-1920x1080.webp',
    path: 'public/media/tours/brazil-northeast-recife-porto-noronha-10d-hero.webp',
  },
];

await mkdir('public/media/tours', { recursive: true });

for (const target of targets) {
  const response = await fetch(target.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AdaToursSiteBuild/1.0)',
      'referer': 'https://brasiltours.ru/',
      'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${target.url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected content-type for ${target.url}: ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10000) {
    throw new Error(`Downloaded image is suspiciously small: ${target.url} (${bytes.length} bytes)`);
  }

  await writeFile(target.path, bytes);
  console.log(`Fetched ${target.url} -> ${target.path} (${bytes.length} bytes)`);
}
