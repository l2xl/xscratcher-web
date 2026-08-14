# План SEO-оптимизации сайта The Scratcher Project

Домен: `thescratcherproject.com`
Дата составления: 2026-08-14

---

## Резюме аудита

Сайт технически чистый (валидная семантика, один `<h1>` на страницу, SVG вместо растра,
нет бандлеров и тяжёлого JS), но **полностью лишён SEO-обвязки**. Ни одной канонической
ссылки, нет `robots.txt`, `sitemap.xml`, `hreflang`, Open Graph и структурированных данных.

### Найденные проблемы

| # | Проблема | Критичность |
|---|---|---|
| 1 | Каждая ветка деплоится в `/var/www/scratcher/<branch>/` — потенциально N публичных копий сайта | 🔴 критично |
| 2 | На EN-страницах нет ни одной ссылки на `/ru/` — русская версия недоступна краулеру | 🔴 критично |
| 3 | Нет `robots.txt` и `sitemap.xml` | 🔴 критично |
| 4 | Нет `rel=canonical` на боевых страницах | 🔴 критично |
| 5 | Нет `hreflang` между EN и RU | 🟠 высокая |
| 6 | `market/browser-test.html`, `market/chart-test.html` открыты для индексации | 🟠 высокая |
| 7 | RU-заголовки дублируют EN дословно | 🟠 высокая |
| 8 | Нет Open Graph / Twitter Card → пустые превью в Telegram, X, Slack | 🟠 высокая |
| 9 | `x-cockpit.html` использует meta-refresh вместо серверного 301 | 🟡 средняя |
| 10 | Нет структурированных данных (JSON-LD) | 🟡 средняя |
| 11 | Нет favicon | 🟡 средняя |
| 12 | `/index.html` и `/` — потенциальный дубль | 🟡 средняя |
| 13 | Объём контента мал — ранжироваться не за что | 🟠 высокая (долгосрочно) |

Отдельно отмечу, что `investor/` уже корректно закрыт `<meta name="robots" content="noindex, nofollow">` — это правильно и менять не нужно.

---

## Фаза 0 — Измерения

**Срок: 0.5 дня. Выполняется до любых правок, иначе не с чем будет сравнивать.**

1. Подтвердить домен в **Google Search Console** (DNS-верификация, домен целиком — покроет и поддомены).
2. Подтвердить в **Яндекс.Вебмастере** — для RU-версии это основной источник.
3. Подтвердить в **Bing Webmaster Tools** — Bing питает ответы ряда AI-поисковиков.
4. Поставить аналитику без cookie-баннера: **Plausible** или самохостящийся **Umami**.
   Google Analytics потребует cookie-баннер (GDPR), а баннер ухудшает CLS и поведенческие.
5. Зафиксировать стартовые метрики: число проиндексированных URL, показы/клики, средняя позиция, Core Web Vitals.

---

## Фаза 1 — Технический фундамент

**Срок: 1–2 дня. Критично — это блокеры индексации.**

### 1.1 `robots.txt` в корне

```
User-agent: *
Allow: /

Disallow: /investor/
Disallow: /market/browser-test.html
Disallow: /market/chart-test.html

Sitemap: https://thescratcherproject.com/sitemap.xml
```

Ветковые деплои закрываются на уровне Nginx (см. 1.4), а не только здесь — `robots.txt`
не защищает от индексации, если на URL стоят внешние ссылки.

### 1.2 `sitemap.xml`

Включить 12 боевых страниц (6 EN + 6 RU). **Не включать**: `investor/*`, `market/*-test.html`,
`x-cockpit.html`, `ru/x-cockpit.html`. Каждый URL сопровождается блоком альтернатив:

```xml
<url>
  <loc>https://thescratcherproject.com/open-trader.html</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://thescratcherproject.com/open-trader.html"/>
  <xhtml:link rel="alternate" hreflang="ru" href="https://thescratcherproject.com/ru/open-trader.html"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://thescratcherproject.com/open-trader.html"/>
  <lastmod>2026-08-14</lastmod>
</url>
```

