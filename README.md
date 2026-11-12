# Candy Wall

A browser toy set in a dark ASMR studio. A backlit wall of 48 dispensers pours sweets onto a clear divided tray. Carry the tray to the table, then squeeze every piece with chopsticks, saw it open with a knife, snap chocolate along its grooves, shatter hard candy, and feed it all to a head that reacts to the taste.

## How to play

- **Wall:** tap a dispenser to step up to it, hold it to pour, tap a tray compartment to choose where the sweets land. Swipe or use the arrow keys to move to the next dispenser.
- **Table:** press a sweet to squeeze it, drag it to pick it up with the chopsticks, and bring it to the head's mouth to feed it. Tap the knife (or press `2`) and drag back and forth across a sweet to cut it. Tap brittle sweets with the knife to crack them.
- `Space` switches between the wall and the table, `1` and `2` switch tools.

Every sweet has its own hardness, bounce, stickiness, break behaviour, filling, taste and sound. Liquid centres drain out when cut and stay in the bottom half if you slice a piece like a cup. The head puckers at sour sweets, turns red and pants at hot ones, and crackles with popping candy.

## Tech

- three.js r169 and Rapier (both vendored in `vendor/`), ES modules, no build step.
- All 48 sweets are hand-scripted procedural models (`src/candies/`): signed-distance fields meshed with surface nets, custom materials with fake translucency, sugar crystals and 3D patterns that survive cutting.
- Cutting is real geometry: every body is a watertight mesh split by a plane, with caps triangulated per layer (`src/lib/cut.js`), so fillings, wafer layers and jawbreaker rings show up wherever you cut.
- The wall draws low-detail instanced piles; only poured pieces become physics bodies.
- The loop renders only while something is moving.

## Development

Serve the folder with any static server without caching, then open `index.html`. `bench.html?pack=a` shows every sweet under the game lighting with a validation report.

## Credits

Sound effects are CC0 recordings from freesound.org, listed in `assets/audio/CREDITS.md`.
