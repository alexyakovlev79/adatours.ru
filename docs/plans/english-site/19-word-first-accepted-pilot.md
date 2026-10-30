# ADA Tours EN — 18 блоков приняты в переводческом пилоте

Дата: 30.10.2026. Source of truth по публичным RU Tour и ценам: `main`. EN ветка: `feat/english-site-foundation`. Единственная рабочая очередь: `i18n/translation-staging` (сейчас закрыта).

## Результаты, действительно подтвержденные в GitHub

| Tour | Виден блоков в исходном RU | Привязано к Word/AI | Принято `ready` | Не сопоставлено | Осталось привязанных в `queued` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Rio de Janeiro, 4 дня | 52 | 10 | 10 | 42 | 0 |
| Easter Island, 3 дня | 58 | 8 | 8 | 50 | 0 |
| Colombia Essential, 5 дней | 62 | 12 | 0 | 50 | 12 |
| **Итого** | **172** | **30** | **18** | **142** | **12** |

Две работы `p1` Rio/Easter взяли восемь текстовых блоков каждая непосредственно из точного английского Word 2027 с SHA и OOXML paragraph refs. Третья `p2` Rio содержит 1 заголовок, верно переведенный с текущего RU (`Отъезд из Рио-де-Жанейро` → `Departure from Rio de Janeiro`), и 1 оригинальный Word-абзац Day4. Не выдумывали новую продолжительность, цену, гида, экскурсию или включение.

Конкретные подтверждения: [source review CI #41046016916](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41046016916), [staging review CI #41047125362](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41047125362), [mixed provenance unit CI #41047779504](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41047779504) — success. GitHub QA: [Rio p1](https://github.com/alexyakovlev79/adatours.ru/commit/3244519c393da94cd9719ee36a3fb466b8696751), [Easter p1](https://github.com/alexyakovlev79/adatours.ru/commit/c1cc96b78180694098edf787a93b5d18b2381447), [Rio p2](https://github.com/alexyakovlev79/adatours.ru/commit/42bdb79a803e5085c7cd05e77cfc23e26af289fc). Исполнитель и проверяющий — разные логические этапы с отдельными receipt; внешнего независимого редактора эти проверки не подразумевают.

Итог в `i18n/translation-staging`: [sealed `e8eb14f4`](https://github.com/alexyakovlev79/adatours.ru/commit/e8eb14f42a33a1f0a89931a49efc493498508e49). `ready=3,queued=2,review=0,leased=0`; `dispatcherEnabled=false`, `publicationEnabled=false`, `translationMassLaunchAllowed=false`. Ready относится к 18 блокам, а не к полной английской странице.

## Следующий проход

1. Разобрать Colombia `p1` и `p2`: 12 уже сопоставленных блоков, два AI gap заголовка, остальное Word. Сохранить полные source/citation receipts и пройти отдельную QA.
2. По файлу `data/i18n/translation/pilot-unmapped-20261030.json` сопоставить еще 142 видимых блока. Сначала Word 2027, AI — лишь реально отсутствующие фрагменты; использовать уникального владельца общих Excursion, коммерческие цены не менять без структурного ценового плана.
3. После **полного** text overlay связать locale adapter с реальными страницами Astro и выполнить точную RU/EN тестовую сборку. Раньше этого EN не публиковать.
