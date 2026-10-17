// This entry is loaded only on pages containing the shared GeoRouteMap component.
// Provider scripts and map tiles are not requested until the section nears the viewport.
const scriptLoads = new Map();

export function loadProviderScript(id, url) {
  if (!scriptLoads.has(id)) {
    scriptLoads.set(id, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.async = true;
      el.src = url;
      el.onload = resolve;
      el.onerror = () => {
        scriptLoads.delete(id);
        el.remove();
        reject(new Error('Map API could not be loaded: ' + id));
      };
      document.head.append(el);
    }));
  }
  return scriptLoads.get(id);
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
  const selected = root.querySelector('.geo-map__pin[aria-pressed=true]');
  selected?.setAttribute('aria-pressed', 'false');
  for (const marker of root.querySelectorAll('.geo-map__pin')) {
    if (marker.getAttribute('aria-label')?.startsWith(point.name + ':'))
      marker.setAttribute('aria-pressed', 'true');
  }
}

async function mount(root) {
  if (root.dataset.mapMounted) return;
  root.dataset.mapMounted = 'true';
  const element = root.querySelector('[data-geo-map-canvas]');
  const status = root.querySelector('[data-geo-map-status]');
  let payload;
  try { payload = JSON.parse(root.dataset.geoMapPayload || '{}'); }
  catch { status.textContent = 'Данные карты недоступны'; return; }
  if (!payload.points?.length || !element) return;

  const preference = root.dataset.provider === 'google' ? ['google', 'yandex'] : ['yandex', 'google'];
  const keys = {yandex: root.dataset.yandexKey, google: root.dataset.googleKey};
  const select = point => openCard(root, point);
  let lastError = null;
  for (const provider of preference) {
    if (!keys[provider]) continue;
    try {
      if (provider === 'yandex') {
        const {renderYandexMap} = await import('./geo-map-yandex.mjs');
        await renderYandexMap(element, payload, keys.yandex, select, loadProviderScript, createPin, root.dataset.locale);
      } else {
        const {renderGoogleMap} = await import('./geo-map-google.mjs');
        await renderGoogleMap(element, payload, keys.google, root.dataset.googleMapId, select, loadProviderScript, createPin, root.dataset.locale);
      }
      status.hidden = true;
      root.dataset.mapReady = provider;
      return;
    } catch (error) {
      lastError = error;
      element.replaceChildren();
    }
  }
  status.textContent = lastError
    ? 'Карта временно недоступна. Места маршрута перечислены ниже.'
    : 'Карта подключается после настройки картографического API.';
}

function initMaps() {
  const maps = document.querySelectorAll('[data-geo-map]');
  if (!maps.length) return;
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
  for (const root of maps) root.querySelector('[data-geo-card-close]')
    ?.addEventListener('click', () => {root.querySelector('[data-geo-card]').hidden = true;});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMaps, {once:true});
else initMaps();
