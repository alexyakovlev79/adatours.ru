// Actual hrefs for every 2-4 country combination remain in the rendered header.
// JS changes the displayed level, without creating URL links dynamically.
const menuInstances = [...document.querySelectorAll<HTMLElement>('[data-mc-menu]')];
const linkSource = menuInstances.map((item) => item.querySelector<HTMLElement>('[data-mc-menu-combinations][data-mc-menu-source]'))
  .find((nav) => nav && nav.children.length > 0);
for (const menu of menuInstances) {
  const countries = [...menu.querySelectorAll<HTMLButtonElement>('[data-mc-menu-country]')];
  const names = new Map(countries.map((button) => [
    button.dataset.mcMenuCountry ?? '',
    button.querySelector('.mc-menu__country-name')?.textContent?.trim() ?? '',
  ]));
  const countryGrid = menu.querySelector<HTMLElement>('[data-mc-menu-countries]');
  const links = menu.querySelector<HTMLElement>('[data-mc-menu-combinations]');
  // Desktop borrows the exact same verified SSR anchors from the mobile menu.
  // The source HTML contains a single copy of every link on every page.
  if (links && links.children.length === 0 && linkSource) {
    for (const child of [...linkSource.children]) links.append(child.cloneNode(true));
  }
  const heading = menu.querySelector<HTMLElement>('[data-mc-menu-heading]');
  const back = menu.querySelector<HTMLButtonElement>('[data-mc-menu-back]');
  const combinations = [...menu.querySelectorAll<HTMLElement>('[data-mc-menu-combination]')]
    .map((element) => ({ element, slugs: (element.dataset.mcMenuSlugs ?? '').split('_') }));
  if (!countryGrid || !links || !heading || !back) continue;
  let selected: string[] = [];

  const display = () => {
    const level = selected.length;
    menu.dataset.mcReady = '';
    if (level) menu.dataset.mcSelected = selected.join('_');
    else delete menu.dataset.mcSelected;
    countryGrid.hidden = level > 0;
    links.hidden = level === 0;
    back.hidden = level === 0;
    heading.textContent = level === 0 ? 'Выберите страну'
      : level === 1 ? 'Добавить вторую страну к ' + (names.get(selected[0]) ?? selected[0])
      : level === 2 ? 'Добавить третью страну'
      : 'Добавить четвертую страну';
    for (const item of combinations) {
      item.element.hidden = item.slugs.length !== level + 1
        || !selected.every((slug) => item.slugs.includes(slug));
    }
    const scroller = menu.closest<HTMLElement>('.mobile-menu__panel, .desktop-nav__submenu');
    if (scroller) scroller.scrollTop = 0;
  };

  countries.forEach((button) => button.addEventListener('click', () => {
    const slug = button.dataset.mcMenuCountry;
    if (!slug) return;
    selected = [slug];
    display();
    back.focus();
  }));

  menu.querySelectorAll<HTMLButtonElement>('[data-mc-menu-expand]').forEach((button) => {
    button.addEventListener('click', () => {
      selected = (button.dataset.mcMenuExpand ?? '').split('_').filter(Boolean);
      display();
      back.focus();
    });
  });

  back.addEventListener('click', () => {
    selected = selected.slice(0, -1);
    display();
    if (selected.length) back.focus();
    else countryGrid.querySelector<HTMLButtonElement>('button')?.focus();
  });

  display();
}
