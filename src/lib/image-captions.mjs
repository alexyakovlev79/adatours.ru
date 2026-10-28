import overrides from '../data/media/image-caption-overrides.json' with { type: 'json' };
import { logicalImagePath, hoverFromAlt } from '../../scripts/lib/image-captions.mjs';

// Only intentional editorial overrides are installed. Context-only registry drafts
// must never become live descriptions just because their page has a title.
export function createCaptionLookup(images) {
  const bySrc = new Map(images.filter((row) => row.alt && row.hover && row.evidence?.length)
    .map((row) => [logicalImagePath(row.src), row]));
  return (src, fallback = {}, { decorative = false } = {}) => {
    if (decorative) return { alt: '', hover: undefined };
    const row = bySrc.get(logicalImagePath(src));
    const alt = row?.alt ?? fallback.alt ?? '';
    // New immutable image paths need a tooltip too, even before an editorial
    // override is recorded. Restate the existing alt; never invent a scene.
    const hover = row?.hover?.trim() ? row.hover : fallback.hover?.trim() ? fallback.hover : (alt.trim() ? hoverFromAlt(alt) : undefined);
    return { alt, hover: alt.trim() ? hover : undefined };
  };
}

export const imageCaption = createCaptionLookup(overrides.images);
