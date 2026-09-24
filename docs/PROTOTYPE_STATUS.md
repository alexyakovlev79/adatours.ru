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

The repository already contains prototypes for:

- Home;
- Brazil country page;
- Rio de Janeiro destination page;
- full tour page;
- DMC;
- MICE;
- business delegations;
- VIP / Luxury;
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

## Current phase

Proceed to Content Wave 2 without changing the accepted global design system.

Priority order from the master blueprint:

1. Brazil destinations;
2. Argentina destinations;
3. Peru destinations;
4. priority tours;
5. cases;
6. reviews.

Bulk generation of the full 700+ page queue is still deferred until Wave 2 templates and content quality are stable.
