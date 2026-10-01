import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const files = [
  {
    url: 'https://brasiltours.ru/image/cache/galapagos%20diving%202-1920x1080.webp',
    path: 'public/media/excursions/ostrov-santa-krus/hero.webp',
  },
  {
    url: 'https://brasiltours.ru/image/cache/galapagos4-1920x1080.webp',
    path: 'public/media/excursions/ostrov-santa-krus/gallery-1.webp',
  },
  {
    url: 'https://brasiltours.ru/image/cache/galapags-1920x1080.webp',
    path: 'public/media/excursions/ostrov-santa-krus/gallery-2.webp',
  },
];

for (const file of files) {
  await mkdir(dirname(file.path), { recursive: true });
  const response = await fetch(file.url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AdaToursBuild/1.0)',
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
  console.log(`Fetched ${file.path} (${bytes.length} bytes)`);
}
