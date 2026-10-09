import overrides from '../data/media/image-caption-overrides.json' with { type: 'json' };
import { logicalImagePath } from '../../scripts/lib/image-captions.mjs';

// Only intentional editorial overrides are installed. Context-only registry drafts
// must never become live descriptions just because their page has a title.
export function createCaptionLookup(images) {
  const bySrc = new Map(images.filter((row) => row.alt && row.hover && row.evidence?.length)
    .map((row) => [logicalImagePath(row.src), row]));
  return (src, fallback = {}, { decorative = false } = {}) => {
    if (decorative) return { alt: '', hover: undefined };
    const row = bySrc.get(logicalImagePath(src));
    return { alt: row?.alt ?? fallback.alt ?? '', hover: row?.hover ?? fallback.hover };
  };
}

export const imageCaption = createCaptionLookup(overrides.images);
