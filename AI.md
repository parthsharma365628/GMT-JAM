# From Hell to Heaven

A single-player desktop browser game built with Three.js and Vite. One stage connects a third-person obstacle run to an isometric sword fight. The characters, hazards and scenery use basic geometry and flat materials.

## How a run works

1. Choose **Start Ascent**. A visual-novel cutscene plays first (click, Space, Enter or E to advance; Esc or Skip to jump ahead). Then the runner moves forward automatically. Steer with A/D or the arrow keys, jump gaps with Space, and avoid rocks and timed fire jets. A collision returns the player to the current segment's checkpoint.
2. Enter the dungeon. The camera rises, the entrance closes, and the Ash Warden approaches. Move with WASD, attack with J or left click, and dodge with K, Shift or right click. The guardian signals a heavy swing or ground slam before striking. Its recovery gives the player time to counterattack. Losing restarts the encounter.
3. Defeat the Warden, approach its golden sword and press E. Walk through the unlocked arch to begin the automatic ascent through Heaven. The victory screen shows the sword, elapsed time and retries. Escape pauses active gameplay.

## Repository layout

```text
GMT-JAM/
├── index.html         Browser entry point. Loads main.js and defines the menu, HUD and hint elements.
├── style.css          Layout and appearance of the canvas, menus, prompts and health bars.
├── main.js            Starts the renderer and runs the game state, camera, HUD and progression.
├── stage.js           Stage registry. Defines the route, colors, speed, guardian stats, reward and next stage.
├── world.js           Builds the runner, dungeon, Heaven, characters and swords from Three.js primitives.
├── combat.js          Controls arena movement, melee hits, dodges, health and guardian attack phases.
├── cutscene.js        Visual-novel opening: full-screen animated scenes, typewriter text box, advance and skip.
├── dialogue.js        Opening cutscene scenes and dialogue. Edit the dialogue here.
├── public/sprites/    Cutscene sprite sheets (square frames stacked vertically) and the runner progress bar.
├── input.js           Maps keyboard and mouse events to actions and tracks held and newly pressed inputs.
├── package.json       Declares dependencies and npm scripts for development and production builds.
├── package-lock.json  Records dependency versions used by npm ci.
├── .gitignore         Excludes installed dependencies and generated builds.
├── README.md          Quick start and controls.
└── AI.md              Game overview and guide to the source.
```

## Where to make changes

