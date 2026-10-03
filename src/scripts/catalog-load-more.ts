/** Progressive enhancement: the link and numbered pagination also work without JavaScript. */
export function initializeCatalogLoadMore(): void {
  document.querySelectorAll<HTMLElement>('[data-catalog-root]').forEach((root) => {
    if (root.dataset.catalogInitialized) return;
    const items = root.querySelector<HTMLElement>('[data-catalog-items]');
    const more = root.querySelector<HTMLAnchorElement>('[data-catalog-load-more]');
    const count = root.querySelector<HTMLElement>('[data-catalog-count]');
    const status = root.querySelector<HTMLElement>('[data-catalog-status]');
    if (!items || !more || !count || !status) return;
    root.dataset.catalogInitialized = 'true';
    let loading = false;
    let loadedPage = Number(root.dataset.catalogPage);
    const firstItem = Number(root.dataset.catalogFrom);
    const totalItems = Number(root.dataset.catalogTotal);
    const originalLabel = more.innerHTML;

    more.addEventListener('click', async (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (loading) return;
      loading = true;
      more.setAttribute('aria-disabled', 'true');
      items.setAttribute('aria-busy', 'true');
      more.textContent = 'Загружаем…';
      status.textContent = '';
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const nextURL = new URL(more.href, window.location.href);
        if (nextURL.origin !== window.location.origin) throw new Error('Foreign catalogue URL');
        const response = await fetch(nextURL.href, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
          throw new Error('Catalogue page is unavailable');
        }
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const nextRoot = doc.querySelector<HTMLElement>('[data-catalog-root]');
        const nextItems = nextRoot?.querySelector<HTMLElement>('[data-catalog-items]');
        if (!nextRoot || !nextItems
          || nextRoot.dataset.catalogKey !== root.dataset.catalogKey
          || nextRoot.dataset.catalogVersion !== root.dataset.catalogVersion
          || Number(nextRoot.dataset.catalogPage) !== loadedPage + 1
          || Number(nextRoot.dataset.catalogTotal) !== totalItems) {
          throw new Error('Catalogue changed between requests');
        }
        const additions = Array.from(nextItems.children).filter((node): node is HTMLElement =>
          node instanceof HTMLElement && node.hasAttribute('data-catalog-item')
        );
        const existingIds = new Set(Array.from(items.querySelectorAll<HTMLElement>('[data-catalog-item]'))
          .map((item) => item.dataset.catalogItem));
        const newIds = new Set(additions.map((item) => item.dataset.catalogItem));
        if (!additions.length || additions.length > 10 || newIds.size !== additions.length
          || additions.some((item) => !item.dataset.catalogItem || existingIds.has(item.dataset.catalogItem))) {
          throw new Error('Invalid or repeated catalogue items');
        }
        const nextLink = nextRoot.querySelector<HTMLAnchorElement>('[data-catalog-load-more]');
        const subsequentURL = nextLink ? new URL(nextLink.getAttribute('href')!, nextURL) : null;
        if (subsequentURL && subsequentURL.origin !== window.location.origin) throw new Error('Foreign next page');
        items.append(...additions);
        loadedPage += 1;
        count.textContent = `Показано ${firstItem}–${nextRoot.dataset.catalogTo} из ${totalItems}`;
        if (subsequentURL) more.href = subsequentURL.href;
        else more.hidden = true;
        status.textContent = subsequentURL ? `Добавлено: ${additions.length}.` : 'Все оставшиеся объекты загружены.';
        // Keep the document URL, canonical and numbered navigation unchanged.
        // Keyboard users continue from the newly inserted objects, not past them.
        additions[0]?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
      } catch {
        status.textContent = 'Не удалось подгрузить список. Попробуйте еще раз или перейдите по номеру страницы.';
      } finally {
        window.clearTimeout(timeout);
        loading = false;
        more.removeAttribute('aria-disabled');
        items.removeAttribute('aria-busy');
        more.innerHTML = originalLabel;
      }
    });
  });
}

initializeCatalogLoadMore();
document.addEventListener('astro:page-load', initializeCatalogLoadMore);
