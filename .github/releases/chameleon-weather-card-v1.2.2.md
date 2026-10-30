# Chameleon Weather Card v1.2.2

Cache-correctness update for Chameleon artwork in Home Assistant companion apps and WebViews.

## Fixed

- Adds the card version to bundled chameleon and weather image URLs.
- Bypasses cached missing-image responses left behind by installations that loaded v1.2.0 before the artwork was included in the HACS package.
- Leaves absolute HTTP, data, and blob image URLs unchanged for custom artwork compatibility.
- Versions the HACS bundle import as `chameleon-weather-card.js?v=1.2.2`.

## Verification

- Confirmed both configured live Home Assistant dashboards render the 1024×1024 chameleon image with v1.2.1 in a clean browser session.
- Added regression coverage for versioned local artwork URLs.
- Retained byte-for-byte validation of all 34 distributed image assets.

## Upgrade

Update **Home Assistant Dashboard Cards** through HACS to this release and reload the dashboard. The new image URLs automatically bypass the stale response; manually clearing the companion app cache should not be necessary.
