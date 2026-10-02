const targets = [
  ['https://brasiltours.ru/image/countries/colombia/cocora-horseriding.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/img-20220726-wa0158.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/img-20220726-wa0173.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/img-20220726-wa0090.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/coco-v.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/img-20220726-wa0156.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/img-20220726-wa0120.jpg', 'https://brasiltours.ru/salento-i-dolina-kokora'],
  ['https://brasiltours.ru/image/countries/colombia/coffee-in-farm.jpg', 'https://brasiltours.ru/kolumbiya-c-kofe'],
  ['https://brasiltours.ru/image/countries/colombia/cocora-palms.jpg', 'https://brasiltours.ru/kolumbiya-c-kofe'],
];

function hasImageMagic(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 12) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const gif = b.subarray(0, 6).toString('ascii') === 'GIF87a' || b.subarray(0, 6).toString('ascii') === 'GIF89a';
  const webp = b.subarray(0,4).toString('ascii') === 'RIFF' && b.subarray(8,12).toString('ascii') === 'WEBP';
  return jpeg || png || gif || webp;
}

for (const [url, referer] of targets) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36',
      referer,
      accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });

  if (response.status !== 200) {
    throw new Error(`Source media validation failed: ${url} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Source media validation failed: ${url} returned ${contentType || 'no content-type'}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024 || !hasImageMagic(bytes)) {
    throw new Error(`Source media validation failed: ${url} returned invalid image bytes (${bytes.length} bytes)`);
  }

  console.log(`Validated source media: ${url} (HTTP 200; ${contentType}; ${bytes.length} bytes; image magic OK)`);
}
