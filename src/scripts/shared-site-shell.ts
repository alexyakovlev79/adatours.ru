let pending: Promise<void> | undefined;

export function ensureSharedSiteShell(): Promise<void> {
  const placeholder = document.querySelector<HTMLElement>('[data-site-shell="header"]');
  if (!placeholder) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const url = placeholder.getAttribute('data-site-shell-src');
    if (!url) throw Error('Missing shared navigation URL');
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw Error('Shared navigation HTTP ' + response.status);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const sourceHeader = doc.querySelector<HTMLElement>('header[data-site-header]');
    if (!sourceHeader) throw Error('Missing shared header');
    const header = sourceHeader.cloneNode(true) as HTMLElement;
    header.className = placeholder.className;
    placeholder.replaceWith(header);

    const blocks = [
      ['search', '[data-search-overlay]'],
      ['footer', 'footer.footer'],
      ['cookie', '[data-cookie-notice]'],
    ];
    for (const [name, selector] of blocks) {
      const target = document.querySelector('[data-site-shell="' + name + '"]');
      const source = doc.querySelector(selector);
      if (!target || !source) throw Error('Missing shared fragment ' + name);
      target.replaceWith(source.cloneNode(true));
    }

  })().catch((error) => {
    console.error('Ada Tours shared navigation failed:', error);
  });
  return pending;
}
