# English site: архитектура, источники и начальная реализация

Поручение от 28.10.2026. Один source repository, общие факты/код/медиа, отдельные
RU/EN тексты. Английский домен по умолчанию — `adatours.com`, заменяемый настройкой.
Рабочая ветка — `feat/english-site-foundation`; исходный SHA —
`b1b14ed3a8abab9773053f836fed28c2ff77204f`.

## Состояние

**Подготовка завершена; новый EN-сайт и автоматический перевод ещё не запущены.**
Есть архитектура, инструкции, полная наблюдаемая опись Drive, предварительный
реестр всех туров, восемь проверенных идентичностей, английские UI/SEO-заготовки,
изолированные библиотеки и 35 пройденных тестов. Полных переводов Tour — 0;
matching/block maps и runtime-интеграция остаются следующими этапами.

## Документы

| Файл | Содержание |
| --- | --- |
| [00-progress.md](00-progress.md) | Контрольные точки и восстановление работы |
| [01-architecture.md](01-architecture.md) | Общие данные, два языка, изменения в обе стороны, домены, hosting, releases |
| [02-word-sources-and-matching.md](02-word-sources-and-matching.md) | Drive inventory, восемь пар и реальные конфликты |
| [03-translation-editorial.md](03-translation-editorial.md) | Сохранение Word, AI gaps, человеческий текст и voice Ada Tours |
| [04-swarm-runbook.md](04-swarm-runbook.md) | Этапы 2027/2026/AI, роли, очереди, claims, recovery, команды будущих чатов |
| [05-seo-schema-audit.md](05-seo-schema-audit.md) | Фактические title/H1/description/JSON-LD и список файлов для локализации |
| [06-rollout-plan.md](06-rollout-plan.md) | Пошаговое внедрение и критерии завершения этапов |
| [07-implemented-core.md](07-implemented-core.md) | Уже реализованный строгий text overlay и границы API |
| [08-ui-copy.md](08-ui-copy.md) | Полная таблица 218 коротких RU/EN строк |
| [09-foundation-review.md](09-foundation-review.md) | Независимая проверка и устранённые дефекты |
| [10-report.md](10-report.md) | Самостоятельный итоговый отчёт |

## Данные и код

- `data/i18n/programme-sources.json` — 732 кандидатных документа двух годов,
  источники/версии и агрегаты исключений; не 732 уникальных продукта.
- `data/i18n/tour-word-matches.json` — 392 Tour, включая 34 архивных; кандидаты
  и восемь identity-confirmed пар, без разрешения на публикацию.
- `data/i18n/word-pilot-review.json` — предметные доказательства, hashes и конфликты.
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

## Следующий конкретный шаг

Продолжить смысловое сопоставление оставшихся Tour и выделить устойчивые блоки
реального пилота с общими Excursion. Параллельно подключить locale resolver и
переведённый интерфейс. Массовую выдачу разрешить после рабочего CAS-диспетчера
и recovery-пилота, по точным gates из runbook. Не повторять уже сохранённую
инвентаризацию без основания: сначала проверить изменения источников.
