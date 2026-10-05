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

Desktop rows with multiple itinerary photographs use a shared media budget.

One full desktop photo slot is the normal 16:9 height of the current itinerary column, capped by the established 660 px opened-media maximum. The 16 px gaps between photographs are added on top of those slots.

For every desktop grid row:

- if both cards have photographs and the counts differ, the row media budget is based on the **smaller photograph count**;
- if both cards have the same count and that count is greater than 1, reserve one full slot for **every** photograph: 2 + 2 reserves 2 slots, 5 + 5 reserves 5 slots;
- an unpaired final card with more than 1 photograph uses its own photograph count;
- rows where both cards have only 1 photograph keep the ordinary existing behavior;
- a row containing a card without photographs keeps the text-card behavior and is not forced into the multi-photo calculation.

When the row is collapsed, its height is the governing summary height plus the shared media budget. When either card is opened, the row expands up to the fully opened content height of the governing card with the smaller photograph count, plus that same shared media budget. If the counts are equal, the larger fully opened text height of the two cards governs.

The card with more photographs must fit its text and photographs **inside that same row height**. Its media area shrinks as necessary and divides the available height across its additional photographs instead of making the whole row taller.

The **bottom edges of the media blocks stay aligned on one horizontal line**. A governing card is allowed to show each photograph at its full desktop slot height; a neighboring card with more photographs may show each individual photograph shorter. This is intentional.

Opening a desktop itinerary card must never make its visual row shorter than the same row in the collapsed state. The opened media keeps at least the collapsed 16:9 media height, with the expanded-content gap added above it. Therefore revealing text can keep the next row in place or move it downward, but it must never pull the next row upward.

The invariant is: **row height is governed by the smaller photograph count; equal counts reserve that full number of photograph slots; media bottoms align; mobile is unaffected**.

## Desktop paired toggle behavior

At desktop width, the two itinerary cards occupying one visual row behave as one accordion pair when both cards have photographs and therefore show active plus/cross controls.

- clicking the plus on either card opens both cards in that row;
- clicking the cross on either card closes both cards in that row;
- day/day, excursion/excursion and day/excursion pairs follow the same rule;
- an incomplete final row continues to toggle its single card normally;
- the user's viewport must stay anchored on the summary that was clicked: opening or closing a pair must not jump the page to the next row;
- desktop scroll anchoring is disabled inside the itinerary and the clicked summary position is restored during the row-size recalculation;
- mobile keeps the existing independent single-card accordion behavior.

A no-photo desktop card remains in its existing static-text mode. If such a card shares a row with an interactive photo card, that special no-photo behavior is preserved rather than forcing it into the paired accordion.

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
- collapsed media remains visible;
- a single full photo slot uses the normal 16:9 column height, capped at 660 px;
- rows with multiple photographs use the photograph-count rule above instead of squeezing every count into one 16:9 media block;
- opening an item reveals places/direction, text, and subsections;
- the governing card may show its photographs at the full slot height, while a neighboring card with more photographs divides the same media budget among them;
- use `object-fit: cover`;
- keep the bottom edge aligned across the desktop row.

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

## Duplicate headings inside descriptions

The itinerary card already renders the day or excursion title in its summary row. Therefore a day description or canonical Excursion Markdown body must not begin with another Markdown/HTML heading that repeats that same title.

Content maintenance removes such leading duplicates from source MD. The shared itinerary renderer also strips a matching leading rendered heading from canonical excursion HTML as a defensive fallback, so a repeated source heading can never become a second oversized title inside a tour.

## Inline bold

Structured text may contain Markdown-style `**bold text**`.

The shared inline renderer converts these markers to ordinary HTML `<strong>` without displaying the asterisks. Do not add special visual styling for `<strong>`; use the site's normal typography.

If the source did not contain bold, do not introduce it merely for formatting.

## Approved reference

The behavior was visually accepted on the 17-day Brazil tour after refactoring the itinerary card so that media is outside `<details>` and aligned by the outer `.day-card`.

Reference page while the site is on GitHub Pages:

https://alexyakovlev79.github.io/adatours.ru/brazil/tour/grand-brazil-adventure-17-days/



## Tour gallery block

The standalone «Фотографии маршрута» / route-photo gallery is not rendered on tour pages. Legacy gallery media may remain in structured data when needed for other editorial slots, but do not output a separate route-photo gallery block in the tour layout.
