# Ada Tours — прямая загрузка новых медиа в S3, без бинарных Git-коммитов

**Версия 1.0, 09.10.2026.** Страницы остаются на GitHub Pages. Уже существующие файлы Git не удалять. **Все новые WebP/JPG/PNG/AVIF и MP4/WebM — только напрямую в Yandex Object Storage** через существующую OIDC-федерацию. Логические URL в MD/JSON сохраняют формат `/media/...`; production переводит их в `https://img.adatours.ru/media/...`.

## Защищенный маршрут ChatGPT Work

У Work должен быть рабочий компьютер с Node.js, доступом к сети и созданным файлом от GPT Image. Прямой S3-upload не поддерживается GitHub-коннектором: GitHub используется **только** для получения зашифрованного временного допуска и записи итоговых MD/JSON. Никогда не пересылать в чат IAM-токен, приватный ключ или пароль.

1. Сгенерировать одноразовые ключи и запрос **вне Git-репозитория**:
   `node scripts/media-work-session.mjs init --out /tmp/adatours-media-session`.
   Вывод покажет пути `*.request.json` и `*.private.pem`. Приватный файл остается только на компьютере Work и не попадает в GitHub, сообщения или логи.
2. Через GitHub connector записать **только JSON из `*.request.json`** в `data/media/upload-session-request.json` на ветке `main`. Создать файл при первом использовании; затем обновлять существующий. Это маленький публичный ключ, не пароль и не изображение. **При параллельной работе вместо общего файла использовать независимые запросы из раздела ниже.**
3. GitHub Actions автоматически запускает **Issue encrypted short-lived media upload token**. В логе найти **только строку `SEALED_MEDIA_TOKEN=...`** или скачать одноименный зашифрованный артефакт. Содержимое зашифровано X25519 + AES-256-GCM для локального приватного ключа Work. Время действия пакета — 10 минут, запрос живет не более 20 минут. При истечении срока повторить подготовку сеанса.
4. Подготовить локальный текстовый `batch.json` вне Git (не более 30 файлов):
   ```json
   [
     {
       "file": "/tmp/ada-work/hero.webp",
       "key": "media/tours/rio/hero-enhanced-20261009-v2.webp"
     },
     {
       "file": "/tmp/ada-work/hero-background.mp4",
       "key": "media/tours/rio/hero-background-20261009-v1.mp4"
     }
   ]
   ```
   Все имена уникальные с восьмизначной датой версии, только допустимые расширения. Действующий S3-объект с иными байтами не перезаписывать.
5. Загрузить напрямую (закрытый пакет передается как аргумент, **не plaintext IAM-токен**):
   ```sh
   node scripts/media-work-session.mjs upload \
     --request /tmp/adatours-media-session/<id>.request.json \
     --private /tmp/adatours-media-session/<id>.private.pem \
     --envelope '<BASE64_ИЗ_SEALED_MEDIA_TOKEN>' \
     --batch /tmp/ada-work/batch.json \
     --receipt /tmp/ada-work/receipt.json
   ```
   Скрипт проверит SHA-256, Content-Type, размер, загрузит S3 объект напрямую через HTTPS с `If-None-Match: *`, скачает назад и сравнит байты. Если отправка неудачна или ответ неоднозначен, **не связывать файл в MD**.
6. Локально объединить подтвержденные записи:
   `node scripts/merge-direct-media-receipt.mjs /tmp/ada-work/receipt.json`.
   Затем обновить только необходимые Tour/Country/Excursion/Destination MD, provenance, и привычные фотореестры. Один логический commit **только текстовых изменений**, включая `src/data/media/direct-s3-uploads.json`. Все бинарные файлы оставить вне Git.
7. GitHub Actions перед публикацией локально проверяет весь реестр, запрещает изменение старых receipts и через S3 проверяет **только новые записи относительно предыдущего Git-коммита** по размеру, SHA-256 и MIME. Если нового объекта нет, деплой блокируется; прежние объекты, уже проверенные при загрузке, повторно не опрашиваются. При отдельном аудите можно запустить `node scripts/verify-direct-s3-assets.mjs` без `--changed-only` для полной проверки.

## Независимые запросы для параллельных чатов

После публикации обновленного `issue-media-upload-token.yml` в main каждому чату доступен отдельный канал запроса. Сначала закончить обрезку и кодирование, затем создать свежую локальную сессию командой из п.1: запрос действителен 20 минут, полученный зашифрованный допуск — 10 минут. Приватный ключ остается только локально.

**Через доступный GitHub connector:** создать **новый** текстовый файл `data/media/upload-session-requests/<requestId>.json` в main. Его имя должно точно совпадать с `requestId` внутри публичного JSON. Один запрос — один create-file commit. Не изменять существующий mailbox-файл и не добавлять `[skip ci]` / `[skip actions]` в сообщение: это остановит выпуск допуска.

```javascript
// request — только прочитанный локальный *.request.json, без приватного ключа.
const result = await tools.mcp__codex_apps__github_create_file({
  repository_full_name: 'alexyakovlev79/adatours.ru',
  branch: 'main',
  path: 'data/media/upload-session-requests/' + request.requestId + '.json',
  content: JSON.stringify(request, null, 2) + '\n',
  message: 'media: request isolated upload session ' + request.requestId
});
```