- **Runner route generation:** `generateRoute` in `stage.js` builds a new random route each time a stage loads. It uses the stage's `segments` (number of obstacle segments, which sets the route length), `gapStart` (the first obstacle segment where gaps may appear) and `obstacles` (each type with the sides it can spawn on). Two consecutive segments never have the same type and side, so a type with only one side never appears twice in a row.
- **Turns:** the stage's `turns` list sets each turn by `after` (obstacle segments since the previous turn) and `angle` (degrees, positive is right). `layout` in `world.js` places a curved, hazard-free floor piece between two segments for each turn.
- **Speed:** runner speed ramps linearly from `speed` to `topSpeed` (both in `stage.js`) over the length of the route.
- **Jump and respawn feel:** `JUMP`, `RISE_GRAVITY`, `FALL_GRAVITY` and `JUMP_BUFFER` near `resetRunner` in `main.js` control the jump. After a respawn the runner holds still for `RESPAWN_PAUSE`, then speeds back up from base `speed` over `RESPAWN_RAMP` seconds.
- **Embers and score:** `world.js` places rows of embers along each segment's safe line, a sidestep lane or the jump arc. `embers.chance` and `embers.value` in `stage.js` tune them. Score is 1 point per unit of new distance, plus `embers.value` per ember and 500 for defeating the guardian. Embers collected since the last checkpoint are taken back if the player dies.
- **Runner hazards:** the runner tracks the player in route space: `dist` along the path, `lat` to its right, and `height`. `world.js` builds each obstacle in its segment's local frame and records its `d` (distance along the route) and `x` (side offset). Its `at(dist, lat)` function converts route space to a world position and heading. The `run` function in `main.js` checks collisions in route space and animates fire and pendulums. When you add or resize an obstacle, update both files.
- **Guardian balance:** Edit health, damage, chase speed and attack order in `stage.js`. Edit attack range, wind-up and recovery in `combat.js`, alongside the floor indicators and hit detection.
- **Stage progression:** `main.js` loads the stage named `depths` when a run begins. To chain another stage using existing hazards and attacks, register its definition in `stage.js` and set the preceding stage's `next` to the new key. A null `next` leads to Heaven.
- **Controls:** Change action bindings in `input.js` and update the control reminders in `main.js` and `README.md`. The render loop consumes one-frame actions once per frame.
- **Runner progress bar:** `public/sprites/finish_line.png` is shown at the top of the screen during the run. `drawProgress` in `main.js` grows a smooth dark-to-bright red gradient across the bar's interior in proportion to `dist / route.end`, and `showProgress` shows the bar only in the `run` and `fall` states. The gradient colours, the bar length (`--bar-length`) and the pixel size (`--px`, screen pixels per sprite pixel) are under "Runner progress bar" in `style.css`. The score sits in the top-left corner above the objective panel.
- **Runner controls panel:** `#controls` in `index.html` lists the runner keys in the top-right corner. It shows and hides with the progress bar (`showProgress` in `main.js`); its styles are under "Runner controls panel" in `style.css`. Update it when you change the runner bindings in `input.js`.
- **Hearts and fight HUD:** player health is hearts. In `combat.js`, `hp` is white hearts (`MAX_HEARTS` = 3) and `overheal` is yellow hearts (up to `MAX_OVERHEAL` = 2). `damagePlayer` costs one heart per hit, yellow first; `heal` (a potion, `POTION_HEARTS` = 2) repairs broken hearts first and turns the rest into overheal. The Vitality Elixir in the shop sets `progress.overheal`, which is carried into the next fight. `drawFightHud` in `main.js` draws the hearts from `public/sprites/hearts.png` under the score, the wave counter at the top, and the dodge (cyan) and special (purple) bars under the player. Styles are under "Fight HUD" in `style.css`.
- **Pause menu sections:** `SECTIONS` in `main.js` lists every stage's runner and combat section in order. `clearSection` marks one finished (runner: reaching the gate; combat: clearing the chamber) and saves the set in `localStorage` under `gmt-jam.sections`, so it survives the end of a run and page reloads. `renderSections` draws the list in the pause menu: locked sections grey, finished ones white, the current one orange. Clicking a white section calls `revisit`, which loads that stage and starts its runner or its fight. Styles are under "Pause menu" in `style.css`. To reset progress, clear that localStorage key.
- **Timed runner hazard (`fire`):** `lava-vents.js` draws it. In Hell, `lavaJet` is a lava pool that gurgles while safe, bubbles hard as a warning, then erupts in a churning column that sprays blobs. In Heaven, `goldenGate` is a faint flickering gate while safe that turns solid gold while deadly. Both follow the same 3.5 s cycle as the collision check in `run` (`WARN_AT` 1.5 s, `ERUPT_AT` 2.2 s), so changing the timing means changing both. Stages that are neither infernal nor celestial keep the plain orange block.
- **Damage popups:** `reportHit` in `combat.js` records every hit on an enemy or the boss (position above its head, damage, and whether it was heavy: a combo finisher, a special, a slash wave or a reflected fireball). `showHits` in `main.js` projects each one to the screen and adds a popup with `public/sprites/red_nacho.png` and the number. Size, colours and animation are under "Damage popups" in `style.css`.
- **Opening cutscene:** two full-screen animated scenes (`angel_drop`, then `don_quixote`) at 4 fps, with dialogue over them. Write lines in `script` in `dialogue.js`; each has `scene` (a key in `scenes`), `speaker` (name tag, or null for narration) and `text`. To add a scene, put a sheet of square frames stacked vertically in `public/sprites/` and add it to `scenes` with its `fps`. The frame count comes from the sheet's height. Styling is under "Visual-novel opening cutscene" in `style.css`.

## Run locally

Open a terminal in the directory containing `package.json`. With Node.js 22.12 or newer, run `npm ci` and then `npm run dev`. Open the local URL Vite prints. For static hosting, run `npm run build` and serve the generated `dist/` directory.
