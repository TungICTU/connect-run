# JavaScript dependency order

These scripts are loaded as classic scripts with `defer`, in this order:

1. `utils.js` — shared formatting, animation helpers, generic utilities.
2. `core.js` — core definitions, creation/normalization, runtime count handling, immunity/hazard policy.
3. `config.js` — game constants, property/enhancement data, tooltip/debug helpers, upgrades/buffs/power cards.
4. `state-save.js` — state, save/load, new-run lifecycle, state normalization.
5. `level.js` — level generation, board setup, adverse cells.
6. `render.js` — DOM references and rendering.
7. `targeting.js` — power-card targeting and target predicates.
8. `input.js` — pointer/drag/rotate interactions.
9. `simulation.js` — ball entities and movement helpers.
10. `effects.js` — scoring, block/ball effects, core effects, shot simulation.
11. `overlay.js` — win/lose/reward overlays.
12. `inventory.js` — inventory and debug UI.
13. `shop.js` — shop, gacha, purchases and gacha choices.
14. `main.js` — persistence boot and lifecycle hooks.

Core dependency rule:

`core.js` must load before `config.js`, `state-save.js`, `shop.js`, `render.js`, and `effects.js` because those modules use `CORE_DEFS`, `CORE_IDS`, `makeCore`, `cloneCore`, `normalizeCore`, `coreHasCount`, `coreCanUse`, `consumeCoreUse`, `blockHasCore`, or `blockIgnoresCellHazards`.
