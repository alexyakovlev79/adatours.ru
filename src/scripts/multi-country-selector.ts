// The site is fully pre-rendered. This script only reveals selectors and
// navigates to a combination URL that exists in the build-time manifest.
interface CountryOption { slug: string; name: string; }

for (const picker of document.querySelectorAll<HTMLElement>('[data-multi-country-picker]')) {
  const countries = JSON.parse(picker.dataset.countries ?? '[]') as CountryOption[];
  const keys = JSON.parse(picker.dataset.combinations ?? '[]') as string[];
  const known = new Set(keys);
  const rootHref = picker.dataset.rootHref ?? '/multi-country/';
  const fields = [...picker.querySelectorAll<HTMLElement>('[data-mc-field]')];
  const selects = [...picker.querySelectorAll<HTMLSelectElement>('[data-mc-select]')];
  const storageKey = 'adatours:multi-country-first';
  const rootPath = new URL(rootHref, window.location.origin).pathname;
  const onRoot = window.location.pathname === rootPath;
  let selected = JSON.parse(picker.dataset.selected ?? '[]') as string[];

  if (onRoot && selected.length === 0) {
    try {
      const first = window.sessionStorage.getItem(storageKey);
      window.sessionStorage.removeItem(storageKey);
      if (first && countries.some((country) => country.slug === first)) selected = [first];
    } catch { /* Storage can be blocked; the selector still works. */ }
  }

  const available = (prefix: string[]): CountryOption[] => {
    if (prefix.length === 0) return countries;
    if (prefix.length >= 4) return [];
    const options = new Set<string>();
    for (const key of keys) {
      const parts = key.split('_');
      if (parts.length !== prefix.length + 1 || !prefix.every((slug) => parts.includes(slug))) continue;
      for (const slug of parts) if (!prefix.includes(slug)) options.add(slug);
    }
    return countries.filter((country) => options.has(country.slug));
  };

  const render = () => {
    for (let index = 0; index < selects.length; index++) {
      const options = index === 0 ? countries : selected[index - 1] ? available(selected.slice(0, index)) : [];
      const oldValue = selected[index] ?? '';
      const select = selects[index];
      select.replaceChildren(new Option('Выберите страну', ''));
      for (const country of options) select.add(new Option(country.name, country.slug));
      if (oldValue && options.some((country) => country.slug === oldValue)) {
        select.value = oldValue;
      } else {
        selected = selected.slice(0, index);
      }
      fields[index].hidden = index > 0 && options.length === 0;
    }
  };

  render();
  selects.forEach((select, index) => {
    select.addEventListener('change', () => {
      selected = [...selected.slice(0, index), ...(select.value ? [select.value] : [])];
      render();
      if (selected.length >= 2) {
        const key = [...selected].sort().join('_');
        if (known.has(key)) {
          const destination = rootHref + key + '/';
          if (window.location.pathname !== new URL(destination, window.location.origin).pathname) {
            window.location.assign(destination + '#country-picker');
          }
          return;
        }
      }
      if (!onRoot) {
        try {
          if (selected.length === 1) window.sessionStorage.setItem(storageKey, selected[0]);
          else window.sessionStorage.removeItem(storageKey);
        } catch { /* No persistent state required. */ }
        window.location.assign(rootHref + '#country-picker');
      }
    });
  });

  picker.querySelector<HTMLAnchorElement>('[data-mc-reset]')?.addEventListener('click', () => {
    try { window.sessionStorage.removeItem(storageKey); } catch { /* Ignore. */ }
  });
}
