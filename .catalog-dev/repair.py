from pathlib import Path
p=Path('src/components/global/MultiCountryMenu.astro');s=p.read_text()
for old in ["        data-mc-menu-combination\n", "        data-mc-menu-slugs={row.slugs.join('_')}\n", "        data-mc-menu-more={row.hasMore ? '' : undefined}\n"]:
 assert old in s,old
 s=s.replace(old,'')
assert '<style>' in s
s=s.replace('<style>','<style is:global>')
p.write_text(s)
p=Path('src/scripts/multi-country-menu.ts');s=p.read_text()
old="""  const combinations = [...menu.querySelectorAll<HTMLElement>('[data-mc-menu-combination]')]
    .map((element) => ({ element, slugs: (element.dataset.mcMenuSlugs ?? '').split('_') }));"""
new="""  // The canonical SSR href already contains the country key. Do not serialize
  // it a second time on every catalogue link on every page of the website.
  const combinations = [...menu.querySelectorAll<HTMLElement>('.mc-menu__combination')]
    .map((element) => ({ element, slugs: (element.querySelector('a')?.getAttribute('href') ?? '')
      .split('/').filter(Boolean).at(-1)?.split('_') ?? [] }));
  const availableKeys = new Set(combinations.map((item) => item.slugs.join('_')));"""
assert old in s;s=s.replace(old,new)
old="    if (!element.hasAttribute('data-mc-menu-more') || element.querySelector('[data-mc-menu-expand]')) continue;"
new="""    if (slugs.length >= 4 || element.querySelector('[data-mc-menu-expand]')
      || ![...names.keys()].some((slug) => !slugs.includes(slug)
        && availableKeys.has([...slugs, slug].sort().join('_')))) continue;"""
assert old in s;s=s.replace(old,new);p.write_text(s)
p=Path('docs/workflows/multi-country-interests.md');p.write_text(p.read_text()+"\n## Размер публикации\n\nВсе обычные сочетания остаются настоящими SSR-ссылками в каждой шапке. Меню не повторяет ключ страны из href в data-атрибутах; клиент берет его из того же канонического адреса и вычисляет возможность расширения по полному набору ссылок. CSS меню ограничен уникальными mc-menu-классами без повторяемых scoped-атрибутов на сотнях строк. Лимит размера Pages не повышается и проверка сохраняется.\n")
