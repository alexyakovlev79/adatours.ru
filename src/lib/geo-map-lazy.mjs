// Visible map sections do not require a scroll; offscreen maps retain the scroll/proximity gate.
export function movedDown(previousY, currentY) {
  return Number.isFinite(previousY) && Number.isFinite(currentY) &&
    currentY > Math.max(0, previousY) + 1 && currentY > 0;
}

export function nearViewport(rect, viewportHeight, margin = 300) {
  return !!rect && Number.isFinite(rect.top) && Number.isFinite(rect.bottom) &&
    Number.isFinite(viewportHeight) && viewportHeight > 0 &&
    rect.top <= viewportHeight + margin && rect.bottom >= -margin;
}

export function isMapVisible(rect, viewportWidth, viewportHeight) {
  return !!rect && Number.isFinite(rect.top) && Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.left) && Number.isFinite(rect.right) &&
    Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
    rect.width > 0 && rect.height > 0 &&
    Number.isFinite(viewportWidth) && viewportWidth > 0 &&
    Number.isFinite(viewportHeight) && viewportHeight > 0 &&
    rect.right > 0 && rect.left < viewportWidth &&
    rect.bottom > 0 && rect.top < viewportHeight;
}

export function canMountGeoMap({firstScreenReady, scrolledDown, near, visible}) {
  return firstScreenReady === true &&
    (visible === true || (scrolledDown === true && near === true));
}
