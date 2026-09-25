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

The accepted global visual system remains frozen unless regression QA exposes a concrete defect.

### Current production coverage

After the latest value-first Brazil batches, production content contains:

- **29 approved Brazil destination entities**;
- the 4 Wave 2 priority Brazil destinations: Rio de Janeiro, Foz do Iguacu, Manaus / Amazon and Pantanal;
- 25 additional Brazil destinations added during Wave 3;
- **7 approved Wave 3 tours** on top of the 3 Wave 2 priority tours.

The newest destination package expands 2 already established clusters:

- Bahia: Itacare, Morro de Sao Paulo and Porto Seguro;
- Minas Gerais: Belo Horizonte, linked to the existing Ouro Preto content and the Brazil gems route.

The 4 newest approved Drive copies are synchronized with their production Markdown files.

### Latest Wave 3 Brazil destinations in main

The repository currently contains these approved Brazil destination entities:

- Rio de Janeiro;
- Foz do Iguacu;
- Manaus / Amazon;
- Pantanal;
- Bonito;
- Buzios;
- Paraty;
- Sao Paulo;
- Angra dos Reis;
- Ilha Grande;
- Lencois Maranhenses;
- Sao Luis;
- Recife;
- Olinda;
- Porto de Galinhas;
- Fernando de Noronha;
- Ouro Preto;
- Praia do Forte;
- Natal;
- Praia de Pipa;
- Brasilia;
- Fortaleza;
- Jericoacoara;
- Costa do Sauipe;
- Itacare;
- Morro de Sao Paulo;
- Porto Seguro;
- Belo Horizonte;
- Salvador.

### Approved Wave 3 tours in main

- Sao Paulo + Iguacu + Rio + Ilha Grande + Paraty, 12 days;
- Brazil adventure, 17 days;
- Pantanal + Bonito + Lencois Maranhenses, 8 days;
- Northeast Brazil: Recife + Olinda + Porto de Galinhas + Fernando de Noronha, 10 days;
- Brazil gems: Rio + Ouro Preto + Salvador + Praia do Forte + Iguacu, 14 days;
- Brazil dunes: Rio + Iguacu + Lencois Maranhenses + Praia de Pipa, 13 days;
- Argentina + Brazil with Praia de Pipa, 11 days.

### Wave 3 execution order

Continue value-first, not alphabetically:

1. finish strong destination clusters before opening thin isolated pages;
2. add high-value tours tied to approved destinations and themes;
3. add excursions only after destination/tour relations are stable;
4. keep the full 700+ queue gated by build and rendered regression QA.

The next content package should be chosen from the inventory and original snapshots, with Drive approved copy and GitHub production content kept synchronized.
