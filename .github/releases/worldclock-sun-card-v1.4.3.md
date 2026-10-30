# Worldclock Sun Card v1.4.3

Flag asset and render-stability update.

## Fixed

- Bundles all 271 flag SVGs under `dist/flags` so HACS installations can load the configured flags.
- Stops rebuilding the complete card for unrelated Home Assistant state updates.
- Uses synchronous flag decoding when a necessary render does occur, avoiding transient empty image boxes.
- Versions the HACS bundle import as `worldclock-sun-card.js?v=1.4.3`.

## Why it flickered

The missing HACS flag URLs failed on every render. Home Assistant frequently replaced the `hass` object, causing the card to recreate each flag image; its border appeared briefly until the image error handler hid it.

## Regression coverage

- Compares all 271 distributed flags byte-for-byte with their source SVGs.
- Verifies unrelated state updates do not request a card rebuild while relevant Worldclock entity updates still do.
- Verifies JavaScript source/distribution parity and the versioned bundle import.

## Upgrade

Update **Home Assistant Dashboard Cards** through HACS and reload the dashboard. Remove the obsolete standalone `/local/worldclock-sun-card/worldclock-sun-card.js` resource to avoid duplicate card registrations.
