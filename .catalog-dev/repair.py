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
p=Path('scripts/persist-multi-country-registries.mjs');s=p.read_text()
s=s.replace('json: JSON.parse(text)', "json: path.endsWith('.json') ? JSON.parse(text) : null")
s=s.replace('tours|countries|themes)', 'tours|countries|themes|destinations|excursions)')
s=s.replace("'data/external-identity/multi-country-catalogues.json']", "'data/external-identity/multi-country-catalogues.json', 'docs/catalogues/multi-country.md']")
p.write_text(s)
p=Path('docs/workflows/multi-country-interests.md');p.write_text(p.read_text()+"\n## Размер публикации\n\nВсе обычные сочетания остаются настоящими SSR-ссылками в каждой шапке. Меню не повторяет ключ страны из href в data-атрибутах; клиент берет его из того же канонического адреса и вычисляет возможность расширения по полному набору ссылок. CSS меню ограничен уникальными mc-menu-классами без повторяемых scoped-атрибутов на сотнях строк. Лимит размера Pages не повышается и проверка сохраняется.\n\n## Регулярная синхронизация внешней таблицы\n\nПосле каждой сборки сайт и машиночитаемые CSV обновляются вместе. Лист «Multi-country + интересы» получает опубликованный CSV через IMPORTDATA. Задача «Каталоги Ada Tours» проверяет изменения каждый час и синхронизирует редактируемые листы «Страницы» и «SEO-GEO тексты» по stable ID и canonical URL, сохраняя человеческие поля, даты, статьи и статусы. До подтвержденного production deploy новые строки не считаются опубликованными.\n\nТекущий опубликованный fingerprint находится в I2 листа «Multi-country + интересы», последний полностью синхронизированный — в K2, дата синхронизации — в K4. Значение pending-initial-publication запрещает фоновое обновление до завершения первого релиза. Совпадение отпечатков завершает проверку без чтения всех реестров. При расхождении сначала проверяется опубликованная версия; K2 обновляется только после завершения всех записей. Скрытый лист «_MC import» служит промежуточным импортом CSV, а не заменой редактируемых листов. Сортируется полная строка A:M по опубликованному порядку; новые пересечения следуют после обычных multi-country. Успешные проверки проходят без уведомлений; технический сбой отражается отдельно.\n")
