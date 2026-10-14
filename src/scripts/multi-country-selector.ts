// Country combinations are real static HTML pages; change events only navigate
// between links already published by the Astro build.
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
        ? (selected[1] ? compatible([selected[1]]) : countries)
        : index === 1
          ? (selected[0] ? compatible([selected[0]]) : countries)
          : selected.length >= index && selected[index - 1]
            ? compatible(selected.slice(0, index))
            : [];
      const select = selects[index];
      select.replaceChildren(new Option('Выберите страну', ''));
      for (const country of options) select.add(new Option(country.name, country.slug));
      const value = selected[index] ?? '';
      if (value && options.some((country) => country.slug === value)) {
        select.value = value;
      } else if (value) {
        selected = selected.slice(0, index);
      }
      fields[index].hidden = index >= 2 && options.length === 0;
    }
  };

  render();

  const navigate = (slugs: string[]) => {
    if (slugs.length < 2) return false;
    const key = [...slugs].sort().join('_');
    if (!known.has(key)) return false;
    const target = new URL(rootHref + key + '/#country-picker', window.location.origin);
    if (window.location.pathname !== target.pathname) window.location.assign(target.toString());
    return true;
  };

  selects.forEach((select, index) => {
    select.addEventListener('change', () => {
      if (index <= 1) {
        const first = selects[0].value;
        const second = selects[1].value;
        selected = [first, second];
        if (first && second && first !== second && navigate([first, second])) return;
        render();
        if (picker.dataset.selected !== '[]') {
          const target = new URL(rootHref + '#country-picker', window.location.origin);
          if (window.location.pathname !== target.pathname) window.location.assign(target.toString());
        }
        return;
      }
      selected = [...selects.slice(0, index + 1).map((input) => input.value)].filter(Boolean);
      if (navigate(selected)) return;
      selected = selected.slice(0, Math.max(2, index));
      render();
    });
  });
}
