# Expander Scroll Card v1.2.4

Focused reliability update for the Expander Scroll Card.

## Fixed

- Contains nested `card-updated` events inside the card so updates from embedded cards no longer cause the expander to close immediately.
- Removes the containment listener when the card disconnects, avoiding stale listeners during dashboard rebuilds.
- Preserves the v1.2.3 scrollbar-width fix: space is reserved only when the expanded content actually scrolls.

## Regression coverage

- Verifies nested event containment and listener cleanup.
- Verifies zero compensation when no scrollbar exists.
- Verifies real scrollbar compensation and negative-width clamping.
- Verifies the source and HACS distribution remain byte-identical.
- Adds a dedicated GitHub Actions workflow for future Expander Scroll Card changes.

## Upgrade

Update or redownload **Home Assistant Dashboard Cards** through HACS, then hard-refresh the Home Assistant browser or clear the companion app frontend cache.

No configuration changes are required.
