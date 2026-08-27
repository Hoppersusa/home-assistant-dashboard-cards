# Earthquake Alert Card

A Home Assistant Lovelace card inspired by [`MMM-EarthquakeAlerts`](https://github.com/dathbe/MMM-EarthquakeAlerts). It monitors recent USGS earthquakes and displays only events that satisfy configurable magnitude/distance bands for your important locations.

## Included functionality

- Reproduces the upstream default alert bands:
  - M2.5 or greater within 10 miles
  - M4.0 or greater within 60 miles
  - M5.5 or greater within 300 miles
  - M7.0 or greater worldwide
- Checks configured locations in order and reports the first matching location
- Uses Home Assistant's native USGS geo-location entities when available
- Automatically falls back to the official USGS M2.5+ past-day GeoJSON feed
- Direct Home Assistant More Info access for native entities
- Magnitude severity colors, distance, depth, review status, and relative event time
- Editable locations and thresholds in the visual card editor
- Configurable width, history period, update interval, item count, units, and animations
- Native Home Assistant Visibility and Sections-layout support
- Optional persistent-notification automation

The direct-feed mode only downloads earthquake metadata from USGS. Coordinates and thresholds are evaluated locally in the browser.

## Installation

1. Copy `earthquake-alert-card.js` to `/config/www/earthquake-alert-card/earthquake-alert-card.js`.
2. In Home Assistant, open **Settings → Dashboards → Resources**.
3. Add `/local/earthquake-alert-card/earthquake-alert-card.js?v=1.0.0` as a **JavaScript module**.
4. Refresh the dashboard and select **Earthquake Alert Card** when adding a card.

If the Resources menu is hidden, enable Advanced Mode in your Home Assistant user profile.

## Recommended Home Assistant data source

Add the native USGS integration to `configuration.yaml`:

```yaml
geo_location:
  - platform: usgs_earthquakes_feed
    feed_type: past_day_m25_earthquakes
    minimum_magnitude: 2.5
    radius: 20050
```

The large radius makes worldwide M7+ events available to the card. The card applies the stricter distance/magnitude bands itself, so it does not display every entity returned by the integration. Restart Home Assistant after changing `configuration.yaml`.

If you do not want a near-global native feed, omit this configuration and leave `data_source: auto`. The card will load the official USGS past-day M2.5+ feed directly.

## Example card configuration

```yaml
type: custom:earthquake-alert-card
title: Earthquake Alerts
data_source: auto
distance_unit: mi
hours: 24
max_items: 8
update_interval: 5
show_depth: true
show_source: true
animate: true
card_width: 100%
max_width: 720px

locations:
  - name: Home
    use_home_coordinates: true

  - name: Family
    latitude: 46.2
    longitude: 6.13

thresholds:
  - magnitude: 2.5
    distance: 10
  - magnitude: 4.0
    distance: 60
  - magnitude: 5.5
    distance: 300
  - magnitude: 7.0
    distance: null
```

A blank or `null` threshold distance means worldwide. Threshold distances use `distance_unit`.

## Card options

| Option | Type | Default | Description |
|---|---|---:|---|
| `title` | string | `Earthquake Alerts` | Card heading |
| `data_source` | `auto`, `native`, `usgs` | `auto` | Prefer HA entities, require HA entities, or use direct USGS |
| `distance_unit` | `mi`, `km` | `mi` | Display and threshold unit |
| `hours` | number | `24` | Event age limit |
| `max_items` | number | `8` | Maximum qualifying events shown |
| `update_interval` | number | `5` | Direct-feed refresh interval in minutes; minimum 5 |
| `show_depth` | boolean | `true` | Show event depth |
| `show_source` | boolean | `true` | Show active data source |
| `animate` | boolean | `true` | Animate magnitude waves |
| `card_width` | CSS length | `100%` | Card width |
| `max_width` | CSS length | `none` | Maximum width; card centers when set |
| `locations` | list | Home | Ordered locations used for distance matching |
| `thresholds` | list | upstream defaults | Magnitude/distance pairs |

## Optional notification automation

`automation-earthquake-alerts.yaml` is included. It listens for newly created native USGS geo-location entities and creates a persistent notification only when an event crosses one of the four default bands relative to the native integration's configured coordinates.

Copy its contents into `automations.yaml`, or use it as a starting point in the automation YAML editor. Add your preferred mobile notification action after the persistent-notification action if desired.

The automation requires the native USGS configuration above. The card's direct browser feed cannot initiate Home Assistant automations while the dashboard is closed.

## How matching works

For each event, locations are evaluated in their configured order. An event qualifies if any distance-limited threshold is met at a location, or if a worldwide threshold is met. The first matching location is shown. This preserves the upstream module's location-priority behavior.

Distances use a great-circle calculation. Actual shaking intensity depends on depth, geology, building construction, and other factors; the thresholds are informational and are not an official warning system.

## Data and attribution

- Earthquake data: [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/)
- Behavior inspired by [dathbe/MMM-EarthquakeAlerts](https://github.com/dathbe/MMM-EarthquakeAlerts), MIT licensed
- Home Assistant integration: [USGS Earthquake Hazards](https://www.home-assistant.io/integrations/usgs_earthquakes_feed/)

## License

MIT. The upstream license is included in `UPSTREAM-LICENSE.md`.
