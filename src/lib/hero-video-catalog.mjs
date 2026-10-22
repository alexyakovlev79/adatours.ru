export function mediaIdentity(source) {
  if (!source) return undefined;
  const path = new URL(source, 'https://adatours.ru').pathname;
  const media = path.indexOf('/media/');
  return media >= 0 ? path.slice(media) : path;
}

export function withFirstFrames(sources, posters) {
  if (!sources) return undefined;
  const result = {};
  for (const [videoKey, frameKey] of [['src', 'poster'], ['mobileSrc', 'mobilePoster']]) {
    const source = sources[videoKey];
    const frame = posters.find((p) => p.src === source)?.poster;
    // Publishing a movie requires its registered first frame. Never invent one.
    if (source && frame) { result[videoKey] = source; result[frameKey] = frame; }
  }
  return result.src || result.mobileSrc ? result : undefined;
}

export function buildHeroVideoCatalog(records, posters) {
  const byImage = new Map();
  for (const record of records) {
    const video = withFirstFrames(record.video, posters);
    const key = mediaIdentity(record.image);
    if (!key || !video) continue;
    const previous = byImage.get(key);
    if (previous && JSON.stringify(previous.video) !== JSON.stringify(video)) {
      throw new Error(`Ambiguous hero video for shared photo: ${key}`);
    }
    if (previous) previous.owners.add(record.path);
    else byImage.set(key, { video, owners: new Set([record.path]) });
  }
  return byImage;
}

export function borrowedHeroVideo(catalog, source, currentPath) {
  const record = catalog.get(mediaIdentity(source));
  const path = '/' + String(currentPath).split('/').filter(Boolean).join('/') + '/';
  const normalized = path === '//' ? '/' : path;
  return record && !record.owners.has(normalized) ? record.video : undefined;
}
