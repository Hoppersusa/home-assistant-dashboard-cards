# Worldclock Sun Card

A standalone Home Assistant Lovelace card that shows the current time and date at each configured location. Every row uses a sun or moon icon based on the Sun's actual position at that location—not a fixed daytime schedule.

## Features

- Local time and current date for every IANA time zone
- Optional bundled SVG country flag before each location's sun/moon icon
- Purpose-built inline SVG sun and moon with subtle internal animation
- Sun icon while the Sun is above the apparent sunrise/sunset horizon; moon icon while it is below
- Offline solar-position calculation from latitude and longitude—no weather service or API key
- Optional Home Assistant Worldclock sensor as the displayed time source
- Automatic fallback to the browser-calculated local time if an entity is unavailable
- Visual card editor for locations and display settings
- Configurable width, maximum width, and row height
- 12-hour, 24-hour, or system time format; optional seconds
- Theme-aware, responsive layout and accessible keyboard interaction
- Native Home Assistant Visibility and Sections-layout support

## Install

1. Copy the complete `worldclock-sun-card` folder—including its `flags` directory—into `/config/www/` on your Home Assistant system.
2. In Home Assistant, go to **Settings → Dashboards → Resources**.
3. Add `/local/worldclock-sun-card/worldclock-sun-card.js?v=1.4.2` as a **JavaScript module**.
4. Refresh the dashboard, choose **Add card**, and select **Worldclock Sun Card**.

If the Resources menu is hidden, enable Advanced Mode in your Home Assistant user profile.

## Example configuration

```yaml
type: custom:worldclock-sun-card
title: World Clock
card_width: 100%
max_width: 680px
time_format: auto
date_format: full
show_seconds: false
show_timezone: true
show_daylight_label: true
animate_icons: true
locations:
  - name: San Francisco
    flag: US
    timezone: America/Los_Angeles
    latitude: 37.7749
    longitude: -122.4194

  - name: New York
    flag: US
    timezone: America/New_York
    latitude: 40.7128
    longitude: -74.0060

  - name: London
    flag: GB
    timezone: Europe/London
    latitude: 51.5074
    longitude: -0.1278

  - name: Tokyo
    flag: JP
    timezone: Asia/Tokyo
    latitude: 35.6762
    longitude: 139.6503

  - name: Sydney
    flag: AU
    timezone: Australia/Sydney
    latitude: -33.8688
    longitude: 151.2093
```

Use an [IANA time-zone identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), not a fixed abbreviation such as `PST`. IANA zones apply daylight-saving rules to the time and date automatically.

### Use Home Assistant's home coordinates

For a row at the Home Assistant installation location, coordinates can come from Home Assistant:

```yaml
locations:
  - name: Home
    timezone: America/Los_Angeles
    use_home_coordinates: true
```

The card also uses Home Assistant's coordinates automatically when a row has no coordinates and its time zone matches Home Assistant's configured time zone. Explicit coordinates are recommended for clarity.

## Optional Worldclock integration

The card does not require the Worldclock integration. It calculates a row's time in the browser when `entity` is omitted.

To use a Worldclock sensor's formatted state instead:

1. Add **Worldclock** from **Settings → Devices & services → Add integration**.
2. Configure its time zone and time format.
3. Add its entity ID to the matching row:

```yaml
locations:
  - name: London
    timezone: Europe/London
    latitude: 51.5074
    longitude: -0.1278
    entity: sensor.london_time
```

The Worldclock sensor provides only its formatted time state. The card still needs `timezone`, `latitude`, and `longitude` to display the location's current date and determine the sun/moon icon. Clicking a row with an entity opens Home Assistant's More Info dialog.

Set `prefer_entity_time: false` to keep the entity link and More Info behavior while always formatting time in the card.

## Configuration reference

### Card options

| Option | Type | Default | Description |
|---|---|---:|---|
| `title` | string | `World Clock` | Card heading; set to an empty string to hide it |
| `locations` | list | required | One or more location objects |
| `time_format` | `auto`, `12`, `24` | `auto` | Clock format |
| `date_format` | `short`, `medium`, `long`, `full` | `full` | Local-date detail |
| `show_seconds` | boolean | `false` | Show and refresh seconds |
| `show_timezone` | boolean | `true` | Show the current local time-zone abbreviation |
| `show_daylight_label` | boolean | `true` | Show “Sun up” or “Sun down” below the date |
| `animate_icons` | boolean | `true` | Animate the SVG sun rays/core and moon sheen/stars; reduced-motion preferences override this |
| `prefer_entity_time` | boolean | `true` | Use a valid configured entity state as the time |
| `card_width` | CSS length | `100%` | Card width, for example `480px`, `36rem`, or `100%` |
| `max_width` | CSS length | `none` | Maximum width; the card centers itself when set |
| `row_height` | number | `82` | Row height in pixels, clamped to 58–160 |
| `min_height` | CSS length | unset | Optional minimum card height |

### Location options

| Option | Type | Required | Description |
|---|---|---:|---|
| `name` | string | recommended | Row label |
| `flag` | string | no | Two-letter country code such as `GB`; an existing flag emoji is also recognized and mapped to its bundled SVG |
| `timezone` | string | yes | IANA time zone used for the time and date |
| `latitude` | number | yes* | Decimal latitude, −90 to 90 |
| `longitude` | number | yes* | Decimal longitude, −180 to 180; east is positive |
| `use_home_coordinates` | boolean | no | Use Home Assistant's configured latitude/longitude |
| `entity` | entity ID | no | Optional Worldclock sensor used for the displayed time |

`*` Latitude/longitude can be omitted when `use_home_coordinates: true`.

## Visibility and dashboard layout

This is a normal top-level Lovelace card, so Home Assistant's built-in **Visibility** tab can control when it appears. The card also advertises grid sizing to the Sections view, so the **Layout** tab can set its column and row footprint. Those Home Assistant-managed settings remain in the card configuration when its custom visual editor is used.

`card_width` controls the card inside the area allocated by the dashboard. In a Sections view, use the Layout tab for the grid footprint and `card_width: 100%` for the usual edge-to-edge result.

## How the icon is chosen

The card calculates solar elevation for the current instant at the row's coordinates. It uses −0.833° as the apparent sunrise/sunset threshold, accounting for the conventional solar-disc and atmospheric-refraction adjustment. At or above the threshold the row shows `mdi:weather-sunny`; below it, `mdi:weather-night`.

The calculation runs entirely in the browser. NOAA notes that calculated and observed sunrise/sunset can differ because atmospheric conditions vary, especially at high latitudes. See [NOAA Solar Calculation Details](https://gml.noaa.gov/grad/solcalc/calcdetails.html).

## Troubleshooting

- **Map-marker warning instead of sun/moon:** add valid latitude and longitude, or enable `use_home_coordinates`.
- **Flag is missing:** confirm the complete `flags` directory was copied beside `worldclock-sun-card.js`, and use a valid two-letter code.
- **“Invalid time zone”:** use a valid IANA identifier such as `Europe/London`.
- **Entity unavailable message:** the card has fallen back to its local formatter. Check the Worldclock entity ID and integration.
- **Resource already loaded after updating:** increment the query value in the resource URL, then hard-refresh the browser.

## License

MIT

Bundled country SVGs are from [flag-icons v7.5.0](https://github.com/lipis/flag-icons/tree/v7.5.0), copyright Panayiotis Lipiridis and contributors, under the MIT License. The complete third-party license is included as `FLAG-ICONS-LICENSE`.
