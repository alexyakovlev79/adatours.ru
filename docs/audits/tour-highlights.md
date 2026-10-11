# Туры с «Главными впечатлениями»: очередь иллюстраций

Срез: 11.10.2026. Репозиторий: `alexyakovlev79/adatours.ru`, ветка `main`.

Исходный commit: `8fa1bd809f8b36136ac2d97259c6710f3b2e0835`. Это фиксированный срез; новые туры и дальнейшие изменения требуют сверки.

Неархивных активных туров с highlights: **21**. Из них **0** показывают текстовый блок; **21** уже имеют фотографии и раскрытие по «+».

Для очереди нужно добавить **0** изображений показываемых впечатлений. Частично заполненных блоков: 0.

Проверены все 377 production MD: 346 активных, 31 архивных исключено. У 325 активных туров highlights пусты — они в эту очередь не входят.

Обновление 11.10.2026: первые три тура очереди получили 16 фотографий через imagegen. Подробности и промпты: `data/audits/tour-highlights-batch1-20261011.json`.

Обновление 11.10.2026: следующие три тура (исходные позиции 4–6) получили 11 фотографий через imagegen. Подробности и промпты: `data/audits/tour-highlights-batch2-20261011.json`.

Обновление 11.10.2026: следующие три тура (исходные позиции 7–9) получили 12 фотографий через imagegen. Подробности и промпты: `data/audits/tour-highlights-batch3-20261011.json`.

Обновление 11.10.2026: следующие три тура (исходные позиции 10–12) получили 14 фотографий через imagegen. Подробности и промпты: `data/audits/tour-highlights-batch4-20261011.json`.

Обновление 11.10.2026: следующие три тура (исходные позиции 13–15) получили 12 фотографий через imagegen. Подробности и промпты: `data/audits/tour-highlights-batch5-20261011.json`.

Обновление 11.10.2026: последняя тройка (исходные позиции 16–18) получила 14 фотографий через imagegen. Все 18 туров исходной очереди завершены; добавлено 79 изображений. Подробности: `data/audits/tour-highlights-batch6-20261011.json`.

## Как продолжать в следующих чатах

- Машинный реестр: `data/audits/tour-highlights-20261011.json`. Брать записи `workStatus: pending` в порядке `queueOrder`.
- Перед работой проверить свежий MD по `contentPath`, статус в `data/catalog-archive.json` и текущие `missingImageIndices`: номера здесь начинаются с 1 и относятся к исходному массиву `highlights`, а не к порядку на экране.
- Обычный импорт/восстановление тура не запускает эту очередь. Генерация выполняется по отдельному заданию пользователя и `docs/workflows/highlights.md`.
- Сохранять утвержденные title/text и существующие изображения. Новые медиа загружать по `direct-s3-upload.md`, отражать в реестрах и листе «Фото». После подтвержденного подключения обновлять запись очереди, счетчики и этот список в том же логическом пакете.
- Режим «фото + раскрытие» включается, когда `image.src` есть у всех элементов, переданных в `HighlightsEditorial`. `TourLayout` может вынести первое/последнее впечатление в отдельные истории с gallery; они не входят в недостающие изображения этого блока.

## Очередь: завершена

Необработанных туров из исходного списка нет.

| № | Тур | ID | Всего впечатлений | В блоке | Нужно фото | Номера без фото |
|---|---|---|---:|---:|---:|---|

## Уже готовы: фото и «+»