Сохранить SHA коммита. Найти именно его запуск через GET `https://api.github.com/repos/alexyakovlev79/adatours.ru/actions/workflows/issue-media-upload-token.yml/runs?event=push&head_sha=<COMMIT_SHA>`. Обычный `fetch_commit_workflow_runs` здесь не подходит: его текущая обертка возвращает только запуски pull request. Для неопределенного ответа create-file сначала перечитать **тот же** путь и сравнить публичный запрос, затем найти его создание через GET `.../commits?sha=main&path=data/media/upload-session-requests/<requestId>.json&per_page=1`; не перезаписывать файл и не создавать новый резерв автоматически.

Проверено в Word-проходе 26.10.2026: если обертка GitHub отклоняет URL с именем workflow, использовать поддерживаемый repository endpoint `.../actions/runs?head_sha=<COMMIT_SHA>&per_page=15` и выбрать тот же `issue-media-upload-token.yml` по точному SHA. При настроенном `HTTP_PROXY`/`HTTPS_PROXY` в Work Node 24 запускать upload с `node --use-env-proxy scripts/media-work-session.mjs ...`; не отключать проверку TLS. Повторять тот же immutable batch/ключи: скрипт сначала проверяет уже загруженные байты и не перезаписывает отличный объект. В логи и исключения не выводить расшифрованный IAM-токен или аргументы приватного сеанса.

В соответствующем запуске взять `SEALED_MEDIA_TOKEN` либо артефакт `encrypted-media-session-<requestId>-<runId>`, проверить совпадение requestId и выполнить локальную загрузку из п.5. Сеансы не делят общий concurrency slot. Данные запроса читаются из **точного triggering commit**, а исполняемый код — только из main; произвольные ref, код и учетные данные в запросе отвергаются. Публикация сайта должна игнорировать `data/media/upload-session-requests/**`, как и старый singleton-файл.

**Если доступен workflow dispatch:** запустить `issue-media-upload-token.yml` строго с `ref: main` и обоими строковыми inputs: `request_json` — полный публичный JSON; `request_id` — его точный requestId. Например:

```sh
gh workflow run issue-media-upload-token.yml --ref main \
  -f request_json="$(cat /tmp/adatours-media-session/<id>.request.json)" \
  -f request_id='<id>'
```

Текущий набор GitHub connector tools не содержит запуска workflow dispatch; mailbox выше выполняется через имеющийся create-file tool. Старые singleton push и ручной dispatch без inputs сохранены для последовательной работы. Локальный upload по-прежнему принимает максимум 30 файлов за вызов; большие наборы делить, затем сохранять все подтвержденные receipts. В рое receipts хранятся отдельно по пакетам; общий `direct-s3-uploads.json` объединяет мастер при финальном подключении.

## Безопасность и отказоустойчивость

- Нет постоянных ключей S3. Сервисный аккаунт `adatours-media-publisher` уже подключен к OIDC GitHub Actions с ролью `storage.uploader`; ему не выдавать администраторских прав.
- Подмена JSON запроса, неверный приватный ключ, изменение зашифрованного пакета, просроченный запрос и несовпадение S3 SHA-256 завершаются ошибкой.
- `.gitignore` предотвращает случайный `git add` новых файлов, а Actions отдельно запрещает любые добавления/замены бинарных медиа относительно закрепленного коммита.
- **Нельзя использовать старый fallback «положить WebP в `public/media` и закоммитить»**. Если Work не может выполнить прямой S3-upload, зафиксировать блокер: файл остается подготовленным вне репозитория, а ссылка на него не публикуется.
- Для файлов, которые были перенесены в S3 ранее, менять MD и реестр не требуется. Старую медиаисторию Git не переписывать.
- Для медиароликов работает этот же upload. Включение autoplay-видео в hero — отдельная правка шаблона с обязательным статичным WebP-постером, защитой PageSpeed и fallback. Сам перенос видео в S3 ничего не меняет в интерфейсе.

## Проверка выполнения

GitHub Actions: `Smoke test direct S3 upload without Git binaries` подтверждает сквозной путь OIDC → зашифрованный пакет → расшифровка локальным временным ключом → прямой PUT S3 → GET + SHA-256. Для Work-операции дополнительно обязателен собственный receipt и успешный деплой затронутого MD.

В обычном ChatGPT без локального рабочего компьютера и доступного исходного WebP безопасный upload технически недоступен: не утверждать, что файл загружен, не коммитить бинарные данные и не подменять загрузку «просто ссылкой».

## Фотопакеты: один допуск и восстановление с последнего файла

На 1–30 подготовленных файлов используется один запрос временного допуска и одна команда media-work-session.mjs upload с --batch. Сначала получить все результаты GPT Image, затем выпускать 10-минутный токен. Отдельный IAM-токен для каждой фотографии не нужен.

Загрузчик теперь после каждой успешной и проверенной SHA-256 загрузки сохраняет receipt.json. При обрыве на пятом файле уже подтвержденные первые четыре остаются в отчете. Повтор с тем же batch.json сверяет SHA-256 соответствующих локальных файлов и не загружает их заново. При истечении временного токена запросить новый токен только для оставшейся части. После успешного пакета адресно записать результаты в GitHub одним content commit.
