# Ada Tours lead form backend

Serverless handler for the public Ada Tours lead form. The production pattern mirrors GAEO.ru:

GitHub Pages frontend → Yandex Cloud Function → Yandex Cloud Postbox → email.

## Yandex Cloud Function

- Runtime: Python 3.14
- Entrypoint: `index.handler`
- Memory: 128 MB
- Timeout: 10 seconds
- Public function: enabled
- Service account: attach a service account with the `postbox.sender` role
- Static API keys are not required; the handler uses the service-account IAM token available in the function context.

## Environment variables

Test stage:

```text
POSTBOX_FROM=form@gaeo.ru
POSTBOX_TO=info@adatours.ru
ALLOWED_ORIGINS=https://alexyakovlev79.github.io,https://adatours.ru,https://www.adatours.ru
MAX_BODY_BYTES=32768
MIN_FILL_SECONDS=1.5
```

`form@gaeo.ru` is the safe default while the already verified GAEO Postbox sender is used. A dedicated Ada Tours sender can replace it after its domain is verified in Postbox.

At launch, `info@adatours.ru` is the **only direct recipient** (To) configured in Postbox. Any forwarding from `info@adatours.ru` to other addresses is managed separately by the user in Yandex 360, not by this Cloud Function. Do not add `ya@gaeo.ru`, `Anna@adatours.com`, `Operations@adatours.com`, or any other direct recipients unless the user explicitly requests a later change.

If the user later approves more direct recipients, update only the server-side `POSTBOX_TO` environment variable. Do not put recipients or secrets into the browser bundle.

## Frontend endpoint

After deployment, copy the public function invocation URL into `public/form-config.js`:

```js
window.ADATOURS_FORM_ENDPOINT = 'https://functions.yandexcloud.net/<function-id>';
```

The endpoint URL itself is public and is not a secret.

Expected payload fields:

- `site=adatours`
- `lang`
- `full_name`
- normalized `phone`
- `phone_country`
- `email`
- `comment`
- `contact_method`
- `entity_id`
- `tour_id`
- honeypot `company_website`
- page URL, canonical URL and referrer
- UTM/click identifiers
- form start/submission timestamps

## Privacy and anti-spam

The handler validates Origin, the current Ada Tours page URL, field lengths and formats, rejects oversized requests, uses a honeypot and suppresses unrealistically fast submissions. It never logs the visitor's lead contents, name, email, phone, comment, page URL, referrer or UTM values.

## Обновление существующей функции в консоли Yandex Cloud (03.11.2026)

Не создавать новую функцию: нужно создать **новую версию** действующей Cloud Function,
на которую ссылается `public/form-config.js`. Путь к коду:
`serverless/adatours-form/index.py` в `main`.

1. Откройте Cloud Functions в каталоге существующей функции.
2. Откройте нужную функцию и в разделе «Последняя версия» нажмите
   «Создать в редакторе».
3. Замените `index.py` актуальным полным кодом из GitHub и создайте
   новую версию с точкой входа `index.handler`, Python 3.14,
   памятью 128 МБ и тайм-аутом 10 секунд.
4. **Сохраните существующие** сервисный аккаунт с `postbox.sender`,
   права публичного вызова и все переменные окружения. Проверить
   `POSTBOX_TO=info@adatours.ru` и что `ALLOWED_ORIGINS` содержит
   `https://alexyakovlev79.github.io`. Не пересоздавайте
   сервисный аккаунт, отправителя или получателя.
5. После развертывания отправьте одну реальную контрольную EN-заявку
   с `/adatours-en/en/tours/` и подтвердите HTTP 200, отсутствие
   ошибок Cloud Functions/Postbox и приход письма в `info@adatours.ru`.

Изменение Python-файла в GitHub не развертывает Cloud Function автоматически.
Нельзя считать доставку английских заявок проверенной до контрольного
письма. Ни домен `adatours.ru`, ни новая Cloud Function для этой проверки
не требуются.
