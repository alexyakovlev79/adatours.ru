// Keep offscreen maps lazy, but load immediately after first-screen readiness when visible.
import {canMountGeoMap, isMapVisible, movedDown, nearViewport} from '../lib/geo-map-lazy.mjs';
const scriptLoads = new Map();

export function loadProviderScript(id, url) {
  if (!scriptLoads.has(id)) {
    scriptLoads.set(id, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.async = true;
      let finished = false;
      let timer;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        el.onload = null;
        el.onerror = null;
        if (error) {
          scriptLoads.delete(id);
          el.remove();
          reject(error);
        } else resolve();
      };
      el.onload = () => finish();
      el.onerror = () => finish(new Error('Could not download the map API script'));
      timer = setTimeout(() => finish(new Error('Map API script loading timed out')), 20000);
      el.src = url;
      document.head.append(el);
    }));
  }
  return scriptLoads.get(id);
}

export function createDirectionalArrow(angle) {
  const holder = document.createElement('span');
  holder.className = 'geo-map__direction';
  holder.setAttribute('aria-hidden', 'true');
  holder.style.setProperty('--direction-angle', String(angle) + 'deg');

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 18');
  svg.setAttribute('focusable', 'false');

  // A compact arrowhead, centered on the actual route leg.
  // No long tail or thick white halo that looks like a second route.
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M3 3L16 9L3 15L6.5 9Z');
  path.setAttribute('fill', '#9B6F16');
  path.setAttribute('stroke', '#FFFCF8');
  path.setAttribute('stroke-width', '1.4');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  holder.appendChild(svg);
  return holder;
}

export function createPin(point, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'geo-map__pin';
  if (point.isPrimary) button.classList.add('geo-map__pin--primary');
  else if (point.isRelated) button.classList.add('geo-map__pin--related');
  button.textContent = String(point.position);
  button.setAttribute('aria-label', point.name + ': показать описание');
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(point);
  });
  return button;
}

function openCard(root, point) {
  const card = root.querySelector('[data-geo-card]');
  if (!card) return;
  const title = card.querySelector('[data-geo-card-title]');
  const summary = card.querySelector('[data-geo-card-summary]');
  const photo = card.querySelector('[data-geo-card-photo]');
  const link = card.querySelector('[data-geo-card-link]');
  title.textContent = point.name;
  summary.textContent = point.description;
  if (point.image) {
    photo.src = point.image;
    photo.alt = point.name;
    photo.hidden = false;
  } else {
    photo.removeAttribute('src');
    photo.hidden = true;
  }
  link.href = point.href;
  card.classList.toggle('geo-map__card--has-photo', Boolean(point.image));
  card.hidden = false;
  for (const marker of root.querySelectorAll('.geo-map__pin'))
    marker.setAttribute('aria-pressed', String(marker.getAttribute('aria-label')?.startsWith(point.name + ':')));
}

function safeDetail(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(/((?:apikey|api_key|token|signature|key)=)[^&\s]+/gi, '$1[hidden]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[hidden]')
    .slice(0, 240);
}