### 1.3 `rel=canonical` на всех боевых страницах

Абсолютный URL, самоссылающийся. В `<head>` каждой из 12 страниц:

```html
<link rel="canonical" href="https://thescratcherproject.com/open-trader.html" />
```

Для `ru/*` канонический URL указывает на саму русскую страницу, **не** на английскую —
это самостоятельные версии, а не дубли.

### 1.4 Изоляция ветковых деплоев

В `.github/workflows/deploy.yml` ветки уходят в `/var/www/scratcher/<branch>/`.
Если эти пути доступны публично — это полные дубли сайта.

Варианты, в порядке предпочтения:

1. **Отдавать превью-ветки на отдельном поддомене** `preview.thescratcherproject.com`
   с `X-Robots-Tag: noindex, nofollow` на весь поддомен и HTTP Basic Auth.
2. **Минимум** — в Nginx на основном домене:

```nginx
location ~ ^/(?!ru/|css/|js/|assets/|market/|investor/)[a-zA-Z0-9._-]+/ {
    add_header X-Robots-Tag "noindex, nofollow" always;
}
```

Плюс `Disallow:` для известных префиксов веток в `robots.txt`.

### 1.5 Тестовые страницы

`market/browser-test.html` и `market/chart-test.html` — добавить в `<head>`:

```html
<meta name="robots" content="noindex, nofollow" />
```

Либо, что чище, вынести их из деплоя через `--exclude` в rsync-шаге workflow.

### 1.6 Серверные 301 вместо meta-refresh

`x-cockpit.html` и `ru/x-cockpit.html` — meta-refresh передаёт вес хуже, чем 301.
В конфиге Nginx:

```nginx
location = /x-cockpit.html    { return 301 /open-trader.html; }
location = /ru/x-cockpit.html { return 301 /ru/open-trader.html; }
```

HTML-заглушки можно оставить как страховку на случай отката конфига.

### 1.7 Канонизация корня

`/` и `/index.html` доступны оба. Выбрать `/` как канонический:

```nginx
location = /index.html    { return 301 /; }
location = /ru/index.html { return 301 /ru/; }
```

И проставить соответствующие `canonical`.

### 1.8 Favicon

Сейчас браузер получает 404 на `/favicon.ico`. Сгенерировать из `assets/logo.svg`:
`favicon.ico` (32×32), `apple-touch-icon.png` (180×180), `icon.svg`, `site.webmanifest`.
Это единственное допустимое исключение из правила «только SVG» — оно уже зафиксировано в `CLAUDE.md`.

---

## Фаза 2 — Мультиязычность

**Срок: 1 день. Критично: сейчас русская версия невидима для поисковых систем.**

### 2.1 Взаимные `hreflang`

На каждой EN-странице и её RU-паре — полный набор ссылок:

```html
<link rel="alternate" hreflang="en" href="https://thescratcherproject.com/open-trader.html" />
<link rel="alternate" hreflang="ru" href="https://thescratcherproject.com/ru/open-trader.html" />
<link rel="alternate" hreflang="x-default" href="https://thescratcherproject.com/open-trader.html" />
```

Ссылки обязаны быть взаимными: если EN ссылается на RU, RU обязан ссылаться на EN.
Односторонний `hreflang` игнорируется Google целиком.

### 2.2 Видимый переключатель языка на EN-страницах

**Это главное исправление фазы.** Сейчас `ru/*.html` содержат ссылку `EN` обратно в корень,
а обратной ссылки нет: на английских страницах нет ни одного `<a href="ru/...">`.
Единственный путь в русскую версию — клиентский XHR-редирект в `js/i18n.js`, который
срабатывает только для браузеров с `navigator.language` = `ru`. Googlebot краулит как `en-US`,
редирект не выполняется, ссылок нет — русские страницы не имеют входящих внутренних ссылок.

Добавить в `<ul class="nav-links">` каждой EN-страницы пункт, зеркальный существующему EN-переключателю:

