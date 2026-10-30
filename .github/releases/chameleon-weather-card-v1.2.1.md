# Chameleon Weather Card v1.2.1

HACS asset-packaging fix for the Chameleon Weather Card.

## Fixed

- Bundles all 34 chameleon and weather PNG assets under `dist/images` so HACS installs the artwork with the JavaScript module.
- Versions the bundle import as `chameleon-weather-card.js?v=1.2.1` to prevent stale module caching.
- Keeps custom image paths and manual `/local/` installations compatible.

## Regression coverage

- Verifies every source image is present in the HACS distribution.
- Compares every distributed image byte-for-byte with its source asset.
- Verifies source/distribution JavaScript parity and the versioned HACS import.

## Upgrade

Update **Home Assistant Dashboard Cards** through HACS and reload the dashboard. The obsolete standalone `/local/chameleon-weather-card/chameleon-weather-card.js` resource can then be removed to avoid duplicate registrations.
