# vKnight Phiêu Lưu Ký — Chapter 1 / Stage 3: Ruộng Lúa Bất Ổn

## Install
Copy PNG assets to `apps/web/public/chapters/chap01/gameplay/stage03/`.

All backend asset URLs for NPC and 3 quest items match the filenames in this pack:
`farmer.png`, `scarecrow.png`, `rice-bundle.png`, `water-key.png`, `route-map.png`.

## Asset layers
- `stage03-background.png`: 1920×1080 scene illustration; vertical soft extensions introduced to convert panorama to 16:9.
- `stage03-panorama.png`: cleaner 1920×500 panorama; preferable in a native panoramic world viewport.
- `farmer.png` and `scarecrow.png`: transparent character PNGs, bottom-center foot anchors.
- Quest items: three transparent sprites; puzzle gate must open before collecting.
- `mud-trap.png`, `wooden-bridge.png`, `water-gate.png`, `rice-field-tile.png`: place as independent world overlays and implement hitboxes/interactions in code.
- Other props: `fence.png`, `sign-post.png`, `rock.png`, `bush.png`, `crate.png`, `exit-marker.png`.

## CRITICAL interactivity rules
These are image assets; PNG files do NOT have built-in gameplay behavior. Define interactive object bounding boxes, cursor hit tests, world coordinates, movement bounds and collision in Next.js/React/Phaser. The database provides initial positions, not final perspective-aligned positions. Use one virtual world coordinate system, fixed bottom-center anchors for standing NPCs, and verify ground contact on desktop/mobile.

Quest item → puzzle assignment:
- ITEM_STAGE03_RICE_BUNDLE → MAP_PUZZLE_STAGE03_RICE
- ITEM_STAGE03_WATER_KEY → MAP_PUZZLE_STAGE03_WATER
- ITEM_STAGE03_ROUTE_MAP → MAP_PUZZLE_STAGE03_ROUTE
Never allow collecting puzzle-protected items while their definitions fail to load or are unsolved.

## Artwork note
PNG sprites were cropped and algorithmically matted from an AI-created concept sheet. They are independent RGBA files, but may show minor fringe/alpha artifacts; review final appearance before production. Background converted from panoramic concept with soft image extensions, so it is an iteration asset, not a perfect production environment painting.

The existing Stage 3 backend has no confirmed exit config or environmental-trap rules. `stage03-scene-reference.json` is a positioning/integration aid ONLY and must not be treated as a deployed database configuration.