```html
<li><a href="ru/open-trader.html" class="lang-switch"
       onclick="localStorage.setItem('tsp_lang','ru')">RU</a></li>
```

### 2.3 Роль `js/i18n.js`

Скрипт остаётся как UX-удобство, но перестаёт быть единственным путём к локали.
Дополнительно стоит вынести его из блокирующей позиции в `<head>` — добавить атрибут `defer`
или перенести перед `</body>`, чтобы синхронный `XMLHttpRequest`-зонд не задерживал первый рендер.

### 2.4 Уникальные русские метаданные

Сейчас RU-страницы копируют английские `<title>` дословно:
`DataHub — The Scratcher Project`, `The Scratcher Project`, `IP Reserve License — The Scratcher Project`.
Русская выдача так не работает — заголовок должен содержать запрос на русском.

Товарные знаки при этом остаются неизменными и непереведёнными
(`The Scratcher Project`, `The Exchange Scrathpad`, `The Scratcher Assistant`, `DataHub`) —
меняется только окружающий их текст:

| Страница | Текущий `<title>` | Предлагаемый |
|---|---|---|
| `ru/index.html` | The Scratcher Project | The Scratcher Project — open-source инфраструктура для криптотрейдинга |
| `ru/open-trader.html` | Open Trader — The Scratcher Project | Open Trader — открытый торговый терминал для криптобирж \| The Scratcher Project |
| `ru/datahub.html` | DataHub — The Scratcher Project | DataHub — асинхронный конвейер данных на C++ \| The Scratcher Project |
| `ru/iprl.html` | IP Reserve License — The Scratcher Project | IPRL — лицензия с резервированием интеллектуальной собственности \| The Scratcher Project |
| `ru/scratcher-assistant.html` | The Scratcher Assistant — The Scratcher Project | The Scratcher Assistant — AI-ассистент для торговых стратегий \| The Scratcher Project |
| `ru/mission.html` | Миссия — The Scratcher Project | Миссия — три революции: open source, блокчейн и LLM \| The Scratcher Project |

Длина `<title>` — до 60 символов видимой части, `description` — 140–160 символов,
уникальные для каждой страницы, с призывом к действию.

Английские заголовки тоже стоит расширить — `The Scratcher Project` в качестве
`<title>` главной страницы не содержит ни одного целевого запроса.

---

## Фаза 3 — Структурированные данные и социальные превью

**Срок: 1 день.**

### 3.1 JSON-LD

`Organization` — на главных страницах обеих локалей:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "The Scratcher Project",
  "url": "https://thescratcherproject.com",
  "logo": "https://thescratcherproject.com/assets/logo.svg",
  "sameAs": ["https://github.com/l2xl"]
}
</script>
```

`SoftwareApplication` — на `open-trader.html`, `scratcher-assistant.html`, `datahub.html`
(поля `applicationCategory: FinanceApplication`, `operatingSystem`, `offers` с ценой 0,
`license` со ссылкой на IPRL).

`BreadcrumbList` — на всех внутренних страницах.

`FAQPage` — там, где появятся блоки вопросов-ответов (см. фазу 7).

Валидировать через Google Rich Results Test и Schema Markup Validator.

### 3.2 Open Graph и Twitter Card

Сейчас ссылка на сайт в Telegram, X или Slack разворачивается в пустой прямоугольник.
На каждую страницу:

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="The Scratcher Project" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:url" content="https://thescratcherproject.com/open-trader.html" />
<meta property="og:image" content="https://thescratcherproject.com/assets/og/open-trader.png" />
<meta property="og:locale" content="en_US" />
<meta property="og:locale:alternate" content="ru_RU" />
<meta name="twitter:card" content="summary_large_image" />
```

OG-изображения — 1200×630 PNG. Соцсети не рендерят SVG в превью, поэтому здесь растр обязателен;
исходники держать в SVG и экспортировать в PNG (`resvg` или `rsvg-convert`).
Отдельная картинка на каждый продукт.

