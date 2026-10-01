import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const files = [
  {
    url: 'https://brasiltours.ru/image/galapagos%20diving%202.png',
    path: 'public/media/excursions/ostrov-santa-krus/hero.png',
    referer: 'https://brasiltours.ru/ostrov-santa-krus',
  },
  {
    url: 'https://brasiltours.ru/image/galapagos4.png',
    path: 'public/media/excursions/ostrov-santa-krus/gallery-1.png',
    referer: 'https://brasiltours.ru/ostrov-santa-krus',
  },
  {
    url: 'https://brasiltours.ru/image/galapags.png',
    path: 'public/media/excursions/ostrov-santa-krus/gallery-2.png',
    referer: 'https://brasiltours.ru/ostrov-santa-krus',
  },
  {
    url: 'https://brasiltours.ru/image/countries/equador/10-equador-galapagos.jpg',
    path: 'public/media/excursions/tur-na-ostrov-florena/hero.jpg',
    referer: 'https://brasiltours.ru/tur-na-ostrov-florena',
  },
  {
    url: 'https://brasiltours.ru/image/galapagos4.png',
    path: 'public/media/excursions/tur-na-ostrov-florena/gallery-1.png',
    referer: 'https://brasiltours.ru/tur-na-ostrov-florena',
  },
  {
    url: 'https://brasiltours.ru/image/galapagos.png',
    path: 'public/media/excursions/tur-na-ostrov-florena/gallery-2.png',
    referer: 'https://brasiltours.ru/tur-na-ostrov-florena',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/raul-escobar-txoj60clby0-1920.jpg',
    path: 'public/media/excursions/favela-tur/hero.jpg',
    referer: 'https://brasiltours.ru/favela-tur',
  },
  {
    url: 'https://brasiltours.ru/image/corcovado1.png',
    path: 'public/media/excursions/favela-tur/gallery-1.png',
    referer: 'https://brasiltours.ru/favela-tur',
  },
  {
    url: 'https://brasiltours.ru/image/favela11.png',
    path: 'public/media/excursions/favela-tur/gallery-2.png',
    referer: 'https://brasiltours.ru/favela-tur',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/bra-rio-de-janeiro1.jpg',
    path: 'public/media/excursions/favela-tur/gallery-3.jpg',
    referer: 'https://brasiltours.ru/favela-tur',
  },
  {
    url: 'https://brasiltours.ru/image/rio.png',
    path: 'public/media/excursions/favela-tur/gallery-4.png',
    referer: 'https://brasiltours.ru/favela-tur',
  },
];

for (const file of files) {
  await mkdir(dirname(file.path), { recursive: true });
  const response = await fetch(file.url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36',
      referer: file.referer,
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${file.url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected content type for ${file.url}: ${contentType}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`Downloaded image is unexpectedly small: ${file.url}`);
  }

  await writeFile(file.path, bytes);
  console.log(`Fetched ${file.path} (${bytes.length} bytes; ${contentType})`);
}
