// Provider code and tiles load only when the map comes near the viewport.
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
  svg.setAttribute('viewBox', '0 0 36 30');
  svg.setAttribute('focusable', 'false');

  // Two strokes keep the arrow legible over cities, water and mountain relief.
  for (const [color, width] of [['#FFFCF8', '8'], ['#9B6F16', '4']]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M3 15H29M20 6L29 15L20 24');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }
  holder.appendChild(svg);
  return holder;
}

export function createPin(point, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'geo-map__pin';
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

  if (!('IntersectionObserver' in window)) {
    maps.forEach(mount);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      mount(entry.target);
    }
  }, {rootMargin: '300px 0px'});
  maps.forEach(root => observer.observe(root));
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', initMaps, {once: true});
else initMaps();