---

## Фаза 4 — Производительность и Core Web Vitals

**Срок: 0.5 дня.**

Стартовая позиция очень хорошая: нет фреймворков, нет растровой графики, один CSS-файл
на 20 КБ, два маленьких JS. Остаётся серверная часть:

1. **Brotli** (`brotli_static on`) поверх gzip.
2. **Кэширование**: `Cache-Control: public, max-age=31536000, immutable` для `css/`, `assets/`, `market/*.svg`.
   Потребует версионирования файлов — в `investor/` уже используется `investor.css?v=25`,
   тот же подход распространить на `css/style.css`.
3. **HTTP/2 или HTTP/3**, TLS 1.3.
4. **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
5. **Критический CSS** — инлайном в `<head>` для above-the-fold, остальное через `preload`.
6. Проверить, что нет внешних веб-шрифтов; если есть — self-hosted `woff2` + `font-display: swap`.
7. Целевые значения: LCP < 2.5 с, INP < 200 мс, CLS < 0.1.
8. Задать `width`/`height` всем `<img>` (у логотипа уже проставлены — распространить на остальные) для нулевого CLS.

Замер: PageSpeed Insights, WebPageTest, поле CrUX в Search Console.

---

## Фаза 5 — Контент и семантическое ядро

**Срок: 4–8 недель, ведётся параллельно. Это основной драйвер роста.**

Технические правки обеспечат индексацию, но не трафик: шести страниц недостаточно,
чтобы ранжироваться. Главный дефицит сайта — объём содержательного текста.

### 5.1 Стратегия по запросам

Высокочастотные коммерческие запросы (`crypto trading terminal`, `trading bot`) заняты
Binance, Bybit, 3Commas, TradingView — конкурировать бессмысленно.
Целиться нужно в низкочастотный длинный хвост, где важна суть проекта:

**Английский кластер:**
- `open source trading terminal`
- `self-hosted crypto trading bot`
- `keep exchange API keys local`
- `non-custodial trading software`
- `auditable trading terminal`
- `C++ async data pipeline`
- `crypto exchange isolation`
- `LLM trading assistant self-hosted`

**Русский кластер:**
- `открытый торговый терминал`
- `self-hosted криптобот`
- `торговый терминал с открытым кодом`
- `AI ассистент для трейдинга`
- `хранение API-ключей биржи локально`

**Брендовый кластер** (обязателен к защите): `The Scratcher Project`, `Open Trader`,
`The Scratcher Assistant`, `DataHub`, `IPRL`.

### 5.2 Новые разделы

| Раздел | Назначение | Приоритет |
|---|---|---|
| `/docs/` | Документация — установка, конфигурация, API. Самый частый вход из поиска для dev-инструментов | 🔴 |
| `/blog/` | Инженерные статьи: архитектура, решения, разбор проблем | 🟠 |
| `/compare/` | Сравнение с проприетарными терминалами — высокая конверсия из поиска | 🟠 |
| `/faq/` | Прямые вопросы-ответы, кормит и `FAQPage`, и AI-ответы | 🟠 |
| `/changelog/` | Регулярные обновления, сигнал живости проекта | 🟡 |

### 5.3 IPRL как отдельный контентный магнит

`iprl.html` — уникальная тема с почти нулевой конкуренцией в выдаче.
Лицензионная тематика хорошо цитируется и собирает естественные ссылки.
Стоит развернуть в самостоятельный раздел: полный текст лицензии, FAQ, сравнение
с MIT/GPL/BSL/Elastic License, разбор кейсов применения.

### 5.4 Требования к текстам

- Целевые страницы: 1000+ слов содержательного текста.
- Иерархия заголовков `h2`/`h3` с вхождением запросов.
- Перелинковка: каждая страница ссылается на 3–5 связанных.
- Осмысленные анкоры — не `подробнее`, а `как Open Trader изолирует ключи биржи`.
- `alt` у всех изображений и inline-SVG (`<title>` внутри `<svg>`).
- Паритет локализаций сохраняется: изменения в EN сразу отражаются в `ru/`.