async function mount(root) {
  if (root.dataset.mapMounted === 'true') return;
  root.dataset.mapMounted = 'true';
  const element = root.querySelector('[data-geo-map-canvas]');
  const status = root.querySelector('[data-geo-map-status]');
  const retry = root.querySelector('[data-geo-map-retry]');
  if (!element || !status) return;
  status.hidden = false;
  status.textContent = 'Загружаем карту…';
  if (retry) retry.hidden = true;

  let payload;
  try {
    payload = JSON.parse(root.dataset.geoMapPayload || '{}');
  } catch {
    status.textContent = 'Ошибка данных карты (GEO_DATA).';
    return;
  }
  if (!payload.points?.length) return;

  const preference = root.dataset.provider === 'google'
    ? ['google', 'yandex'] : ['yandex', 'google'];
  const keys = {yandex: root.dataset.yandexKey, google: root.dataset.googleKey};
  const select = point => openCard(root, point);
  let lastError = null;
  let lastProvider = '';

  for (const provider of preference) {
    if (!keys[provider]) continue;
    try {
      if (provider === 'yandex') {
        const {renderYandexMap} = await import('./geo-map-yandex.mjs');
        await renderYandexMap(element, payload, keys.yandex, select,
          loadProviderScript, createPin, root.dataset.locale, createDirectionalArrow);
      } else {
        const {renderGoogleMap} = await import('./geo-map-google.mjs');
        await renderGoogleMap(element, payload, keys.google, root.dataset.googleMapId,
          select, loadProviderScript, createPin, root.dataset.locale, createDirectionalArrow);
      }
      status.hidden = true;
      root.dataset.mapReady = provider;
      delete root.dataset.mapError;
      return;
    } catch (error) {
      lastError = error;
      lastProvider = provider;
      const code = error?.mapCode || (provider === 'google' ? 'GOOGLE_INIT' : 'YANDEX_IMPORT');
      // Logs contain no request URL or API key. The exact fault is preserved only in a
      // sanitized string for the browser's developer console and opt-in debug mode.
      console.warn('[Ada Tours GeoMap]', code, safeDetail(error));
      element.replaceChildren();
    }
  }

  if (lastError) {
    const code = lastError.mapCode ||
      (lastProvider === 'google' ? 'GOOGLE_INIT' : 'YANDEX_IMPORT');
    root.dataset.mapError = code;
    const debug = new URLSearchParams(window.location.search).get('mapdebug') === '1';
    status.textContent = 'Карта временно недоступна. Код: ' + code +
      (debug ? '. ' + safeDetail(lastError) : '.');
    if (retry) retry.hidden = false;
  } else {
    status.textContent = 'Картографический API еще не настроен.';
  }
}

function initMaps() {
  const maps = document.querySelectorAll('[data-geo-map]');
  if (!maps.length) return;

  for (const root of maps) {
    root.querySelector('[data-geo-card-close]')
      ?.addEventListener('click', () => {root.querySelector('[data-geo-card]').hidden = true;});
    root.querySelector('[data-geo-map-retry]')?.addEventListener('click', () => {
      delete root.dataset.mapMounted;
      mount(root);
    });
  }

  // First-screen assets still get priority. A map already in the viewport
  // can start without scrolling; an offscreen map needs downward scroll and proximity.
  let firstScreenReady = false;
  let scrolledDown = false;
  let previousScrollY = Math.max(0, window.scrollY);
  let observer;

  const tryMount = root => {
    const rect = root.getBoundingClientRect();
    const visible = isMapVisible(rect, window.innerWidth, window.innerHeight);
    const near = nearViewport(rect, window.innerHeight, 300);
    if (!canMountGeoMap({firstScreenReady, scrolledDown, near, visible})) return;
    observer?.unobserve(root);
    mount(root);
  };
  const checkNearby = () => maps.forEach(tryMount);

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries)
        if (entry.isIntersecting) tryMount(entry.target);
    }, {rootMargin: '300px 0px'});
    maps.forEach(root => observer.observe(root));
  }

  window.addEventListener('scroll', () => {
    const currentY = Math.max(0, window.scrollY);
    if (movedDown(previousScrollY, currentY)) scrolledDown = true;
    previousScrollY = currentY;
    if (firstScreenReady) checkNearby();
  }, {passive:true});

  // Recheck after resizing, tab restoration, or return from a discarded tab.
  // The double frame allows the browser to restore its saved scroll position.
  window.addEventListener('resize', () => {
    if (firstScreenReady) checkNearby();
  }, {passive:true});
  const checkRestoredViewport = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (firstScreenReady) checkNearby();
    }));
  };
  window.addEventListener('pageshow', checkRestoredViewport);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkRestoredViewport();
  });

  const finishFirstScreen = async () => {
    // window.load includes normal above-fold assets. Explicitly wait for any
    // first-viewport images that were lazy-loaded and excluded from load.
    const visibleImages = Array.from(document.images).filter(image => {
      const rect = image.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    await Promise.all(visibleImages.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        const done = () => {
          image.removeEventListener('load', done);
          image.removeEventListener('error', done);
          resolve();
        };
        image.addEventListener('load', done, {once:true});
        image.addEventListener('error', done, {once:true});
        if (image.complete) done();
      });
    }));
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    firstScreenReady = true;
    checkNearby();
  };

  if (document.readyState === 'complete') void finishFirstScreen();
  else window.addEventListener('load', () => {void finishFirstScreen();}, {once:true});
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', initMaps, {once: true});
else initMaps();
