// Progressive selection of 2–4 main countries.
// Every completed selection resolves to an already generated static catalogue.
import { removeMultiCountrySelection } from '../lib/multi-country-combinations.mjs';

interface CountryOption { slug: string; name: string; }

for (const picker of document.querySelectorAll<HTMLElement>('[data-multi-country-picker]')) {
  const countries = JSON.parse(picker.dataset.countries ?? '[]') as CountryOption[];
  const known = new Set(JSON.parse(picker.dataset.combinations ?? '[]') as string[]);
  const rootHref = picker.dataset.rootHref ?? '/multi-country/';
  const theme = picker.dataset.theme ?? '';
  const currentRootHref = picker.dataset.currentRootHref ?? rootHref;
  const rootPath = new URL(currentRootHref, window.location.origin).pathname;
  const interestOptions = JSON.parse(picker.dataset.interestOptions ?? '[]') as Array<{ id: string; countries: string[] }>;
  const interestMenu = picker.querySelector<HTMLElement>('[data-filter-context="multi-country"]');
  const fields = [...picker.querySelectorAll<HTMLElement>('[data-mc-field]')];
  const selects = [...picker.querySelectorAll<HTMLSelectElement>('[data-mc-select]')];
  const removeButtons = [...picker.querySelectorAll<HTMLButtonElement>('[data-mc-remove]')];
  const placeholders = ['Первая страна', 'Вторая страна', 'Третья страна', 'Четвертая страна'];
  const firstCountryState = 'adatours:multi-country-first';
  const pickerScrollState = 'adatours:multi-country-return-to-picker';
  let selected = JSON.parse(picker.dataset.selected ?? '[]') as string[];

  // Old hash URLs are normalized without reloading; future navigation never
  // adds a #country-picker fragment. Remember the selector position instead.
  if (window.location.hash === '#country-picker') {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  try {
    if (window.sessionStorage.getItem(pickerScrollState) === '1') {
      window.sessionStorage.removeItem(pickerScrollState);
      window.requestAnimationFrame(() => {
        // Align the beginning of the results section just below the sticky
        // header, so the combination title and tour count remain visible.
        const section = picker.closest<HTMLElement>('.combination-tours, .multi-tours') ?? picker;
        const headerHeight = document.querySelector<HTMLElement>('[data-site-header]')
          ?.getBoundingClientRect().height ?? 0;
        const top = window.scrollY + section.getBoundingClientRect().top - headerHeight;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      });
    }
  } catch { /* Navigation also works when storage is unavailable. */ }

  const navigateKeepingPicker = (target: URL) => {
    try { window.sessionStorage.setItem(pickerScrollState, '1'); } catch { /* Optional. */ }
    window.location.assign(target.toString());
  };

  // The initial /multi-country/ has no country-specific static catalogue.
  // Preserve the first selection for one navigation when removing the second.
  if (window.location.pathname === rootPath && selected.length === 0) {
    try {
      const first = window.sessionStorage.getItem(firstCountryState);
      window.sessionStorage.removeItem(firstCountryState);
      if (first && countries.some((country) => country.slug === first)) selected = [first];
    } catch { /* Storage may be disabled; all selectors remain functional. */ }
  }

  const compatible = (slugs: string[]): CountryOption[] => {
    if (!slugs.length) return countries;
    if (slugs.length >= 4) return [];
    const extras = new Set<string>();
    for (const key of known) {
      const parts = key.split('_');
      if (parts.length !== slugs.length + 1 || !slugs.every((slug) => parts.includes(slug))) continue;
      for (const slug of parts) if (!slugs.includes(slug)) extras.add(slug);
    }
    return countries.filter((country) => extras.has(country.slug));
  };

  const render = () => {
    // Before a pair has been completed, show only interests that can include
    // the first country. Counts continue to describe each destination catalogue.
    interestMenu?.querySelectorAll<HTMLElement>('[data-filter-option]').forEach((item) => {
      const option = interestOptions.find((row) => row.id === item.dataset.filterOption);
      item.hidden = selected.length === 1 && !option?.countries.includes(selected[0]);
    });
    const reset = picker.querySelector<HTMLElement>('[data-mc-reset]');
    if (reset) reset.hidden = !selected.length && !theme;
    for (let index = 0; index < selects.length; index++) {
      const options = index === 0
        ? countries
        : selected[index - 1] ? compatible(selected.slice(0, index)) : [];
      const select = selects[index];
      const value = selected[index] ?? '';
      // Native popup option colors are not reliable (notably in Firefox).
      // Disabled placeholder renders muted; × and Reset retain clearing.
      const placeholderOption = new Option(placeholders[index], '', !value, !value);
      placeholderOption.disabled = true;
      select.replaceChildren(placeholderOption);
      for (const country of options) select.add(new Option(country.name, country.slug));
      if (value && options.some((country) => country.slug === value)) {
        select.value = value;
      } else if (value) {
        selected = selected.slice(0, index);
      }
      select.classList.toggle('mc-picker__select--placeholder', !select.value);
      fields[index].hidden = index > 0 && options.length === 0;
    }
    for (const button of removeButtons) {
      const index = Number(button.dataset.mcRemove);
      button.hidden = !selected[index];
    }
  };

  const navigate = (next: string[]): boolean => {
    if (next.length >= 2) {
      const key = [...next].sort().join('_');
      if (!known.has(key)) return false;
      const target = new URL(rootHref + key + '/' + (theme ? 'interests/' + theme + '/' : ''), window.location.origin);
      if (window.location.pathname !== target.pathname) navigateKeepingPicker(target);
      else {
        selected = next;
        render();
      }
      return true;
    }

    try {
      if (next.length === 1) window.sessionStorage.setItem(firstCountryState, next[0]);
      else window.sessionStorage.removeItem(firstCountryState);
    } catch { /* Storage may be disabled. */ }
    if (window.location.pathname !== rootPath) {
      navigateKeepingPicker(new URL(currentRootHref, window.location.origin));
    } else {
      selected = next;
      render();
    }
    return true;
  };

  render();

  selects.forEach((select, index) => {
    select.addEventListener('change', () => {
      if (index > 0 && !select.value && selected[index]) {
        // Clearing via the placeholder is equivalent to the × control.
        navigate(removeMultiCountrySelection(selected, index));
        return;
      }
      const next = [...selected.slice(0, index), ...(select.value ? [select.value] : [])];
      if (next.length >= 2 && navigate(next)) return;
      // A one-country selection has no canonical page; on another catalogue
      // return to the general hub without losing that first choice.
      if (next.length < 2 && window.location.pathname !== rootPath) {
        navigate(next);
        return;
      }
      selected = next;
      render();
    });
  });

  removeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.mcRemove);
      if (!selected[index]) return;
      navigate(removeMultiCountrySelection(selected, index));
    });
  });

  interestMenu?.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || event instanceof MouseEvent && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    try {
      if (selected.length === 1) window.sessionStorage.setItem(firstCountryState, selected[0]);
      window.sessionStorage.setItem(pickerScrollState, '1');
    } catch { /* Ordinary links work without storage or JavaScript. */ }
  });

  picker.querySelector<HTMLAnchorElement>('[data-mc-reset]')?.addEventListener('click', () => {
    try { window.sessionStorage.removeItem(firstCountryState); } catch { /* Ignore. */ }
  });
}
