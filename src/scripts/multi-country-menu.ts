// The shared navigation fragment holds all canonical combination links once.
// The multi-country landing page exposes the same static links for crawlers.
import {
  extendMultiCountrySelection, previousMultiCountrySelection, formatMultiCountryNames,
} from '../lib/multi-country-combinations.mjs';
// Called by SiteHeader after the shared header has been inserted.
export function initializeMultiCountryMenus() {
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
  // The canonical SSR href already contains the country key. Do not serialize
  // it a second time on every catalogue link on every page of the website.
  const combinations = [...menu.querySelectorAll<HTMLElement>('.mcc')]
    .map((element) => ({ element, slugs: (element.querySelector('a')?.getAttribute('href') ?? '')
      .split('/').filter(Boolean).at(-1)?.split('_') ?? [] }));
  const availableKeys = new Set(combinations.map((item) => item.slugs.join('_')));
  if (!countryGrid || !links || !heading || !back) continue;
  // Keep each canonical anchor in SSR, but clone the shared scoped button
  // only in the browser instead of repeating its markup on every page.
  const expandTemplate = menu.querySelector<HTMLTemplateElement>('[data-mc-menu-expand-template]');
  for (const { element, slugs } of combinations) {
    if (slugs.length >= 4 || element.querySelector('[data-mc-menu-expand]')
      || ![...names.keys()].some((slug) => !slugs.includes(slug)
        && availableKeys.has([...slugs, slug].sort().join('_')))) continue;
    const expand = expandTemplate?.content.querySelector('button')?.cloneNode(true) as HTMLButtonElement | undefined;
    if (!expand) continue;
    expand.dataset.mcMenuExpand = slugs.join('_');
    expand.setAttribute('aria-label', 'Добавить страну к сочетанию ' + (element.querySelector('a')?.textContent?.trim() ?? ''));
    element.append(expand);
  }
  let selected: string[] = [];

  // Align the dropdown with the first primary navigation label ("Страны"),
  // not with the third label ("Multi-country"). The gap adapts to font/viewport.
  const desktopGroup = menu.closest<HTMLElement>('.desktop-nav__group');
  const desktopPopup = desktopGroup?.querySelector<HTMLElement>('.desktop-nav__submenu--multi-country');
  const desktopTrigger = desktopGroup?.querySelector<HTMLElement>('.desktop-nav__parent');
  const desktopNav = desktopGroup?.closest<HTMLElement>('.desktop-nav');
  const firstNavChild = desktopNav?.firstElementChild;
  const firstNavLink = firstNavChild instanceof HTMLAnchorElement
    ? firstNavChild : firstNavChild?.querySelector<HTMLAnchorElement>('a');
  const alignDesktopPopup = () => {
    if (!desktopGroup || !firstNavLink) return;
    const offset = firstNavLink.getBoundingClientRect().left - desktopGroup.getBoundingClientRect().left;
    desktopGroup.style.setProperty('--mc-dropdown-offset', `${Math.round(offset)}px`);
  };
  if (desktopPopup) {
    alignDesktopPopup();
    desktopGroup?.addEventListener('pointerenter', alignDesktopPopup);
    window.addEventListener('resize', alignDesktopPopup, { passive: true });
    document.fonts?.ready.then(alignDesktopPopup);
  }

  const withinRect = (rect: DOMRect, x: number, y: number) =>
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  let pointerBridge: { rect: DOMRect; lastX: number; startedAt: number } | null = null;
  const preserveDesktopPopup = (event: MouseEvent) => {
    if (!desktopGroup || !desktopPopup || event.detail === 0) return;
    // Capture the old (possibly wider) panel before hiding the clicked row.
    pointerBridge = { rect: desktopPopup.getBoundingClientRect(),
      lastX: event.clientX, startedAt: performance.now() };
    desktopGroup.dataset.mcInteracting = '';
  };
  const closeDesktopPopup = () => {
    if (!desktopGroup) return;
    pointerBridge = null;
    delete desktopGroup.dataset.mcInteracting;
    const active = document.activeElement;
    if (active instanceof HTMLElement && desktopGroup.contains(active)) active.blur();
    if (selected.length) {
      selected = [];
      display();
    }
  };

  const focusBack = (keyboardActivation = false) => {
    const mobileBack = menu.closest<HTMLElement>('[data-mobile-panel]')
      ?.querySelector<HTMLButtonElement>('[data-submenu-back]');
    // Mouse clicks must not pin the desktop dropdown open via focused Back.
    if (mobileBack) mobileBack.focus();
    else if (keyboardActivation) back.focus();
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

  countries.forEach((button) => button.addEventListener('click', (event) => {
    const slug = button.dataset.mcMenuCountry;
    if (!slug) return;
    const keyboardActivation = button.matches(':focus-visible');
    preserveDesktopPopup(event);
    selected = [slug];
    display();
    focusBack(keyboardActivation);
  }));

  menu.querySelectorAll<HTMLButtonElement>('[data-mc-menu-expand]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = (button.dataset.mcMenuExpand ?? '').split('_').filter(Boolean);
      if (target.length !== selected.length + 1
        || !selected.every((slug) => target.includes(slug))) return;
      // The URL slugs are alphabetical, but Back must preserve the visitor's
      // actual navigation path (e.g. Brazil -> Argentina -> Chile).
      const keyboardActivation = button.matches(':focus-visible');
      preserveDesktopPopup(event);
      selected = extendMultiCountrySelection(selected, target);
      display();
      focusBack(keyboardActivation);
    });
  });

  back.addEventListener('click', (event) => {
    const keyboardActivation = back.matches(':focus-visible');
    preserveDesktopPopup(event);
    selected = previousMultiCountrySelection(selected);
    display();
    if (selected.length) focusBack(keyboardActivation);
    else if (menu.closest('[data-mobile-panel]') || keyboardActivation) {
      countryGrid.querySelector<HTMLButtonElement>('button')?.focus();
    }
  });

  // Layout changes generate pointerleave even when the actual mouse has not
  // moved: resetting there made first-level clicks look completely inert.
  // Close only for a real pointer move/click outside. From a right-column
  // country, preserve a short path across the old panel toward the narrower
  // next level, then require the pointer to stay within the visible popup.
  if (desktopGroup && desktopPopup) {
    document.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || !desktopGroup.hasAttribute('data-mc-interacting')) return;
      const insidePopup = withinRect(desktopPopup.getBoundingClientRect(), event.clientX, event.clientY);
      const insideTrigger = desktopTrigger
        ? withinRect(desktopTrigger.getBoundingClientRect(), event.clientX, event.clientY) : false;
      if (insidePopup || insideTrigger) {
        pointerBridge = null;
        return;
      }
      if (pointerBridge && performance.now() - pointerBridge.startedAt < 1400
        && withinRect(pointerBridge.rect, event.clientX, event.clientY)
        && event.clientX <= pointerBridge.lastX + 10) {
        pointerBridge.lastX = event.clientX;
        return;
      }
      closeDesktopPopup();
    }, { passive: true });
    document.addEventListener('pointerdown', (event) => {
      if (desktopGroup.hasAttribute('data-mc-interacting') && !desktopGroup.contains(event.target as Node)) {
        closeDesktopPopup();
      }
    });
    // Keyboard Escape resets the nested level while preserving the primary
    // navigation link for subsequent keyboard interaction.
    desktopGroup.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeDesktopPopup();
      desktopTrigger?.focus();
    });
  }

  display();
}
}