---

## Фаза 6 — Внешние сигналы

**Постоянная активность.**

Для open-source проекта ссылочная масса набирается не биржами ссылок, а сообществом:

1. **GitHub** — ссылка на сайт в README всех репозиториев (`l2xl/extools` и др.),
   заполненные topics, описание, ссылка в профиле организации.
2. **Awesome-списки** — `awesome-crypto`, `awesome-trading`, `awesome-cpp`.
3. **Hacker News** — Show HN при релизе.
4. **Reddit** — r/algotrading, r/CryptoCurrency, r/cpp.
5. **Product Hunt** — на публичный релиз.
6. **dev.to / Hashnode** — кросс-посты статей с канонической ссылкой на `/blog/`.
7. **Habr** — для русской аудитории, наиболее эффективный канал.
8. **Telegram / X** — здесь напрямую окупается Open Graph из фазы 3.
9. **Stack Overflow** — ответы по темам, где продукт релевантен, без спама.

Что делать нельзя: покупные ссылки, каталоги, PBN. Для проекта, работающего с ключами
от бирж, репутационный риск несопоставим с выгодой.

---

## Фаза 7 — AEO / GEO: оптимизация под AI-поиск

**Срок: 1 день. Направление, которое сейчас растёт быстрее классического SEO.**

Всё большая доля переходов приходит из ответов ChatGPT, Claude, Perplexity и AI Overviews,
а не из органической выдачи.

1. **`llms.txt` в корне** — краткое машиночитаемое описание проекта, продуктов и ключевых ссылок
   в Markdown. Формат, который де-факто закрепился для представления сайта языковым моделям.
2. **Прямые ответы в тексте.** Формулировка «Open Trader — это открытый торговый терминал,
   который хранит ключи от биржи локально» цитируется, «Мы верим в открытость» — нет.
3. **FAQ-блоки** прямыми вопросами в `h3` + разметка `FAQPage`.
4. **Контент доступен без JavaScript** — у вас это уже так, важно не потерять при развитии.
5. **Не блокировать AI-краулеров** в `robots.txt` (`GPTBot`, `ClaudeBot`, `PerplexityBot`),
   если цель — попадать в ответы. Это осознанное решение: закрыть их можно, но тогда
   проект исчезнет из AI-ответов.
6. **Единообразие фактов** — название, описание и формулировки должны совпадать на сайте,
   в GitHub README и во внешних публикациях. Модели агрегируют упоминания из разных источников.

---

## Фаза 8 — Мониторинг

**Еженедельно:**
- Search Console: показы, клики, CTR, средняя позиция, ошибки индексации.
- Яндекс.Вебмастер: то же для RU.
- Core Web Vitals по полевым данным.
- Проверка на дубли: `site:thescratcherproject.com` — не появились ли ветковые деплои.

**Ежемесячно:**
- Позиции по ядру из фазы 5.
- Профиль ссылок.
- Появление в AI-ответах: проверять вручную запросами в ChatGPT/Perplexity/Claude.
- Обновление `sitemap.xml` при добавлении страниц.

---

## Ожидаемые результаты

| Срок | Результат |
|---|---|
| 2 недели | Все страницы в индексе, RU-версия видима, корректные превью в соцсетях, дубли устранены |
| 1–2 месяца | Топ по брендовым запросам, первые позиции по низкочастотному хвосту |
| 3–6 месяцев | Устойчивый органический трафик по хвосту, появление в AI-ответах, естественная ссылочная масса |

---

## Порядок выполнения

Фазы 1 и 2 — блокеры, всё остальное без них не имеет смысла: пока `/ru/` невидим,
а ветковые деплои плодят дубли, любая работа над контентом обесценивается.
Фазы 3, 4, 7 — быстрые, дают заметный эффект и выполняются за пару дней.
Фазы 5 и 6 — долгие, идут параллельно и определяют итоговый результат.
