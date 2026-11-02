# Ada Tours: постоянные адреса заменяемых портретов

Дата: 30.10.2026. Только существующий сотрудник, только замена старого WebP новым.

1. Сначала загрузить новую версионную фотографию в S3 стандартным `direct-s3-upload.md` и сохранить SHA-256 receipt в `src/data/media/direct-s3-uploads.json`. Старый файл сохранить.
2. Создать в `main` один новый файл `data/media/person-photo-alias-requests/<requestId>.json` с точными полями: `version:1`, `requestId` (32 hex), `personId` (`person_geovani` и т. п.), `sourceKey` (версионный WebP этого человека, который уже есть в S3), `expectedPreviousSha256` (SHA текущего `current.webp` или `null` для первого создания). В этом коммите других изменений не делать.
3. GitHub Actions `person-photo-alias.yml` проверит source receipt, получит короткий OIDC токен, выполнит условный S3 PUT с `If-None-Match: *` или `If-Match: <ETag>`, прочитает новый объект и подтвердит SHA-256. Сохраняется receipt в Actions и статус `ada/person-photo-alias` по точному SHA запроса.
4. После **первого** успешного создания `current.webp` изменить ссылку в `src/data/organization/team.json` на `/media/people/<person>/current.webp` и выполнить один обычный Pages deploy. После этого последующие замены не меняют HTML и не требуют Pages deploy. Кеш: 60 секунд.
5. Возврат к прежнему портрету: новый request с соответствующим уже сохраненным версионным `sourceKey` и актуальным `expectedPreviousSha256`; объект под версионным именем никогда не перезаписывать. Повтор того же запроса безопасен. При неверном SHA или ETag прежнее содержимое сохраняется.

Для нового человека, изменения размеров/верстки, галерей, подписей и социальных превью использовать обычный content-deploy. Этот механизм только для замены текущего изображения.
