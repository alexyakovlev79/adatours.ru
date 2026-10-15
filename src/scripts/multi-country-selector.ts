// Progressive country selection. Static URLs are opened after 2–4 choices.
interface CountryOption { slug: string; name: string; }

for (const picker of document.querySelectorAll<HTMLElement>('[data-multi-country-picker]')) {
  const countries = JSON.parse(picker.dataset.countries ?? '[]') as CountryOption[];
  const known = new Set(JSON.parse(picker.dataset.combinations ?? '[]') as string[]);
  const rootHref = picker.dataset.rootHref ?? '/multi-country/';
  const fields = [...picker.querySelectorAll<HTMLElement>('[data-mc-field]')];
  const selects = [...picker.querySelectorAll<HTMLSelectElement>('[data-mc-select]')];
  let selected = JSON.parse(picker.dataset.selected ?? '[]') as string[];

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
    for (let index = 0; index < selects.length; index++) {
      const options = index === 0
        ? countries
        : selected[index - 1] ? compatible(selected.slice(0, index)) : [];
      const select = selects[index];
      const value = selected[index] ?? '';
      select.replaceChildren(new Option('Выберите страну', ''));
      for (const country of options) select.add(new Option(country.name, country.slug));
      if (value && options.some((country) => country.slug === value)) {
        select.value = value;
      } else if (value) {
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
      if (selected.length < 2) return;
      const key = [...selected].sort().join('_');
      if (known.has(key)) {
        const target = new URL(rootHref + key + '/#country-picker', window.location.origin);
        if (window.location.pathname !== target.pathname) window.location.assign(target.toString());
      }
    });
  });
}
