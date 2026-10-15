// Actual hrefs for every 2-4 country combination remain in the rendered header.
// JS changes the displayed level, without creating URL links dynamically.
import {
  extendMultiCountrySelection, previousMultiCountrySelection, formatMultiCountryNames,
} from '../lib/multi-country-combinations.mjs';
const menuInstances = [...document.querySelectorAll<HTMLElement>('[data-mc-menu]')];
const linkSource = menuInstances.map((item) => item.querySelector<HTMLElement>('[data-mc-menu-combinations][data-mc-menu-source]'))
  .find((nav) => nav && nav.children.length > 0);
for (const menu of menuInstances) {
  const countries = [...menu.querySelectorAll<HTMLButtonElement>('[data-mc-menu-country]')];
  const names = new Map(countries.map((button) => [
    button.dataset.mcMenuCountry ?? '',
    button.dataset.mcMenuCountryName ?? '',
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
  const focusBack = () => {
    const mobileBack = menu.closest<HTMLElement>('[data-mobile-panel]')
      ?.querySelector<HTMLButtonElement>('[data-submenu-back]');
    (mobileBack ?? back).focus();
  };

  const display = () => {
    const level = selected.length;
    menu.dataset.mcReady = '';
    if (level) menu.dataset.mcSelected = selected.join('_');
    else delete menu.dataset.mcSelected;
    countryGrid.hidden = level > 0;
    links.hidden = level === 0;
    back.hidden = level === 0;
    heading.hidden = level === 0;
    heading.textContent = level === 1 ? 'Добавить вторую страну к ' + (names.get(selected[0]) ?? selected[0])
      : level === 2 ? 'Добавить третью страну'
      : level === 3 ? 'Добавить четвертую страну' : '';
    for (const item of combinations) {
      const visible = item.slugs.length === level + 1
        && selected.every((slug) => item.slugs.includes(slug));
      item.element.hidden = !visible;
      if (!visible) continue;
      // Labels follow the customer's selection, whereas each href keeps the
      // same alphabetic canonical slugs for search engines and bookmarks.
      const ordered = [...selected, ...item.slugs.filter((slug) => !selected.includes(slug))];
      const label = formatMultiCountryNames(ordered.map((slug) => names.get(slug) ?? slug));
      const anchor = item.element.querySelector('a');
      if (anchor) anchor.textContent = label;
      const expand = item.element.querySelector<HTMLButtonElement>('[data-mc-menu-expand]');
      if (expand) expand.setAttribute('aria-label', 'Добавить страну к сочетанию ' + label);
    }
    const scroller = menu.closest<HTMLElement>('.mobile-menu__panel, .desktop-nav__submenu');
    if (scroller) scroller.scrollTop = 0;
  };

  countries.forEach((button) => button.addEventListener('click', () => {
    const slug = button.dataset.mcMenuCountry;
    if (!slug) return;
    selected = [slug];
    display();
    focusBack();
  }));

  menu.querySelectorAll<HTMLButtonElement>('[data-mc-menu-expand]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = (button.dataset.mcMenuExpand ?? '').split('_').filter(Boolean);
      if (target.length !== selected.length + 1
        || !selected.every((slug) => target.includes(slug))) return;
      // The URL slugs are alphabetical, but Back must preserve the visitor's
      // actual navigation path (e.g. Brazil -> Argentina -> Chile).
      selected = extendMultiCountrySelection(selected, target);
      display();
      focusBack();
    });
  });

  back.addEventListener('click', () => {
    selected = previousMultiCountrySelection(selected);
    display();
    if (selected.length) focusBack();
    else countryGrid.querySelector<HTMLButtonElement>('button')?.focus();
  });

  display();
}
