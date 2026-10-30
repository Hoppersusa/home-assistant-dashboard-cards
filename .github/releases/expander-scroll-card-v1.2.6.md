# Expander Scroll Card v1.2.6

Lifecycle containment fix for nested Home Assistant cards.

## Fixed

- Creates title and child cards through Home Assistant's `hui-card` wrapper instead of inserting raw card elements.
- Keeps lazy `ll-upgrade` and `ll-rebuild` events inside the nested card lifecycle, preventing the outer dashboard card from rebuilding the entire expander and resetting it closed.
- Continues to contain nested `card-updated` events at the Expander Scroll Card shadow boundary.
- Applies clear-child styling through Home Assistant card variables so it remains compatible with the wrapper.

## Regression coverage

- Verifies the nested wrapper receives `hass`, preview state, configuration, and exactly one `load()` call.
- Retains event-containment, listener-cleanup, scrollbar compensation, version, and source/distribution parity checks.

## Upgrade

Update **Home Assistant Dashboard Cards** to this release through HACS, then reload the dashboard. No configuration changes are required.
