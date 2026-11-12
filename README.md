# Candy Wall

A browser toy set in a dark ASMR studio. A wall of 48 clear acrylic bins holds every kind of sweet. Open a bin, dig in with a rainbow metal scoop and pour the heap into a white flower tray with nine compartments. Carry the tray to the table, then squeeze every piece with chopsticks, saw it open with a knife, snap chocolate along its grooves, shatter hard candy, and feed it all to a head that reacts to the taste.

## How to play

- **Wall:** tap a bin to step up to it (its lid swings open). Press on the sweets to dig the scoop in, drag the loaded scoop over a tray compartment and let go to pour. Use the arrow keys or tap another bin to move on.
- **Table:** press a sweet to squeeze it, drag it to pick it up with the chopsticks, and bring it to the head's mouth to feed it. Tap the knife (or press `2`) and drag back and forth across a sweet to cut it. Tap brittle sweets with the knife to crack them.
- `Space` switches between the wall and the table, `1` and `2` switch tools.

Every sweet has its own hardness, bounce, stickiness, break behaviour, filling, taste and sound. Liquid centres drain out when cut and stay in the bottom half if you slice a piece like a cup. The head puckers at sour sweets, turns red and pants at hot ones, and crackles with popping candy.

## Tech

- three.js r169 and Rapier (both vendored in `vendor/`), ES modules, no build step.
- All 48 sweets are hand-scripted procedural models (`src/candies/`): signed-distance fields meshed with surface nets, custom materials with fake translucency, sugar crystals and 3D patterns that survive cutting.
- Cutting is real geometry: every body is a watertight mesh split by a plane, with caps triangulated per layer (`src/lib/cut.js`), so fillings, wafer layers and jawbreaker rings show up wherever you cut.
- The piles in the bins are instanced meshes; the bin you step up to switches to full-detail models with shadows. Piles can be baked offline with real physics (`bake.html`, results in `assets/piles/`), otherwise a loose packing is generated at load. The heap in the scoop is settled by a small physics simulation, and poured pieces become real physics bodies drawn in instanced batches.
- Lighting uses a studio HDRI plus shadow-casting key light; desktop adds a light bloom.
- The loop renders only while something is moving.

## Development

Serve the folder with any static server without caching, then open `index.html`. `bench.html?pack=a` shows every sweet under the game lighting with a validation report.

## Credits

Sound effects are CC0 recordings from freesound.org, listed in `assets/audio/CREDITS.md`. The studio environment map is `studio_small_08` from Poly Haven (CC0).
