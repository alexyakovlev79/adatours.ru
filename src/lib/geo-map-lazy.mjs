// All three gates are independent and must pass before map API/network loading.
export function movedDown(previousY, currentY) {
  return Number.isFinite(previousY) && Number.isFinite(currentY) &&
    currentY > Math.max(0, previousY) + 1 && currentY > 0;
}

export function nearViewport(rect, viewportHeight, margin = 300) {
  return !!rect && Number.isFinite(rect.top) && Number.isFinite(rect.bottom) &&
    Number.isFinite(viewportHeight) && viewportHeight > 0 &&
    rect.top <= viewportHeight + margin && rect.bottom >= -margin;
}

export function canMountGeoMap({firstScreenReady, scrolledDown, near}) {
  return firstScreenReady === true && scrolledDown === true && near === true;
}
