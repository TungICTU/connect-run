# JS dependency order

`index.html` loads the game in dependency order. These files share the same global scope intentionally (the original game was split from one script without converting gameplay code to ES modules).

1. `utils.js` — formatting, speed runtime, shared timing helpers.
2. `core.js` — core definitions, core normalization, runtime core counts.
3. `config.js` — board constants, properties, enhancements, card/buff definitions, tooltips/debug data.
4. `boss.js` — boss definitions, boss selection/history, boss start/end-of-shot effects, boss reductions, adverse boss cells.
5. `stats.js` — per-run block/card/buff statistics.
6. `state-save.js` — run state, save/load, new run.
7. `level.js` — level generation and hand refill/discard.
8. `render.js` — DOM rendering and HUD/board/hand/card views.
9. `targeting.js` — card targeting flow.
10. `input.js` — pointer/drag/rotate interaction.
11. `simulation.js` — ball entities and movement.
12. `effects.js` — gameplay effects and shot resolution.
13. `overlay.js` — win/lose overlays.
14. `inventory.js` — inventory/debug UI helpers.
15. `shop.js` — common shop and gacha.
16. `settings.js` — settings panel, run statistics UI, persistent speed slider.
17. `main.js` — persistence/lifecycle boot.


Asset UI: `../assets/assassin-skull.png` is the target-cell skull icon.
