# Prototype and content status

Date: 2026-09-24

## Visual baseline

The first Ada Tours visual baseline is accepted by the user on desktop and mobile.

Treat the current global visual system as approved:

- typography scale and overall editorial rhythm;
- color system and gold primary CTA;
- full-bleed hero grammar;
- header and mobile menu direction;
- form styling;
- mobile spacing and separators after the latest QA fixes.

Do not redesign global components or tokens without a concrete defect, a new page requirement, or an explicit user request.

## Prototype coverage

The repository contains working page types for:

- Home;
- Country;
- Destination;
- Tour detail;
- DMC / B2B;
- MICE and business delegations;
- VIP / Luxury;
- Multi-country;
- Cases;
- Reviews;
- Contacts;
- 404.

## Wave 0 status

Status: `partial_pending_owner_confirmation`.

The organization fact passport is implemented and published only with supported facts. Legal name, CNPJ, address, contacts, 7 service languages, group-size ranges and approved B2B facts are centralized in `src/data/organization/ada-tours.ts`.

The following owner fields remain deliberately blocked until Anna confirms them:

1. canonical company-history wording / founding year;
2. exact support model and whether a 24/7 claim is allowed;
3. white-label policy;
4. client relationship ownership;
5. whether net rates may be stated publicly;
6. response / quotation time;
7. cancellation-policy principle;
8. current memberships / associations;
9. numeric claims such as 10,000+ clients, 1,900 tourists and 50+ countries.

Do not infer or publish these claims from old pages or third-party profiles.

## Wave 1 status

Status: **closed / approved** on 2026-09-24.

Approved production content includes:

- Home;
- About;
- DMC;
- DMC for travel agencies;
- B2B terms;
- MICE;
- business delegations;
- VIP / Luxury;
- Multi-country;
- Brazil;
- Argentina;
- Peru;
- Anna Avanesova;
- 9 priority themes: fishing, motorcycle tours, gastronomy and wine, family travel, diving, beach travel, adventure, SPA and wellness, weddings and romance.

Google Drive `03_content/themes` is synchronized and contains 9 separate APPROVED theme documents.

## Wave 1 technical QA

Production artifact from commit `ada9e02` / GitHub Pages deploy run #98 was checked after the global breadcrumb and structured-data changes.

Result:

- deploy: success;
- 47 generated index pages checked for core JSON-LD;
- every page contains valid Organization/TravelAgency, WebSite and WebPage schema;
- every internal page contains BreadcrumbList schema and visible breadcrumbs;
- Home contains neither visible breadcrumbs nor BreadcrumbList;
- Anna's profile additionally contains Person schema;
- rendered spot-checks at 1440×900 and 390×844 found no overlap between header, breadcrumbs and H1 on About, DMC, MICE, VIP, Multi-country and Brazil.

## Wave 2 priority batch

Status: **content approved; reviews implementation added on 2026-09-24**.

Approved content in the priority batch:

- Brazil destinations: Rio de Janeiro, Foz do Iguacu, Manaus / Amazon, Pantanal;
- Argentina destinations: Buenos Aires, El Calafate, Mendoza;
- Peru destinations: Cusco, Lima, Machu Picchu;
- priority tours: Luxury Brazil, Brazil + Argentina + Peru, Peru 8 days;
- cases: business delegation in Sao Paulo / Campinas, corporate group in Rio / Angra;
- reviews: 8 curated public client and partner excerpts with source traceability.

The latest production deploy before the reviews implementation was run #115 for commit `3797657`, conclusion `success`.

## Current phase

Wave 3 scale-out is in progress.

Approved Wave 3 Brazil destinations now in production content:

- Bonito;
- Buzios;
- Paraty;
- Salvador;
- Sao Paulo;
- Angra dos Reis;
- Ilha Grande;
- Lencois Maranhenses.

The second Wave 3 destination batch is synchronized with Google Drive and needs the normal final deploy/regression check before the next content package.

Wave 3 order remains value-first, not alphabetical:

1. expand the strongest country/destination clusters;
2. add additional high-value tours tied to approved destinations and themes;
3. add excursions only after the destination/tour relation is stable;
4. keep the full 700+ queue gated by template quality and regression checks.

The accepted global design system remains frozen unless QA exposes a concrete defect.
