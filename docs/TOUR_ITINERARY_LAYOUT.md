# Tour itinerary layout rules

This document fixes the approved layout behavior for the day-by-day tour program.

## Scope

Applies to the itinerary block rendered by:

`src/components/tour/Itinerary.astro`

and therefore to all tour pages that use the shared tour layout.

## Desktop rule: two-column itinerary

At desktop width (`min-width: 1100px`) itinerary cards are arranged in two columns.

For every pair of neighboring cards in one grid row:

- the **bottom edges of the photographs must align on one horizontal line**;
- the distance from both photographs to the next pair of cards must be the same;
- the text blocks above the photographs may have different heights;
- if one card has less text, its photograph may be taller and extend farther upward to occupy part of the spare vertical space;
- photographs do **not** need equal heights;
- photographs must **not** be forced to a common desktop aspect ratio such as 16:9 merely to make the pair look aligned.

The invariant is **equal bottom alignment of the media blocks, not equal image height and not equal top alignment**.

## Required DOM structure

Each itinerary item must keep this structure conceptually:

```
.day-card
  <details class="day">
    summary
    .day__content
  </details>
  .day__media
```

The media block must remain a **sibling of `<details>` inside `.day-card`**.

Do not move `.day__media` back inside `<details>`. When media is nested inside `<details>`, the browser does not allow the outer grid row to distribute the remaining vertical space correctly, and the two neighboring images end at different vertical positions.

The `.day-card` itself is the object that stretches to the full height of its CSS Grid row. The media block uses the remaining height and is anchored at the bottom of the card.

## Image behavior

Desktop:

- image height may vary from the image in the neighboring card;
- media should fill the remaining card height within the established min/max bounds;
- use `object-fit: cover`;
- keep the bottom edge aligned with the neighboring card.

Mobile:

- itinerary is single-column;
- the desktop paired-card alignment rule does not apply;
- the existing mobile 16:9 presentation is allowed;
- itinerary photographs are full-bleed: each photo reaches both the left and right viewport edges, with no content gutter on either side.

## Additional excursions

Optional excursions that belong in the chronological itinerary are standalone itinerary entries, not subsections or extra images of a day.

Examples:

- «Макуко Сафари», дополнительно;
- «Парк птиц», дополнительно.

They use the same visual card structure as ordinary days, may have their own photograph, and are inserted at the same point in the sequence as in the source program. They do not increase the advertised number of tour days.

Additional-excursion cards have no visible numeric/day label. Do not render «ДОП.» or any other gold label in the number column; keep that position visually empty.

## Inline bold

Structured text may contain Markdown-style `**bold text**`.

The shared inline renderer converts these markers to ordinary HTML `<strong>` without displaying the asterisks. Do not add special visual styling for `<strong>`; use the site's normal typography.

If the source did not contain bold, do not introduce it merely for formatting.

## Approved reference

The behavior was visually accepted on the 17-day Brazil tour after refactoring the itinerary card so that media is outside `<details>` and aligned by the outer `.day-card`.

Reference page while the site is on GitHub Pages:

https://alexyakovlev79.github.io/adatours.ru/tury/bolshoe-priklyuchenie-braziliya-17-dnej/



## Tour gallery block

The standalone «Фотографии маршрута» / route-photo gallery is not rendered on tour pages. Legacy gallery media may remain in structured data when needed for other editorial slots, but do not output a separate route-photo gallery block in the tour layout.
