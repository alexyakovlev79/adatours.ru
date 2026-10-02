const urls = [
  'https://brasiltours.ru/image/countries/colombia/cartaghena.jpg',
  'https://brasiltours.ru/image/Cartagena.png',
  'https://brasiltours.ru/image/countries/colombia/cartag5.jpg',
  'https://brasiltours.ru/image/countries/colombia/cartaghen-2.jpg',
  'https://brasiltours.ru/image/countries/colombia/cartaghena5.jpg',
  'https://brasiltours.ru/image/countries/colombia/cartaghena2.jpg',
  'https://brasiltours.ru/image/catalog/product/f/i/file_48.jpg',
];

const isImageBytes = (bytes) => {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const webp = bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return jpeg || png || webp;
};

for (const url of urls) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 AdaToursMediaQA/1.0' },
  });

  if (response.status !== 200) {
    throw new Error(`Media QA failed: ${response.status} ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Media QA failed: Content-Type ${contentType} for ${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`Media QA failed: only ${bytes.length} bytes for ${url}`);
  }

  if (!isImageBytes(bytes)) {
    throw new Error(`Media QA failed: invalid image signature for ${url}`);
  }

  console.log(`OK ${response.status} ${contentType} ${bytes.length} bytes ${url}`);
}

console.log(`Cartagena media QA passed: ${urls.length}/${urls.length}`);
