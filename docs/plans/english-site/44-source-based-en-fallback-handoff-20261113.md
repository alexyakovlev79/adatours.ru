# Ada Tours EN — адресное закрытие русскоязычных остатков после оптимизации каталогов

Дата: 13.11.2026 (Москва; точное время не устанавливалось).
Источник фактов: immutable receipt EN preflight `43319957765`, подтвержденный после каталожных исправлений EN preflight [43365778576](https://github.com/alexyakovlev79/adatours.ru/actions/runs/43365778576), исходные файлы и действующий [план этапов](42-remaining-en-localization-plan-20261112.md).

## Что выполнено и что НЕ означает подсчет языка страницы

До изменений **4 300 из 6 149** EN HTML имели `lang=ru` (fallback). Это преимущественно генерируемые каталоги, не 4 300 независимых исходных текстов.
В [PR #94](https://github.com/alexyakovlev79/adatours.ru/pull/94) локализованы общие каталоговые H1, intro, подписи типов мест, названия и динамические числа, VIP цена, страницы интересов, стран и multi-country. EN preflight [43365778576](https://github.com/alexyakovlev79/adatours.ru/actions/runs/43365778576) подтвердил **6 059 EN HTML / 90 RU fallback** и 404 991 корректных внутренних ссылок. Это прирост 4 210 страниц с `lang=en`, **не утверждение**, что в этих 6 059 HTML нет ни одного русского текста.

[PR #95](https://github.com/alexyakovlev79/adatours.ru/pull/95) сохранил повторное использование **трех уже готовых переводов стран** (Бразилия, Чили, Колумбия), чей старый exact Git SHA перестал совпадать только после доказанных добавлений ссылок к featureBands и нормализации одного русского топонима. Разрешено строго три пары source SHA, а не глобальный обход source fingerprint. Дополнительный эффект на числе EN-страниц подтверждать новым main EN build, не выводить из одного коммита.

Оба PR объединены с main, без правок RU Markdown, цен, идентичности объектов, маршрутов, исходных фото и переводческих аренды/receipt. `PUBLIC_EN_RELEASE=0` и noindex сохраняются.

## Готовые тексты: не пересоздавать

**7 056 / 7 056 FULLTEXT материалов сохранены и применены в отдельном noindex build, `partial=0`, `withheld=0`, `excluded=0`.** В том числе 5 590 SEO/GEO-статей, 1 019 мест, 407 экскурсий, 21 страна, 15 интересов, 3 кейса и 1 Person. Эти материалы не переводить повторно.

Основная очередь `i18n/translation-mass-staging` и ее 4 006 Tour-пакетов остаются неприкосновенными. Платный OpenAI API пользователь отменил; его worker/cron не включать. Сохраненные `review` по договоренности допускаются в EN noindex без независимой QA, с сохранением технических source checks.

## Открытые точные текстовые поля туров

По `en-shared-translation-receipt` (artifact 13990028314, EN build 43319957765) остается **312 непереведенных полей у 35 Tour**. Поля идентифицируются по `sourceId` и точным `fallbackFields[]` в receipt, а не по URL/строке таблицы. При отборе сначала фильтровать архив/неактивные туры по текущему `data/catalog-archive.json`. Один и тот же текст нельзя подставлять в разные программы по одному похожему названию.

| Stable Tour ID | Полей |
|---|---:|
| `tour_argentina_best_14_days` | 24 |
| `tour_brazil_little_mix_ten_days` | 16 |
| `tour_brazil_peru_argentina_group_15_days` | 16 |
| `tour_brazil_three_ecosystems_8_days` | 16 |
| `tour_nicaragua_best_10_days` | 12 |
| `tour_source_kolumbiya_stolitsy` | 11 |
| `tour_brazil_dunes_13d` | 8 |
| `tour_brazil_recife_porto_noronha_10d` | 8 |
| `tour_chile_hidden_secrets_9_days_2027` | 8 |
| `tour_source_3_strany_gajana_surinam_i_frantsuzskaya_gviana` | 8 |
| `tour_source_5_stran_latinskoj_ameriki_i_parad_chempionov_karnavala` | 8 |
| `tour_source_antarktida_programma_na_ves_den` | 8 |
| `tour_source_argentina_bariloche_i_buenos_ajres` | 8 |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | 8 |
| `tour_source_braziliya_ot_san_paulo_do_buziosa` | 8 |
| `tour_source_braziliya_s_detmi` | 8 |
| `tour_source_braziliya_s_vodopadami_na_novyj_god` | 8 |
| `tour_source_buenos_ajres_salta_iguasu` | 8 |
| `tour_source_chili_argentina` | 8 |
| `tour_source_chili_kosmicheskoe_puteshestvie_na_zemle` | 8 |
| `tour_source_chudesa_gvatemaly_beliza` | 8 |
| `tour_source_costa_rica_nicaragua_ru` | 8 |
| `tour_source_karnaval_v_rio_de_zhanejro` | 8 |
| `tour_source_klassicheskaya_antarktida` | 8 |
| `tour_source_luchshee_v_venesuele` | 8 |
| `tour_source_lyuksovyj_tur_v_kosta_riku_na_16_dnej` | 8 |
| `tour_source_nezabyvaemyj_novyj_god_v_brazilii` | 8 |
| `tour_source_otbleski_tsentralnoj_ameriki_v_5_stranakh` | 8 |
| `tour_source_severnyj_pantanal_vodopady_reki_i_rio_de_zhanejro` | 8 |
| `tour_source_tur_v_braziliyu_s_detmi` | 8 |
| `tour_source_ves_ekvador_i_galapagosskie_ostrova` | 8 |
| `tour_source_ves_mnogolikij_peru_ikitos` | 8 |
| `tour_source_klassicheskaya_kosta_rika` | 5 |
| `tour_source_ves_ekvador_variant_1` | 3 |
| `tour_source_klassicheskaya_programma_po_gvatemale` | 1 |
| **Итого** | **312** |

По типам (срез того же receipt): `itinerary` — 169, `included` — 44, `notIncluded` — 27, `route` — 22, `notes` — 18, `hero` — 7, `title` — 6, `lead` — 6, `priceNote` — 6, `__body` — 5, `format` — 1, `dates` — 1. Для каждого поля сверить исходный текст, цену, условие, последовательность и источник Word при наличии; менять только подтвержденный недостающий EN слот. Не дописывать факты и не запускать новую полную очередь.

## Остатки на уже англоязычных страницах

На предрелизной сборке после PR #94 автоматический аудит обнаружил **23 520 вхождений кириллицы на 2 579 HTML** (классификация машинная, значения могут повторяться). По типам: `mixed_content_or_name_review` 8 142; `noscript_fallback_markup` 4 671; `permitted_ru_body_fallback` 3 356; `technical_pagefind_index` 3 204; `media_pending_stage6` 3 264; `ui_localization_gap` 866; `standard_page_heading_review` 17. Не складывать эти количества с 90 RU-mode как независимые страницы. Сначала исключать настоящие названия оригинальных русских публикаций, цитаты и технические Pagefind/noscript фрагменты. Остальные пользовательские фразы и подписи медиа исправлять по source key, а не глобальным replace. EN медиапроход этапа 6 остается отдельным незакрытым блоком.

## Рабочий порядок без расходов и дублей

1. Подтвердить точный latest main SHA, translation staging SHA и результат EN noindex Pages; `committed` не равен `deployed`.
2. На действующих 35 (после исключения архивов) проверить `fallbackFields[]` и переводить только недостающие поля, с фактами из exact русской записи и приоритетного EN Word, сохранять в собственной идемпотентной source-bound ревизии. Не переписывать 4 006 старых результатов и 7 056 FULLTEXT.
3. На полном построенном EN HTML после применения source-based каталога адресно пройти `ui_localization_gap` и медиа, отличать пользовательские надписи от оригинальных имен публикаций/цитат.
4. Снова проверить все канонические HTML и JS-состояния, exact URL, валюты, source hashes, историю и noindex. Не включать индексируемый EN домен/reciprocal hreflang без отдельного разрешения.
