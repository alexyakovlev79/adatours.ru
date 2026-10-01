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
  {
    url: 'https://brasiltours.ru/image/countries/argentina/excursiya-tigre-1.jpg',
    path: 'public/media/excursions/jekskursija-v-tigre/hero.jpg',
    referer: 'https://brasiltours.ru/jekskursija-v-tigre',
  },
  {
    url: 'https://brasiltours.ru/image/countries/argentina/buenos1.jpg',
    path: 'public/media/excursions/jekskursija-v-tigre/gallery-1.jpg',
    referer: 'https://brasiltours.ru/jekskursija-v-tigre',
  },
  {
    url: 'https://brasiltours.ru/image/countries/argentina/tigre-trip.png',
    path: 'public/media/excursions/jekskursija-v-tigre/gallery-2.png',
    referer: 'https://brasiltours.ru/jekskursija-v-tigre',
  },
  {
    url: 'https://brasiltours.ru/image/catalog/product/f/i/file_47_34.png',
    path: 'public/media/excursions/jekskursija-v-tigre/gallery-3.png',
    referer: 'https://brasiltours.ru/jekskursija-v-tigre',
  },
  {
    url: 'https://brasiltours.ru/image/catalog/product/f/i/file_48_28.png',
    path: 'public/media/excursions/jekskursija-v-tigre/gallery-4.png',
    referer: 'https://brasiltours.ru/jekskursija-v-tigre',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/raphael-nogueira-espuilpsruw-1920.jpg',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/hero.jpg',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/rio%20at%20night.png',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/gallery-1.png',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/new-pics/thales-botelho-de-sousa-quqishtm0h0-unsplash-1.jpg',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/gallery-2.jpg',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/Rio%20de%20Janeiro.png',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/gallery-3.png',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/bra-rio-de-janeiro1.jpg',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/gallery-4.jpg',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/countries/brazil/new-pics/sugaloaf-view-rio-de-janeiro.jpg',
    path: 'public/media/excursions/ekskursiya-na-sakharnuyu-golovu/gallery-5.jpg',
    referer: 'https://brasiltours.ru/ekskursiya-na-sakharnuyu-golovu',
  },
  {
    url: 'https://brasiltours.ru/image/countries/peru/kanon-kolka-69.jpg',
    path: 'public/media/excursions/kanon-kolka-i-polet-kondora/hero.jpg',
    referer: 'https://brasiltours.ru/kanon-kolka-i-polet-kondora',
  },
  {
    url: 'https://brasiltours.ru/image/countries/peru/smotrovaya-ploshchad.jpg',
    path: 'public/media/excursions/kanon-kolka-i-polet-kondora/gallery-1.jpg',
    referer: 'https://brasiltours.ru/kanon-kolka-i-polet-kondora',
  },
  {
    url: 'https://brasiltours.ru/image/countries/peru/kolkayuk.jpg',
    path: 'public/media/excursions/kanon-kolka-i-polet-kondora/gallery-2.jpg',
    referer: 'https://brasiltours.ru/kanon-kolka-i-polet-kondora',
  },
  {
    url: 'https://brasiltours.ru/image/Arequipa.jpg',
    path: 'public/media/excursions/kanon-kolka-i-polet-kondora/gallery-3.jpg',
    referer: 'https://brasiltours.ru/kanon-kolka-i-polet-kondora',
  },

  {
    url: 'https://brasiltours.ru/image/countries/uruguay/montevideo-1680.jpg',
    path: 'public/media/excursions/peshij-tur-po-istoricheskomu-tsentru/hero.jpg',
    referer: 'https://brasiltours.ru/peshij-tur-po-istoricheskomu-tsentru',
  },
  {
    url: 'https://brasiltours.ru/image/montevid11.png',
    path: 'public/media/excursions/peshij-tur-po-istoricheskomu-tsentru/gallery-1.png',
    referer: 'https://brasiltours.ru/peshij-tur-po-istoricheskomu-tsentru',
  },
  {
    url: 'https://brasiltours.ru/image/Uruguay%20Montevideo.jpg',
    path: 'public/media/excursions/peshij-tur-po-istoricheskomu-tsentru/gallery-2.jpg',
    referer: 'https://brasiltours.ru/peshij-tur-po-istoricheskomu-tsentru',
  },
  {
    url: 'https://brasiltours.ru/image/montevideo3jpg.png',
    path: 'public/media/excursions/peshij-tur-po-istoricheskomu-tsentru/gallery-3.png',
    referer: 'https://brasiltours.ru/peshij-tur-po-istoricheskomu-tsentru',
  },
  {
    url: 'https://brasiltours.ru/image/countries/uruguay/2.jpg',
    path: 'public/media/excursions/punta-del-este-i-piriapolis/hero.jpg',
    referer: 'https://brasiltours.ru/punta-del-este-i-piriapolis',
  },
  {
    url: 'https://brasiltours.ru/image/countries/uruguay/pirapolis.jpg',
    path: 'public/media/excursions/punta-del-este-i-piriapolis/gallery-1.jpg',
    referer: 'https://brasiltours.ru/punta-del-este-i-piriapolis',
  },
  {
    url: 'https://brasiltours.ru/image/countries/uruguay/castelo-pirapol.jpg',
    path: 'public/media/excursions/punta-del-este-i-piriapolis/gallery-2.jpg',
    referer: 'https://brasiltours.ru/punta-del-este-i-piriapolis',
  },
  {
    url: 'https://brasiltours.ru/image/punta-del-este-18072018-339787.png',
    path: 'public/media/excursions/punta-del-este-i-piriapolis/gallery-3.png',
    referer: 'https://brasiltours.ru/punta-del-este-i-piriapolis',
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
