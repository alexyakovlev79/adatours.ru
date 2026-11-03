# English site: текущее состояние и архитектура

## Текущее состояние — опубликовано и проверено 03.11.2026

**Рабочий вход: [workflow v1.8](../../workflows/english-site.md) и
[подтверждения в плане 35](35-shared-approved-content.md).**
Итоговый код исправления объединён через
[PR #80](https://github.com/alexyakovlev79/adatours.ru/pull/80) в
[`3af8c2e314940dbe5d5b23086ca1b51776e2dd34`](https://github.com/alexyakovlev79/adatours.ru/commit/3af8c2e314940dbe5d5b23086ca1b51776e2dd34).
[RU CI #41597793856](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41597793856)
и [EN preflight #41597793948](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41597793948)
завершились **success**.
[EN Pages #41599028191](https://github.com/alexyakovlev79/adatours-en/actions/runs/41599028191)
успешно опубликован в 10:57:52 МСК; caller
`509bd465f0fc6f7a6f34781606d24d4d7821ab62`.
**Живой receipt и итоговые страницы проверены в браузере. Задача завершена.**
[Открыть EN-каталог](https://alexyakovlev79.github.io/adatours-en/en/tours/).

Английская версия использует полный общий сайт: готовые EN-поля имеют
приоритет, отсутствующие переводы сохраняют RU. Один `adatours.ru/main`
владеет исходниками, ценами, медиа и связями; `adatours-en` — только caller.
Полный verifier подтвердил 6 149 страниц, 21 сущность / 547 полей,
404 906 ссылок, 1 752 MC card pages, 159 VIP card pages, три подписи туров
на главной и 20 017 related labels; опубликованный receipt совпал.
Каталог содержит все 353 активных Tour. На исходном `/en/tours/` проверены
английские H1, девять пунктов меню, Hero/фильтры и загрузка обложки с CDN.
Карточки комбинаций стран, интересов, VIP и главной используют готовые
английские названия; непереведённые слова, например «Аргентина», остаются RU.

Подготовка роя сохранена: matching 358/358 завершён, новая очередь —
353 Tour / 4 006 пакетов, Word 2027 открыт, `publicationEnabled=false`.
HEAD `i18n/translation-mass-staging` повторно проверен: неизменный
`691306df7cdae1e1cb899cbac2bfc4dcbe781230`; рой не запускался заново.
Read-only snapshot Rio b001 добавляет 8 принятых блоков / 4 уточнения;
30 прежних блоков исключены из повторной работы.

Следующая возможная работа — продолжение прежней очереди перевода
**только по отдельному заданию пользователя**. Не запускать рой автоматически,
не пересоздавать очередь/matching, не повторять завершённый аудит и публикации.
Разделы ниже — история; промежуточные находки PR #78/#79 закрыты PR #80
и не являются новыми заданиями.

## История исправления 03.11.2026 — PR #78 и PR #79

Исходники обеих версий уже находятся в `adatours.ru/main`;
`adatours-en` — только публикация. Исправление подключения готовых
английских полей к полным общим шаблонам объединено через
[PR #78](https://github.com/alexyakovlev79/adatours.ru/pull/78),
коммит `3125e0db702c1c0bc21ee8f1f1a281eb46f991c3`.
Непереведённые поля сохраняют RU fallback; каталог остаётся полным.

Matching 358/358 завершён. Массовая очередь перевода также создана:
353 актуальных Tour / 4 006 пакетов; Word 2027 открыт,
`publicationEnabled=false`, 1 новый пакет принят, 30 старых блоков
переиспользованы. Точные SHA, counts, пять отложенных источников и
immutable receipt приведены в плане 35. Не пересоздавать очередь,
не повторять matching и не приравнивать готовность пакета к его публикации.

[RU CI #41591749440](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41591749440)
и [EN preflight #41591749489](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41591749489)
успешны для head `fbaf184aafabe5494c2eb2eca5ac28f5eaad3b92`.
Отчёт сборки: 547 готовых полей в 21 сущности, partial/stale/invalid = 0;
6 149 канонических страниц и 404 906 проверенных внутренних ссылок.
Массовый Rio b001 подключён только для чтения: 8 блоков, 4 уточнённых текста.
HEAD массовой очереди повторно проверен и не изменился.

[EN Pages #41592607214](https://github.com/alexyakovlev79/adatours-en/actions/runs/41592607214)
для caller `cc4a4c98964988c165572a96276298fc0720acfb` завершился **success**.
Live receipt подтвердил source `3125e0db…` и те же counts. Браузерная
проверка подтвердила английские каталог/меню, полный набор 353 Tour,
фильтрацию Brazil (146), дозагрузку 30 → 60, поиск Rio и программу,
Easter Island, русский Guatemala fallback и Multi-country селекторы.

### Адресное продолжение — PR #79

[PR #79](https://github.com/alexyakovlev79/adatours.ru/pull/79), head
`4204711fec1392f2d7fc50e4a59d930a62648194`, устраняет найденные в браузере
русские составные подписи стран в карточках: вместо `mainTourCountries`
из route index используются display names общей countries-коллекции по
stable ID на Multi-country, последующих страницах, VIP и местах. Связанные
интересы используют `ui-copy`/`countInEnglish`; неизвестные переводы
сохраняют RU. Общие источники, цены, IDs, порядок и медиа не меняются.
Output verifier дополнен проверкой metadata landing/page 2 и related
interest labels; соответствующие пути включены в EN CI.

[RU CI #41594489146](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41594489146)
и [EN preflight #41594489226](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41594489226)
завершились **success**. PR #79 объединён в
`08c51a27a807e9f9e2473d088c8655142f7d998a`. Дополнительно проверены две
Multi-country страницы карточек и 20 017 подписей связанных каталогов;
основные counts сохранились, artifact `13211509045`.

[EN Pages #41595744614](https://github.com/alexyakovlev79/adatours-en/actions/runs/41595744614)
для caller `4dd24b16b3b55cfb23bab2b9ed60c25f11c38f87` завершился **success**,
source `08c51a27…`. Live receipt подтвердил основные counts, две MC card
pages и 20 017 related labels. Браузерная проверка обнаружила отдельный
catch-all, всё ещё формировавший русские подписи карточек комбинаций.

## Историческое основание проекта

Поручение от 28.10.2026. Один source repository, общие факты/код/медиа, отдельные
RU/EN тексты. Английский домен по умолчанию — `adatours.com`, заменяемый настройкой.
Историческая ветка основания — `feat/english-site-foundation`; исходный SHA —
`b1b14ed3a8abab9773053f836fed28c2ff77204f`.

## Приоритетное уточнение от 29.10.2026

**Перед остальными документами прочитать [действующий workflow](../../workflows/english-site.md), разделы 1–3.**
Алексей отменил обязательный ручной review отличий выбранного английского Word
от старого русского текста: язык гида, названия мест и содержание EN брать из Word.
При уверенном совпадении тура новая цена в Word 2027 обновляет общую цену RU/EN;
разница со старым сайтом не создает отдельный продукт или коммерческий вариант.
Исторические замечания о конфликтах в аудитах сохраняются как наблюдения, но не
блокируют перенос вопреки этому решению. Уточнение закреплено в документации;
его фиксация не означает уже выполненную замену production-цен.

## Историческое состояние первоначального основания

**Подготовка завершена; новый EN-сайт и автоматический перевод еще не запущены.**
Есть архитектура, инструкции, полная наблюдаемая опись Drive, предварительный
реестр всех туров, восемь проверенных идентичностей, английские UI/SEO-заготовки,
изолированные библиотеки и 35 пройденных тестов первоначального основания.
Полных переводов Tour — 0; matching/block maps и runtime-интеграция остаются
следующими этапами. Правка правил от 29.10.2026 — документационная, не новый
отчет о запуске тестов, переводе или публикации.

## Документы

| Файл | Содержание |
| --- | --- |
| [Действующий workflow](../../workflows/english-site.md) | Готовые EN-поля в общих полных шаблонах, RU fallback, приоритет Word и общие цены |
| [35-shared-approved-content.md](35-shared-approved-content.md) | Текущее исправление EN-выкладки и сохранённый handoff роя перевода |
| [00-progress.md](00-progress.md) | Контрольные точки и восстановление работы |
| [01-architecture.md](01-architecture.md) | Общие данные, два языка, изменения в обе стороны, домены, hosting, releases; приоритет источников уточнен workflow |
| [02-word-sources-and-matching.md](02-word-sources-and-matching.md) | Drive inventory, восемь пар и исторические наблюдения о расхождениях |
| [03-translation-editorial.md](03-translation-editorial.md) | Сохранение Word, AI gaps, человеческий текст и voice Ada Tours; review-правила уточнены workflow |
| [04-swarm-runbook.md](04-swarm-runbook.md) | Этапы 2027/2026/AI, роли, очереди, claims, recovery; применять с актуальным workflow |
| [05-seo-schema-audit.md](05-seo-schema-audit.md) | Фактические title/H1/description/JSON-LD и список файлов для локализации |
| [06-rollout-plan.md](06-rollout-plan.md) | Пошаговое внедрение и критерии завершения этапов |
| [07-implemented-core.md](07-implemented-core.md) | Уже реализованный строгий text overlay и границы API |
| [08-ui-copy.md](08-ui-copy.md) | Полная таблица 218 коротких RU/EN строк |
| [09-foundation-review.md](09-foundation-review.md) | Независимая проверка первоначального основания и устраненные дефекты |
| [10-report.md](10-report.md) | Исторический итоговый отчет 28.10.2026, читается с уточнением 29.10.2026 |

## Данные и код

- `data/i18n/programme-sources.json` — 732 кандидатных документа двух годов,
  источники/версии и агрегаты исключений; не 732 уникальных продукта.
- `data/i18n/tour-word-matches.json` — 392 Tour, включая 34 архивных; кандидаты
  и восемь identity-confirmed пар, без разрешения на публикацию.
- `data/i18n/word-pilot-review.json` — предметные доказательства, hashes и
  исторические расхождения; интерпретировать по актуальному workflow.
- `data/i18n/en-metadata-template-spec.json` — 89 записей шаблонов/правил и
  16 пунктов оставшейся интеграции с точными source hashes.
- `data/i18n/source-integrity-report.json`, `foundation-validation.json` —
  результаты проверок; `foundation-status.json` — статический snapshot готовности.
- `src/data/i18n/sites.json` — конфигурация доменов/языков, EN `planned`.
- `src/data/i18n/ui-copy.json`, `interest-copy.en.json` — 218 UI строк и 15
  наборов индивидуальных текстов/словоформ интересов.
- `src/lib/i18n/locale-site.mjs`, `messages.mjs`, `content-overlay.mjs` —
  протестированное изолированное ядро; пока не подключено к Astro.
- `scripts/i18n/` — read-only status, DOCX extractor, candidate builder.
- `data/i18n/schema/` — JSON schemas source snapshot/overlay.

## Действующие команды подготовки

```bash
npm run i18n:status
npm run test:i18n
python3 scripts/i18n/build-candidate-matches.py --repo . \
  --sources data/i18n/programme-sources.json \
  --pilot data/i18n/word-pilot-review.json \
  --output /tmp/ada-en-candidates.json
```

Status — O(1) чтение статического snapshot, **не работающая очередь**. Python
candidate builder требует PyYAML и точный baseline commit в Git; он не читает
Drive, не переводит и не назначает AI-only. `npm run test:i18n` запускает только
проверки нового основания; полный Astro build не входит в эту команду.

## Исторический следующий шаг первоначального основания

Продолжить смысловое сопоставление оставшихся Tour и выделить устойчивые блоки
реального пилота с общими Excursion. Для уверенно сопоставленных пар переносить
содержание EN из Word без отдельного ручного review; цены 2027 включать в общее
обновление RU/EN. Параллельно подключить locale resolver и переведенный интерфейс.
Массовую выдачу разрешить после рабочего CAS-диспетчера и recovery-пилота.
Не повторять уже сохраненную инвентаризацию без основания: сначала проверить
изменения источников.

## Сопоставление Word: массовый этап открыт 29.10.2026

- [Проверка результатов пилота](13-matching-pilot-audit.md)
- [Команда для параллельных чатов сопоставления](14-matching-bulk.md)
- CAS-ветка `i18n/matching-staging`: пять `ready`, 353 `queued` при активации.
- Массовый **перевод** по-прежнему закрыт.

## Перевод после закрытия сопоставления (30.10.2026)

- [Весь matching и предупреждения](15-matching-complete.md)
- `data/i18n/block-maps/tours/` — 358 RU Tour block maps, 31 330 блоков.
- `data/i18n/shared-excursion-owners/manifest.json` — единый EN-владелец
  для каждой из 348 общих Excursion; 137 повторно используются.
- Сопоставление и карты **готовы**. EN overlay/content, отдельный
  translation dispatcher, Astro runtime и EN deployment **не готовы**.
  Не запускать массовый рой переводчиков до нового gate.

