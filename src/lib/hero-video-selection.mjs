import { isPhoneDevice } from './phone-device.mjs';

// Device variants are independent. Never request a desktop movie on a phone,
// or a mobile movie on a tablet/desktop merely because its viewport is narrow.
export function selectHeroVideo(sources, browser = {}) {
  const phone = isPhoneDevice(browser);
  const src = phone ? sources.mobileSrc : sources.src;
  const poster = phone ? sources.mobilePoster : sources.poster;
  return src ? { src, poster: poster || undefined } : undefined;
}
