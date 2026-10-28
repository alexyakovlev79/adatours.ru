# Подготовленный перевод интерфейса RU / EN

Дата: 28.10.2026. Координатор сам перевёл 218 строк; они не включены в задания роя. Это словарь для подключения к общим компонентам, а не подтверждение работающего английского интерфейса.

Источник: `src/data/i18n/ui-copy.json`; основные source hashes: `ui-copy-source.json`. Дополнительно `interest-copy.en.json` содержит 15 комплектов индивидуальных вводных и английских словоформ, переведённых с текущего `interest-copy.json`.

## Принятые решения

- Новый UI использует international English с британским написанием (programme, traveller, enquiry); принятые Word-фрагменты не нормализуются насильно.
- «Оставить заявку» → Send an enquiry; сайт не обещает мгновенную бронь/оплату.
- «Индивидуальный» → tailor-made, когда речь о разработке маршрута; private только для подтверждённой частной услуги.
- Две английские формы числительных хранятся отдельно от трёх русских. Динамические числа не вписаны вручную.
- Имена географии приходят из entity glossary/overlay; меню не переводит их случайным search-and-replace.
- Подключить нужно также aria-label, клиентские ошибки/статусы, поиск, формы, карты, архивы, 404 и fallback shell после сборки.

## Полный словарь

