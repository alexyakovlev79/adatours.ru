> Исторический handoff от 24.09.2026. Рабочие задачи, источники и завершение определяет `docs/workflows/master.md`; этот файл не является startup-инструкцией.

# SITE_HANDOFF_2026-09-24

## Точка продолжения

Актуальная ветка: `main`.

HEAD перед созданием этого handoff:
`1ac097e7a0cf7c676763d9afe34dafaa08da3078` — `Complete Wave 2 reviews foundation`.

Новый чат должен сначала прочитать:

1. `ADA_TOURS_SITE_MASTER_BLUEPRINT_v1.md`;
2. `WHITE_GARNET_REFERENCE_CORE.md`;
3. актуальный `docs/PROTOTYPE_STATUS.md`;
4. этот handoff;
5. текущий `main` репозитория.

Не восстанавливать состояние по старой переписке, если оно расходится с repo.

## Что было обнаружено при продолжении

Исходный предыдущий handoff говорил, что Wave 2 еще не изменялась. К моменту продолжения это уже было неактуально: параллельный чат успел продвинуть Wave 2 значительно дальше.

По фактическому `main` уже были закрыты:

- Brazil destinations: Rio de Janeiro, Foz do Iguacu, Manaus / Amazon, Pantanal;
- Argentina destinations: Buenos Aires, El Calafate, Mendoza;
- Peru destinations: Cusco, Lima, Machu Picchu;
- priority tours: Luxury Brazil, Brazil + Argentina + Peru, Peru 8 days;
- cases: business delegation in Sao Paulo / Campinas, corporate group in Rio / Angra.

Последний production commit перед моей новой работой:
`37976576ca769c14ae9735ad21ce9336fd5a7331` — `Sync corporate case with approved Drive copy`.

GitHub Pages run #115 для него завершился `success`.

Поэтому 4 Brazil destination повторно не редактировались и не откатывались.

## Что сделано мной в этом чате

### 1. Проверено актуальное состояние repo

Проверены свежие commits и текущие production-файлы.

Подтверждено, что:

- 4 Brazil destination уже `approved`;
- Argentina и Peru priority destinations уже `approved`;
- 3 priority tours уже `approved`;
- 2 MICE cases уже `approved`;
- Wave 1 остается закрытой;
- Wave 0 остается `partial_pending_owner_confirmation`.

### 2. Закрыт следующий незакрытый блок Wave 2: reviews foundation

Commit:

`1ac097e7a0cf7c676763d9afe34dafaa08da3078` — `Complete Wave 2 reviews foundation`.

Добавлено:

- `src/data/reviews/ada-tours.ts`;
- `src/components/proof/ReviewQuote.astro`;
- `src/pages/reviews/index.astro`;
- ссылка `/reviews/` в footer;
- обновлен `docs/PROTOTYPE_STATUS.md`.

В initial reviews core заведено 8 фрагментов клиентских / партнерских отзывов с полями:

- author;
- organization / role, если есть;
- segment;
- route, если есть;
- source review number;
- source URL;
- source language;
- translated flag;
- publication permission.

Для англоязычных фрагментов RU-страница показывает русский перевод и явную пометку `Перевод с английского`.

### 3. Синхронизирован Google Drive

В:

`Новый adatours.ru / 03_content/`

создана папка:

`reviews`

В ней создан документ:

`APPROVED — Ada Tours — отзывы — Wave 2 core`.

Он содержит тот же initial набор из 8 отзывов и правило использования.

### 4. Не опубликован спорный claim 24/7

Wave 0 по support model не закрыта.

Поэтому фрагмент старого отзыва, где фигурирует 24/7, в новый reviews core сознательно не включен как доказательство режима поддержки.

Новый чат не должен публиковать:

- 24/7 support;
- white label;
- client ownership;
- net rates;
- response time;
- cancellation policy;
- memberships;
- 10 000+ / 1900 / 50+ countries;

пока эти факты не утверждены владельцем.

### 5. Build и deploy после reviews прошли

GitHub Pages run:

`#116`

Commit:

`1ac097e7a0cf7c676763d9afe34dafaa08da3078`

Result:

`completed / success`.

Production artifact также был получен из run #116.

## Исторические незавершенные задачи

Требование отдельной экранной приемки страницы отзывов отменено 02.10.2026. Оно не блокирует наполнение сайта и не назначается следующему чату.

### 2. Source-verification 8 review excerpts

Перед тем как считать 8 отзывов окончательным каноническим корпусом, нужно сделать отдельную сверку каждого фрагмента с фактической старой публикацией / сохраненным source snapshot.

Поля `sourceReviewNumber` и `sourceUrl` уже предусмотрены специально для этой трассировки.

Если текст, автор, организация, язык или номер расходятся с источником, исправить одновременно:

- GitHub data file;
- Google Drive approved document.

Не расширять цитату и не дописывать клиенту формулировки от себя.

## Wave 0: по-прежнему открыто

Нужно подтверждение Анны по 9 группам фактов:

1. canonical company history / founding year;
2. support model и допустимость 24/7;
3. white-label policy;
4. client relationship ownership;
5. net rates;
6. response / quotation time;
7. cancellation policy;
8. memberships / associations;
9. numeric claims 10 000+ / 1900 / 50+ countries.

До подтверждения текущая осторожная версия fact passport остается правильной.

## Продолжение работы

Следующий чат выполняет конкретный запрос пользователя по актуальному workflow из `docs/workflows/`. Очередь не зависит от повторного аудита старых страниц. Туры могут ссылаться на зарезервированные места до создания их страниц; экскурсии создаются по выбранной записи или как необходимая часть тура.

## Важное правило синхронизации

Google Drive = editorial approved copy / source materials.

GitHub = production content / components / optimized assets.

Любую финальную текстовую правку в reviews, destinations, tours или cases синхронизировать в обе стороны в рамках одной задачи.

## Дизайн

Глобальную дизайн-систему не пересматривать.

White Garnet остается визуальным эталоном.

Менять global components / tokens только при конкретном обнаруженном дефекте или новом требовании страницы.
