// A narrow viewport or a touch screen does not make a laptop/tablet a phone.
export function isPhoneDevice(browser = {}) {
  const ua = browser.userAgent || '';
  if (/iPad|Tablet|Silk\/|Kindle|PlayBook/i.test(ua)) return false;
  if (/iPhone|iPod|Windows Phone|IEMobile|BlackBerry|BB10|webOS|KaiOS/i.test(ua)) return true;
  if (/Android/i.test(ua)) return /\bMobile\b/i.test(ua);
  return browser.userAgentData?.mobile === true;
}
