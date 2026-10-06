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
POSTBOX_TO=ya@gaeo.ru
ALLOWED_ORIGINS=https://alexyakovlev79.github.io,https://adatours.ru,https://www.adatours.ru
MAX_BODY_BYTES=32768
MIN_FILL_SECONDS=1.5
```

`form@gaeo.ru` is the safe default while the already verified GAEO Postbox sender is used. A dedicated Ada Tours sender can replace it after its domain is verified in Postbox.

After the user separately confirms production recipients, change only the server-side environment variable:

```text
POSTBOX_TO=ya@gaeo.ru,Anna@adatours.com,Operations@adatours.com
```

Do not put recipients or secrets into the browser bundle.

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
