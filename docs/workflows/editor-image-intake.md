# Ada Tours — фотографии от Анны и других редакторов через ChatGPT / Codex

Версия 1.0 · 30.10.2026. Репозиторий: `alexyakovlev79/adatours.ru`.
Применяется к **каждому новому фото, присланному для страницы** любым авторизованным редактором: Анной, Алексеем и другими участниками команды.

## Решение

Оригинал от автора → **реальный GPT Image edit** → WebP → оригинал и WebP напрямую в **Yandex Object Storage** → SHA-256 receipts → `direct-s3-uploads.json` + `photo-enhancements.json` → изменение content-файла → PR → успешный GitHub Pages deploy.

- Новые бинарные изображения **не попадают в Git**, включая `public/media/`. Запрет `guard-no-new-git-media.mjs` сохраняется.
- Улучшение означает **только GPT Image с этим конкретным оригиналом**. Sharpen, resize, denoise, WebP-конвертация, детерминированная коррекция и придуманная запись `method: gpt-image` запрещены. Если у исполнителя нет средства GPT Image, это точный блокер, а не разрешение на fallback.
- Ключей Yandex редакторам не выдавать. Задействован существующий одноразовый зашифрованный допуск GitHub Actions → OIDC → Yandex Object Storage из `direct-s3-upload.md`. Новое содержимое сайта публикуется после **успешного** GitHub Pages Actions, а не после commit.
- Новые фотографии обычно меняются в отдельной ветке с PR в `main`; единственное допустимое изменение `main` до PR — текстовый публичный запрос временного S3-сеанса, как уже предусмотрено действующей архитектурой.

## Порядок для Codex / Work

1. Прочитать `AGENTS.md`, `docs/ANNA_SITE_EDITING.md`, этот документ и `docs/workflows/direct-s3-upload.md`. Определить точный slot/ID страницы, к которой относится фото. Для команды: `src/data/organization/team.json` → `members[].photo.src`.
2. Получить **исходный файл именно от пользователя**, сохранить за пределами репозитория (например, `/tmp/ada-photos/anna-original.jpg`). До генерации проверить, нет ли уже готового результата:

   `node scripts/editor-photo-publish.mjs --check true --original /tmp/ada-photos/anna-original.jpg`

   Результат `already-enhanced` означает, что подтвержденный GPT Image WebP есть в S3 и его нужно переиспользовать, без повторной генерации. `needs-gpt-image` означает продолжение обработки.
3. Передать указанный оригинал в **реально доступный GPT Image** как edit target. Для портретов: “Edit the exact supplied photograph. Improve only photographic quality, clarity and cleanliness. Preserve person's identity, face, expression, skin tone, clothing, pose, scene, background, composition and framing. Do not add or replace people or objects, invent a new face, stylize, insert text or logos.” Для ландшафта сохранить географию и исходную сцену по профильному workflow. Выход GPT Image сохранить в WebP во временной папке, например `/tmp/ada-photos/anna-gpt.webp`. **Не выдавать обычную конвертацию в WebP за GPT Image.**
4. Из checkout с Node.js 24 и авторизованным `gh` выполнить:

   `node scripts/editor-photo-publish.mjs --original /tmp/ada-photos/anna-original.jpg --enhanced /tmp/ada-photos/anna-gpt.webp --owner people/geovani --slot portrait`

   `--owner` задает папку внутри `media/`, `--slot` — короткое имя поля изображения. Для других типов страниц подставить их фактический путь, а не `people/geovani`. Скрипт подготовит два неизменяемых ключа, запросит через GitHub Actions шифрованный короткий допуск, проверит обе S3-загрузки, объединит receipts и запишет `method: gpt-image` для пары оригинал → результат. Вернет `photoSrc`.
5. Записать только возвращенный `photoSrc` в целевое поле контента, сохранить alt и фактические размеры. Удалить из **текущего Git-дерева** только новую фотографию, если ее уже ошибочно добавили в `public/media/`; исторические файлы не трогать. Проверить JSON, diff, два обновленных реестра, отсутствие новых бинарных файлов. Затем **PR → review → merge → GitHub Pages success**.

### Предварительные технические условия

Codex / Work должен иметь сам оригинал и обработанный файл на доступном рабочем компьютере, Node.js с зависимостями репозитория, доступ HTTPS к GitHub/Yandex Object Storage и авторизованный GitHub CLI (`gh api repos/alexyakovlev79/adatours.ru`). Подключение GitHub к ChatGPT само по себе не гарантирует авторизацию CLI внутри среды. Если `gh` или интернет недоступны, сохранить `BLOCKED_UPLOAD`, использовать допустимый GitHub-connector путь `direct-s3-upload.md` либо агент Work с реальным файловым доступом; запрещено упрощать задачу бинарным Git-коммитом. ChatGPT Plus не означает доступ к отдельному платному API; для этого пути API-ключ OpenAI не нужен, если GPT Image действительно доступен в Codex/ChatGPT.

Реестр исходников `src/data/media/direct-s3-uploads.json` фиксирует SHA-256 оригинала и WebP. `src/data/media/photo-enhancements.json` фиксирует отдельно только фактически выполненную GPT Image обработку. Загрузчик откажется перезаписывать S3-файл другим содержимым. При неопределенном результате проверять существующий ключ и receipt, не генерировать заново доказанно готовый исходник. Параллельные редакторы собирают свои текстовые изменения поверх свежего `main`, не затирая чужие реестры.

## Ремонт первого добавления Геовани

30.10.2026 в `main` был внесен коммит `7dd5e9438fce473fc6ad5a4420e287b3b64d9dd4`: текст Геовани в `src/data/organization/team.json` и новый бинарный файл `public/media/people/geovani/geovani-20261030.webp`. GitHub Pages run `41057093032` остановился на проверке отсутствия новых Git-медиа. Это не ошибка подписки Анны и не причина отключать gate.

Для исправления: использовать существующий WebP только как **исходник** GPT Image → реально получить улучшенный WebP → загрузить оба файла новым маршрутом с `--owner people/geovani --slot portrait` → обновить фото Геовани на возвращенный `photoSrc` и реестры → удалить только ошибочный бинарный файл из нового дерева Git → получить успешный Pages deploy. До подтвержденного S3 не удалять источник и не публиковать несуществующую ссылку. Существующий текст биографии сохранять.
