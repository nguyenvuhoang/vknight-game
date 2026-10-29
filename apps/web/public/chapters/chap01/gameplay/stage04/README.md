# Stage 04 — Cây Cầu Lung Lay (bridge alignment pack)

- `stage04-background.png`: clean river panorama, **no bridge**, 1916×431.
- `bridge-{broken,partial,repaired}.png`: individual transparent source sprites.
- `bridge-{broken,partial,repaired}-aligned.png`: **full-world 1916×431 RGBA overlays**, each with the same alignment. Overlay ONE state image directly on top of background at `inset:0; width:100%; height:100%`.
- `preview-{broken,partial,repaired}.jpg`: composite previews.
- `stage04-bridge-layout.json`: placement data and bridge state mapping.

Keep background and overlay **in same coordinate space and aspect ratio** (1916:431). If the game uses a 16:9 camera, crop/zoom/pan the entire WORLD container equally — do not stretch images independently.

These are visual layers, **not automatically functional bridges**. Keep all collision zones/bridge-deck pathfinding separate, and unlock crossing only when state is REPAIRED.

The bridge sprites are concept-art-derived, so minor differences in perspective/edges can still be visible. Use the JPG previews to inspect them in context.
