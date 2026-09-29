# Tour itinerary layout rules

This document fixes the approved layout behavior for the day-by-day tour program.

## Scope

Applies to the itinerary block rendered by:

`src/components/tour/Itinerary.astro`

and therefore to all tour pages that use the shared tour layout.

## Desktop rule: two-column itinerary

At desktop width (`min-width: 1100px`) itinerary cards are arranged in two columns.

All itinerary items are collapsed by default. In the collapsed state the photograph remains visible directly below the summary row, while places/direction and descriptive text stay hidden until the user opens the item.

Collapsed desktop photographs use the same 16:9 presentation, so all closed itinerary cards show media at one consistent size.

The collapsed summary must sit visually halfway between the photograph above and its own photograph below. Keep the outer gap compact and symmetric: desktop uses 18 px below the preceding card media and 18 px above the next collapsed media; mobile uses 10 px + 10 px. On desktop the summary row reserves 126 px, enough for titles up to three lines at the current type scale, so neighboring cards keep one common black-band height instead of forming a staircase. Mobile remains content-driven with a 76 px minimum because it is single-column.

There are no horizontal divider lines above or below itinerary cards. The always-visible photographs themselves separate one itinerary item from the next, on both desktop and mobile.

When an item is opened, its media leaves the fixed collapsed ratio and returns to the flexible desktop behavior below.

For every pair of neighboring **opened** cards in one grid row:

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

- every item is collapsed by default;
- collapsed media remains visible and uses the same 16:9 size across cards;
- opening an item reveals places/direction, text, and subsections;
- opened image height may vary from the image in the neighboring opened card;
- opened media should fill the remaining card height within the established min/max bounds;
- use `object-fit: cover`;
- keep the bottom edge aligned with the neighboring opened card where the pair is expanded.

Mobile:

- itinerary is single-column;
- every itinerary item is **collapsed by default**;
- the collapsed state shows the summary row only (day number when present, title, and the plus control) plus the item's photograph directly below it;
- places/direction, descriptive text, and subsections stay hidden until the user opens the item;
- the photograph remains visible in both collapsed and expanded states because `.day__media` stays outside `<details>`;
- ordinary days keep their two-digit day number; additional-excursion items keep the number position empty;
- opening the plus reveals the same full content as before; closing it hides the text again but never hides the mobile photograph;
- the desktop paired-card alignment rule does not apply;
- mobile itinerary photos keep their **original source aspect ratio**;
- do not crop, stretch, compress, or force any common aspect ratio on mobile;
- the image is rendered as `width: 100%` and `height: auto`; therefore different source photos may legitimately have different heights;
- do not put `aspect-ratio: 16 / 9`, a fixed height, `height: 100%`, or `object-fit: cover` on mobile itinerary media;
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
