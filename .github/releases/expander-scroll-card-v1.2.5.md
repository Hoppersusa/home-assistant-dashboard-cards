# Expander Scroll Card v1.2.5

Packaging and cache-correctness update for the Expander Scroll Card.

## Fixed

- Adds a versioned import for `expander-scroll-card.js` in the HACS bundle entry point.
- Prevents Home Assistant and browser module caches from continuing to load the previous card code after a HACS update.
- Retains the v1.2.4 nested `card-updated` event containment and listener cleanup.

## Validation

- Expander Scroll Card regression workflow passed.
- Source and HACS distribution are byte-identical.
- No configuration changes are required.

## Upgrade

Update **Home Assistant Dashboard Cards** to this release through HACS. Then reload the dashboard. If the old behavior remains, hard-refresh the browser or clear the Home Assistant companion app frontend cache.