| Тур | ID | Впечатлений в блоке |
|---|---|---:|
| [Тур в Бразилию и Аргентину: от Манауса (Амазонка) до Игуасу](https://adatours.ru/multi-country/tour/brazil-amazon-argentina-manaus-iguazu/) | `tour_source_tur_v_braziliyu_s_amazoniej_i_argentinu` | 4 |
| [Тур в Бразилию в Рио де Жанейро, Илья-Гранди, Парати](https://adatours.ru/brazil/tour/brazil-rio-ilha-grande-paraty/) | `tour_source_tur_v_braziliyu_za_vkusami` | 3 |
| [VIP-тур в Коста-Рику и Никарагуа \| На частном самолете](https://adatours.ru/multi-country/tour/costa-rica-nicaragua-vip-private-plane/) | `tour_source_vip_kosta_rika_nikaragua` | 7 |
| [Новогодний тур в Бразилию, Аргентину и Чили 2027: 10 дней, цены](https://adatours.ru/multi-country/tour/brazil-argentina-chile-new-year-2027-10-days/) | `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | 5 |
| [Тур в Бразилию на водопады Игуасу с пляжным отдыхом в Бузиос](https://adatours.ru/brazil/tour/brazil-iguazu-buzios-13-days/) | `tour_source_tur_v_braziliyu_na_13_dnej` | 5 |
| [Тур в Бразилию на 6 дней: Рио-де-Жанейро и на Водопады Игуасу](https://adatours.ru/brazil/tour/brazil-rio-iguazu-6-days/) | `tour_source_tur_v_braziliyu_na_6dnej` | 2 |
| [Южная Бразилия VIP: виноградники, каньоны и океан](https://adatours.ru/brazil/tour/southern-brazil-vip-7-days/) | `tour_brazil_southern_vip_7_days` | 3 |
| [Тур в Уругвай и Парагвай 2026: скрытые сокровища Южной Америки \| 16 дней](https://adatours.ru/multi-country/tour/uruguay-paraguay-16-days-2026/) | `tour_source_tur_po_uruguayu_i_paragvayu_16_dnej` | 8 |
| [Эко-тур по Аргентине на 9 дней: киты Пуэрто-Мадрина и заповедник Ибера](https://adatours.ru/argentina/tour/argentina-wildlife-buenos-aires/) | `tour_source_tur_v_argentinu_na_dikuyu_prirodu` | 3 |
| [Мечты сбываются: Парад чемпионов, Игуасу и Буэнос-Айрес](https://adatours.ru/multi-country/tour/brazil-carnival-champions-parade-dreams/) | `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | 4 |
| [Новый год в Рио: Копакабана, статуя Христа, Сахарная Голова](https://adatours.ru/brazil/tour/rio-new-year-copacabana-christ-redeemer-sugarloaf/) | `tour_source_nezabyvaemyj_novyj_god_v_rio` | 5 |
| [Рио и Игуасу с еврейским наследием Бразилии](https://adatours.ru/brazil/tour/rio-iguazu-jewish-heritage-8-days/) | `tour_brazil_rio_iguazu_jewish_heritage_8_days` | 3 |
| [Тур в Бразилию индивидуальный: Рио, Игуасу, Пантанал, Бонито и Бузиос](https://adatours.ru/brazil/tour/brazil-rio-iguazu-pantanal-bonito-buzios-private-tour/) | `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 6 |
| [Дайвинг на Галапагосах: 4 или 5 дней с отелем Fiesta](https://adatours.ru/ecuador/tour/galapagos-diving-4-5-days/) | `tour_ecuador_galapagos_diving_4_5_days` | 3 |
| [Лучшее в Рио-де-Жанейро: Корковадо, Сахарная Голова и тропические острова](https://adatours.ru/brazil/tour/best-of-rio-de-janeiro/) | `tour_source_luchshee_v_rio_de_zhanejro` | 2 |
| [Скрытые сокровища Боливии и Чили: 16 дней от Уюни до Патагонии](https://adatours.ru/multi-country/tour/bolivia-chile-hidden-treasures-16-days/) | `tour_bolivia_chile_hidden_treasures_16_days` | 4 |
| [Бразилия, Перу и Аргентина: групповой тур на 15 дней](https://adatours.ru/multi-country/tour/brazil-peru-argentina-group-15-days/) | `tour_brazil_peru_argentina_group_15_days` | 3 |
| [Тур в Бразилию на Карнавал в Рио \| Игуасу, Амазонка и Бузиос](https://adatours.ru/brazil/tour/brazil-rio-carnival-iguazu-amazon-buzios/) | `tour_source_ekzoticheskij_karnaval_v_brazilii` | 9 |
| [Большое приключение в Бразилии за 17 дней: Рио, Игуасу, Пантанал, Бонито и Ленсойс](https://adatours.ru/brazil/tour/grand-brazil-adventure-17-days/) | `tour_brazil_adventure_17d` | 8 |
| [Бразилия, Аргентина и Перу за 14 дней](https://adatours.ru/multi-country/tour/brazil-argentina-peru-14-days/) | `tour_brazil_argentina_peru_14d` | 7 |
| [Пляжный тур в Бразилию на 10 дней: Ресифи, Порту-де-Галиньяс и Фернанду-де-Норонья](https://adatours.ru/brazil/tour/northeast-brazil-recife-porto-de-galinhas-fernando-de-noronha-10-days/) | `tour_brazil_recife_porto_noronha_10d` | 4 |

## Тур со скриншота

«Тур в Уругвай и Парагвай 2026: скрытые сокровища Южной Америки | 16 дней» — `tour_source_tur_po_uruguayu_i_paragvayu_16_dnej`.
Все восемь впечатлений получили фотографии и раскрытие по «+» в batch 4.
