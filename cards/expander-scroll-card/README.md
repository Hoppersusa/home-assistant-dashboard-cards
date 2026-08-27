# Expander Scroll Card

A Home Assistant Lovelace card derived from
[Alia5/lovelace-expander-card](https://github.com/Alia5/lovelace-expander-card),
with a configurable collapsed preview height and optional scrolling while the
card is collapsed.

## What is different

- `collapsed-min-height` leaves a visible child-card viewport when collapsed.
- `collapsed-scroll` makes that collapsed viewport vertically scrollable.
- A small scroll indicator appears only when additional content is available.
- Touch scrolling, mouse-wheel scrolling, keyboard focus, reduced-motion, and
  overscroll containment are supported.
- Existing Expander Card concepts remain available: child cards, title cards,
  clear backgrounds, overlay toggle, gaps, padding, saved state, and nesting.
- Includes a graphical editor for settings, title card, and child cards.
- Supports native Home Assistant card visibility and Sections layout settings.

## Installation

1. Copy `expander-scroll-card.js` into `/config/www/expander-scroll-card/`.
2. In Home Assistant, open **Settings → Dashboards → Resources**.
3. Add the following resource as a **JavaScript module**:

   ```text
   /local/expander-scroll-card/expander-scroll-card.js?v=1.0.0
   ```

4. Refresh the dashboard and add **Expander Scroll Card**.

## Scrollable collapsed preview

```yaml
type: custom:expander-scroll-card
title: Downstairs lights
collapsed-min-height: 150px
collapsed-scroll: true
cards:
  - type: entities
    entities:
      - light.living_room
      - light.kitchen
      - light.dining_room
      - light.hallway
      - light.porch
```

When expanded, the complete child-card stack is displayed normally. When
collapsed, a 150-pixel viewport remains visible and can be scrolled. Set
`collapsed-min-height: 0px` to retain the original fully-hidden behavior.

## Clipped collapsed preview

The preview can remain visible without allowing interaction with content below
its boundary:

```yaml
type: custom:expander-scroll-card
title: Climate summary
collapsed-min-height: 96px
collapsed-scroll: false
cards:
  - type: thermostat
    entity: climate.home
```

## Saved expanded state

```yaml
type: custom:expander-scroll-card
title: Servers
expand-id: server-panel
expanded: false
collapsed-min-height: 120px
collapsed-scroll: true
cards:
  - type: entities
    entities:
      - sensor.server_temperature
      - sensor.server_load
      - sensor.server_storage
```

`expand-id` stores the expanded/collapsed state in the browser's local storage.
Each expander should use a unique ID.

## Title card and overlay toggle

```yaml
type: custom:expander-scroll-card
collapsed-min-height: 110px
collapsed-scroll: true
title-card:
  type: tile
  entity: light.living_room
title-card-padding: 0px
title-card-button-overlay: true
overlay-margin: 12px
cards:
  - type: entities
    entities:
      - light.floor_lamp
      - light.table_lamp
```

## Nested expanders

```yaml
type: custom:expander-scroll-card
title: House
collapsed-min-height: 140px
collapsed-scroll: true
cards:
  - type: custom:expander-scroll-card
    title: Upstairs
    cards:
      - type: entities
        entities:
          - light.bedroom
          - light.office
  - type: custom:expander-scroll-card
    title: Downstairs
    cards:
      - type: entities
        entities:
          - light.kitchen
          - light.living_room
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | required | `custom:expander-scroll-card` |
| `title` | string | `Expander` | Header text when no title card is configured. |
| `cards` | list | `[]` | Child Lovelace card configurations. |
| `expanded` | boolean | `false` | Initial expanded state. |
| `expand-id` | string | unset | Unique local-storage key for saved state. |
| `collapsed-min-height` | CSS size | `0px` | Visible child viewport while collapsed. Numeric values are pixels. |
| `collapsed-scroll` | boolean | `false` | Permit vertical scrolling inside the collapsed viewport. |
| `transition-duration` | CSS time | `0.5s` | Expand/collapse animation duration. |
| `clear` | boolean | `false` | Remove the outer background, border, and shadow. |
| `clear-children` | boolean | `false` | Remove backgrounds, borders, and shadows from child cards. |
| `button-background` | CSS color | `transparent` | Toggle-button background. |
| `gap` | CSS size | `0.6em` | Gap between child cards. |
| `padding` | CSS size | `1em` | Outer card padding. |
| `child-padding` | CSS size | `0.5em` | Padding inside the child viewport. |
| `title-card` | card | unset | Lovelace card used in place of the text title. |
| `title-card-padding` | CSS size | `0px` | Padding around the title card. |
| `title-card-button-overlay` | boolean | `false` | Overlay the toggle on the title card. |
| `overlay-margin` | CSS size | `2em` | Toggle offset when overlay mode is enabled. |
| `card-width` | CSS size | `100%` | Card width within its dashboard column. |
| `max-width` | CSS size | `none` | Optional maximum width. |

Underscore aliases `collapsed_min_height`, `collapsed_scroll`, `card_width`,
and `max_width` are accepted for compatibility with generated configurations.

## Native visibility and layout

Home Assistant processes `visibility` and `grid_options` as standard top-level
card settings:

```yaml
type: custom:expander-scroll-card
title: Conditional controls
collapsed-min-height: 120px
collapsed-scroll: true
grid_options:
  columns: 6
  rows: auto
visibility:
  - condition: state
    entity: input_boolean.show_controls
    state: "on"
cards:
  - type: entities
    entities:
      - switch.workbench
```

## Migrating from Expander Card

Change the card type and add the new settings. The other options can remain
unchanged:

```diff
- type: custom:expander-card
+ type: custom:expander-scroll-card
  title: Lights
+ collapsed-min-height: 140px
+ collapsed-scroll: true
  cards:
    - type: entities
      entities:
        - light.living_room
```

This card uses its own custom-element name, so it can be installed alongside
the original Expander Card.

## Notes

- Scrolling needs a non-zero `collapsed-min-height`; a zero-height viewport has
  no visible scroll area.
- The collapsed scroll area deliberately contains wheel/touch overscroll so a
  user reaches its boundary before the dashboard itself resumes scrolling.
- Some child cards may have controls near their top edge. Those controls remain
  interactive when they are visible in a scrollable collapsed preview.

## License and attribution

Apache License 2.0. See `LICENSE` and `NOTICE`.

The original Expander Card is copyright 2021–2022 Peter Repukat / FlatspotSoftware.
Modified files are prominently identified in their source headers.