| Ключ | Русский | English |
| --- | --- | --- |
| `site.defaultTitle` | Ada Tours — путешествия по Бразилии и Латинской Америке | Ada Tours — travel in Brazil and Latin America |
| `site.defaultDescription` | Ada Tours — принимающий туроператор и DMC по Бразилии и Латинской Америке: индивидуальные путешествия, VIP, MICE и программы для турагентств. | Ada Tours is an inbound tour operator and DMC for Brazil and Latin America, offering tailor-made journeys, VIP travel, MICE and programmes for travel agencies. |
| `nav.tours` | Туры | Tours |
| `nav.countries` | Страны | Countries |
| `nav.multiCountry` | Multi-country | Multi-country |
| `nav.interests` | По интересам | Travel interests |
| `nav.vip` | VIP | VIP |
| `nav.mice` | MICE | MICE |
| `nav.agencies` | Для агентств | For travel agencies |
| `nav.about` | О нас | About us |
| `nav.contacts` | Контакты | Contact us |
| `nav.excursions` | Экскурсии | Excursions |
| `nav.places` | Направления | Places to visit |
| `nav.home` | Главная | Home |
| `nav.dmc` | DMC / B2B | DMC / B2B |
| `nav.travelAgencies` | Турагентствам | For travel agencies |
| `nav.terms` | Условия работы | Working with us |
| `nav.b2bProgrammes` | B2B-программы | B2B programmes |
| `nav.corporateTravel` | MICE и корпоративные поездки | MICE and corporate travel |
| `nav.delegations` | Деловые делегации | Business delegations |
| `nav.company` | О компании | About Ada Tours |
| `nav.anna` | Анна Аванесова | Anna Avanesova |
| `nav.team` | Команда | Our team |
| `nav.reviews` | Отзывы | Reviews |
| `nav.cases` | Кейсы | Case studies |
| `nav.press` | СМИ | Press |
| `nav.webinars` | Вебинары | Webinars |
| `nav.partners` | Партнеры | Partners |
| `nav.articles` | Статьи | Articles |
| `nav.allCountries` | Все страны | All countries |
| `nav.allInterests` | Все интересы | All interests |
| `nav.allVipTours` | Все VIP-туры | All VIP tours |
| `nav.allMultiCountryTours` | Все Multi-country туры | All multi-country tours |
| `nav.allTours` | Все туры | All tours |
| `nav.mainAria` | Основная навигация | Main navigation |
| `nav.mobileAria` | Мобильная навигация | Mobile navigation |
| `nav.homeAria` | Ada Tours, на главную | Ada Tours, home |
| `nav.openMenu` | Открыть меню | Open menu |
| `nav.closeMenu` | Закрыть меню | Close menu |
| `nav.back` | Назад | Back |
| `nav.breadcrumbs` | Хлебные крошки | Breadcrumbs |
| `nav.aboutSection` | Раздел о компании | About Ada Tours section |
| `nav.aboutLinks` | Переходы по разделу о компании | Links in the About Ada Tours section |
| `nav.aboutSections` | О компании · Разделы | About Ada Tours · Sections |
| `nav.miceSection` | Раздел MICE | MICE section |
| `nav.miceSections` | MICE · Разделы | MICE · Sections |
| `nav.agenciesSection` | Раздел для агентств | Travel agencies section |
| `nav.agenciesSections` | Для агентств · Разделы | For travel agencies · Sections |
| `cta.enquire` | Оставить заявку | Send an enquiry |
| `cta.discussTrip` | Обсудить поездку | Discuss your trip |
| `cta.discussTripAria` | Обсудить поездку — открыть форму заявки | Discuss your trip — open the enquiry form |
| `cta.bookTour` | Заказать этот тур | Enquire about this tour |
| `cta.call` | Позвонить | Call us |
| `cta.learnMore` | Подробнее | Find out more |
| `cta.viewCountries` | Смотреть страны | Explore countries |
| `cta.goHome` | На главную | Back to home |
| `footer.travel` | Путешествия | Travel |
| `footer.businessTravel` | Деловые поездки | Business travel |
| `footer.partners` | Для партнеров | For partners |
| `footer.region` | Бразилия и Латинская Америка | Brazil and Latin America |
| `footer.contact` | Свяжитесь с нами | Get in touch |
| `footer.legal` | Юридическая информация | Legal information |
| `footer.privacy` | Политика конфиденциальности | Privacy policy |
| `footer.personalData` | Обработка персональных данных | Personal data processing |
| `footer.credit` | Разработка сайта и продвижение в нейросетях - GAEO.ru | Website development and AI search visibility — GAEO.ru |
| `cookie.aria` | Уведомление об использовании cookie | Cookie notice |
| `cookie.message` | Мы используем cookie, чтобы сайт запоминал ваши настройки. | We use cookies to remember your preferences. |
| `cookie.more` | Подробнее | Find out more |
| `cookie.accept` | Понятно | Got it |
| `form.title` | Расскажите, какой маршрут вам нужен | Tell us about the trip you have in mind |
| `form.name` | Имя | Name |
| `form.namePlaceholder` | Ваше имя | Your name |
| `form.contactNumber` | Номер для связи | Contact number |
| `form.contactMethod` | Как с вами связаться | How would you like us to contact you? |
| `form.phone` | Телефон | Phone |
| `form.email` | Email | Email |
| `form.comment` | Комментарий | Message |
| `form.commentPlaceholder` | Даты, состав группы, пожелания | Travel dates, who is travelling and what you have in mind |
| `form.consentIntro` | Нажимая «Оставить заявку», вы соглашаетесь с | By clicking “Send an enquiry”, you agree to our |
| `form.privacyLink` | политикой конфиденциальности | privacy policy |
| `form.consentAnd` | и | and |
| `form.personalDataLink` | обработкой персональных данных | personal data processing terms |
| `form.success` | Спасибо! Заявка отправлена. Мы свяжемся с вами. | Thank you! Your enquiry has been sent. We will be in touch. |
| `form.close` | Закрыть форму | Close form |
| `form.modalLead` | Оставьте контакты и коротко опишите поездку. Мы свяжемся с вами и уточним детали. | Leave your contact details and tell us a little about your trip. We will get in touch to discuss the details. |
| `form.nameRequired` | Укажите имя. | Please enter your name. |
| `form.contactRequired` | Укажите телефон или email. | Please enter a phone number or email address. |
| `form.phoneInvalid` | Проверьте номер телефона. | Please check your phone number. |
| `form.emailInvalid` | Проверьте email. | Please check your email address. |
| `form.methodRequired` | Выберите способ связи. | Please choose how you would like us to contact you. |
| `form.unavailable` | Отправка заявки пока не подключена. Попробуйте связаться с нами напрямую. | The enquiry form is not available yet. Please contact us directly. |
| `form.sending` | Отправляем заявку… | Sending your enquiry… |
| `form.error` | Не удалось отправить заявку. Попробуйте еще раз чуть позже. | We could not send your enquiry. Please try again shortly. |
| `phone.chooseCountry` | Выбрать страну: {country} {dial} | Choose a country: {country} {dial} |
| `search.label` | Поиск | Search |
| `search.aria` | Поиск по Ada Tours | Search Ada Tours |
| `search.close` | Закрыть поиск | Close search |
| `search.placeholder` | Бразилия, Рио, тур, экскурсия... | Brazil, Rio, tour, excursion… |
| `search.minimum` | Начните вводить от 2 символов. | Enter at least 2 characters to start searching. |
| `search.resultType` | Тип результата | Result type |
| `search.all` | Все | All |
| `search.places` | Места | Places |
| `search.untitled` | Без названия | Untitled |
| `search.start` | Ищите страну, место, тур или экскурсию. | Search for a country, place, tour or excursion. |
| `search.oneMore` | Введите еще 1 символ. | Enter 1 more character. |
| `search.loading` | Ищу... | Searching… |
| `search.empty` | Ничего не найдено. Попробуйте другое название или вариант написания. | No results found. Try another name or spelling. |
| `search.limited` | Показано: {count} (максимум {max}). Уточните запрос. | Showing {count} results (maximum {max}). Refine your search. |
| `search.found` | Найдено: {count} | Results found: {count} |
| `search.unavailable` | Поиск временно недоступен. | Search is temporarily unavailable. |
| `map.results` | Найденные места на карте | Places found on the map |
| `map.searchAria` | Карта результатов поиска | Search results map |
| `map.minimum` | Введите хотя бы 2 символа, чтобы увидеть места на карте. | Enter at least 2 characters to see places on the map. |
| `map.closePlace` | Закрыть описание места | Close place description |
| `map.placeMore` | Подробнее о месте | More about this place |
| `map.showPlace` | {place}: показать место | {place}: show place |
| `map.showDescription` | {place}: показать описание | {place}: show description |
| `map.unavailable` | Карта временно недоступна. Список мест работает. | The map is temporarily unavailable. You can still browse the list of places. |
| `map.updating` | Обновляем места на карте… | Updating places on the map… |
| `map.noCoordinates` | У найденных мест пока нет подтвержденных координат. | Map locations are not yet available for these places. |
| `map.loading` | Загружаем карту… | Loading the map… |
| `map.dataError` | Ошибка данных карты (GEO_DATA). | The map could not be loaded. |
| `map.apiUnavailable` | Картографический API еще не настроен. | The map is not available yet. |
| `pagination.showing` | Показано {from}–{to} из {total} | Showing {from}–{to} of {total} |
| `pagination.more` | Показать еще | Show more |
| `pagination.pagesAria` | Страницы каталога | Catalogue pages |
| `pagination.previous` | Назад | Previous |
| `pagination.next` | Далее | Next |
| `pagination.currentAria` | Страница {page}, текущая | Page {page}, current page |
| `pagination.pageAria` | Страница {page} | Page {page} |
| `pagination.first` | На первую страницу каталога | Back to the first catalogue page |
| `pagination.loading` | Загружаем… | Loading… |
| `pagination.added` | Добавлено: {count}. | Added: {count}. |
| `pagination.complete` | Все оставшиеся объекты загружены. | All remaining items have been loaded. |
| `pagination.error` | Не удалось подгрузить список. Попробуйте еще раз или перейдите по номеру страницы. | We could not load more results. Please try again or select a page number. |
| `filter.country` | Страна | Country |
| `filter.chooseCountry` | Выбрать страну | Choose a country |
| `filter.interest` | Интерес | Interest |
| `filter.chooseInterest` | Выбрать интерес | Choose an interest |
| `filter.toursAria` | Подбор туров | Find a tour |
| `filter.vipAria` | Подбор VIP-туров | Find a VIP tour |
| `filter.noVip` | Для этой подборки пока нет VIP-туров. | There are no VIP tours in this selection yet. |
| `filter.allSelection` | Все туры этой подборки | All tours in this selection |
| `filter.vipSelection` | VIP-туры этой подборки | VIP tours in this selection |
| `multi.combinations` | Сочетания стран | Country combinations |
| `multi.addCountry` | Добавить страну | Add a country |
| `multi.combinationsWith` | Сочетания с {country} | Combinations with {country} |
| `multi.addTo` | Добавить страну к сочетанию {countries} | Add a country to {countries} |
| `multi.addSecond` | Добавить вторую страну к {country} | Add a second country to {country} |
| `multi.addThird` | Добавить третью страну | Add a third country |
| `multi.addFourth` | Добавить четвертую страну | Add a fourth country |
| `multi.firstCountry` | Первая страна | First country |
| `multi.secondCountry` | Вторая страна | Second country |
| `multi.thirdCountry` | Третья страна | Third country |
| `multi.fourthCountry` | Четвертая страна | Fourth country |
| `multi.selectAria` | Выбор сочетания стран | Choose a country combination |
| `multi.routeCountries` | Страны маршрута | Countries on your route |
| `multi.choose` | Выберите сочетание стран | Choose your country combination |
| `multi.remove` | Убрать выбранную страну: {position} | Remove the selected country: {position} |
| `multi.byInterest` | Подобрать по интересу | Browse by interest |
| `multi.reset` | Сбросить и показать все мультистрановые туры | Reset and show all multi-country tours |
| `multi.allToursTheme` | Все туры: {theme} | All tours: {theme} |
| `multi.aboutTheme` | Об интересе: {theme} | About this interest: {theme} |
| `multi.allInterestsCountries` | Все интересы: {countries} | All interests: {countries} |
| `multi.allCombinationsTheme` | Все сочетания стран: {theme} | All country combinations: {theme} |
| `multi.severalCountriesTheme` | По нескольким странам: {theme} | Across several countries: {theme} |
| `multi.travelCountriesInterests` | Путешествия по странам и интересам | Travel by country and interest |
| `multi.relatedCatalogues` | Связанные каталоги | Related catalogues |
| `tour.highlights` | Главные впечатления | Highlights |
| `tour.route` | Маршрут | Itinerary |
| `tour.itineraryLength` | {days} путешествия | Your journey: {days} |
| `tour.excursionMore` | Подробнее об экскурсии | More about this excursion |
| `tour.vipAria` | VIP-тур | VIP tour |
| `tour.terms` | Условия программы | Programme details |
| `tour.included` | Включено | Included |
| `tour.excluded` | Оплачивается отдельно | Not included |
| `tour.importantTerms` | Важные условия | Important information |
| `tour.price` | Стоимость | Price |
| `tour.onRequest` | По запросу | On request |
| `tour.fromPrice` | от {price} | from {price} |
| `tour.optional` | Факультативно | Optional |
| `tour.duration` | Продолжительность | Duration |
| `tour.format` | Формат | Travel style |
| `tour.dates` | Даты | Dates |
| `tour.groupSize` | Размер группы | Group size |
| `tour.guideLanguage` | Язык гида | Guide language |
| `tour.nextPlaces` | Куда поехать дальше | Where to go next |
| `interest.tripAria` | Интересы поездки | Travel interests |
| `archive.tour` | Архивный тур | Archived tour |
| `archive.excursion` | Архивная экскурсия | Archived excursion |
| `archive.notice` | Страница сохранена для справки. Эта программа больше не входит в актуальный каталог; прежние даты и цены не являются действующим предложением. | We have kept this page for reference. This programme is no longer in our current catalogue, and its previous dates and prices no longer apply. |
| `archive.replacement` | Перейти к актуальной программе | View the current programme |
| `archive.lead` | Подобрать другую поездку | Find another trip |
| `video.play` | Воспроизвести видео | Play video |
| `video.pause` | Приостановить видео | Pause video |
| `error404.title` | Страница не найдена | Page not found |
| `error404.description` | Страница не найдена. Вернитесь на главную Ada Tours или перейдите к направлениям. | Page not found. Return to the Ada Tours home page or explore our destinations. |
| `error404.heading` | Маршрут изменился | The route has changed |
| `error404.body` | Такой страницы нет. Можно вернуться на главную или выбрать другое направление. | This page is not here. You can return to the home page or choose another destination. |
| `faq.title` | Частые вопросы | Frequently asked questions |
| `language.ru` | Русский | Русский |
| `language.en` | English | English |
| `language.choose` | Выбрать язык | Choose a language |
| `interest.theme_adventure` | Приключения | Adventure |
| `interest.theme_nature` | Природа | Nature |
| `interest.theme_wildlife` | Животные и сафари | Wildlife and safaris |
| `interest.theme_culture` | Культура и история | Culture and history |
| `interest.theme_cruises` | Круизы и экспедиции | Cruises and expeditions |
| `interest.theme_events` | События и праздники | Events and festivals |
| `interest.theme_beach` | Пляжный отдых | Beach holidays |
| `interest.theme_gastronomy_wine` | Гастрономия и вино | Food and wine |
| `interest.theme_fishing` | Рыболовные туры | Fishing tours |
| `interest.theme_diving` | Дайвинг | Diving |
| `interest.theme_motorcycle` | Мото-туры | Motorcycle tours |
| `interest.theme_family` | Туры с детьми | Family tours |
| `interest.theme_spa` | SPA и wellness | Spa and wellness |
| `interest.theme_weddings_romance` | Свадьбы и романтические путешествия | Weddings and romantic travel |
| `interest.theme_coffee` | Кофейные туры | Coffee tours |
