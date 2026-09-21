# JS dependency order

`index.html` loads the game in dependency order. These files share the same global scope intentionally (the original game was split from one script without converting gameplay code to ES modules).

1. `utils.js` — formatting, speed runtime, shared timing helpers.
2. `core.js` — core definitions, core normalization, runtime core counts.
3. `config.js` — board constants, properties, enhancements, card/buff definitions, tooltips/debug data.
4. `stats.js` — per-run block/card/buff statistics.
5. `state-save.js` — run state, save/load, new run.
6. `level.js` — level generation and hand refill/discard.
7. `render.js` — DOM rendering and HUD/board/hand/card views.
8. `targeting.js` — card targeting flow.
9. `input.js` — pointer/drag/rotate interaction.
10. `simulation.js` — ball entities and movement.
11. `effects.js` — gameplay effects and shot resolution.
12. `overlay.js` — win/lose overlays.
13. `inventory.js` — inventory/debug UI helpers.
14. `shop.js` — common shop and gacha.
15. `settings.js` — settings panel, run statistics UI, persistent speed slider.
16. `main.js` — persistence/lifecycle boot.
