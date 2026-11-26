# From Hell to Heaven

A playable Three.js browser game built for GMT-JAM. Run through Hell's obstacles, defeat the Ash Warden, claim its sword, and ascend to Heaven.

## Requirements

Install these programs on the computer that will run the game:

- [Node.js 22.12 or newer](https://nodejs.org/). The Node.js installer includes `npm`.
- [Git](https://git-scm.com/downloads) if you want to download the project from GitHub.
- A modern desktop browser such as Chrome, Edge, or Firefox.

To confirm that Node.js and npm are installed, open a terminal and run:

```sh
node --version
npm --version
```

## Download the project

Clone the repository and enter its folder:

```sh
git clone https://github.com/parthsharma365628/GMT-JAM.git
cd GMT-JAM
```

Alternatively, download the repository as a ZIP from GitHub, extract it, and open a terminal in the extracted folder. The correct folder contains `package.json`.

## Install and run the game

From the folder containing `package.json`, install the exact dependency versions recorded by the project:

```sh
npm ci
```

Start the development server:

```sh
npm run dev
```

Vite will print a local address, usually `http://localhost:5173/`. Open that address in a browser. Keep the terminal open while playing. Press `Ctrl+C` in the terminal to stop the server.

If port 5173 is already occupied, Vite will choose another port; use the address printed in the terminal.

## Play from another device on the same network

Run Vite so it accepts connections from other devices:

```sh
npm run dev -- --host
```

Open the `Network` address printed by Vite on the other device. Both devices must be on the same local network, and the host computer's firewall must allow Node.js to receive private-network connections.

## Create a production build

Generate the optimized static game files with:

```sh
npm run build
```

The completed build is written to `dist/`. Upload the contents of that folder to any static web host. Do not open `dist/index.html` directly from the file system; serve the folder through a web server.

To test the production build locally without installing another package, run:

```sh
npx vite preview
```

Then open the address printed in the terminal.

## Controls

### Opening cutscene

- Click, `Space`, `Enter` or `E`: advance dialogue
- `Esc` or the Skip button: skip to the run

Write the cutscene dialogue in `dialogue.js`.

### Obstacle run

- `A` / `D` or Left / Right arrows: steer
- `Space`: jump
- `Esc`: pause

### Ash Warden fight

- `W`, `A`, `S`, `D`: move
- `J` or left mouse button: attack
- `K`, `Shift`, or right mouse button: dodge
- `R` or `F`: drink a potion (heals 2 hearts; extra becomes yellow overheal, up to 2)
- `E`: collect the sword
- `Esc`: pause

## Troubleshooting

- **`npm` is not recognized:** install Node.js, then close and reopen the terminal.
- **`npm ci` reports a Node.js version error:** upgrade to Node.js 22.12 or newer.
- **The browser cannot connect:** verify that `npm run dev` is still running and use the exact address it printed.
- **Another device cannot connect:** use `npm run dev -- --host`, keep both devices on the same network, and check the host computer's firewall.

## Project structure

Stage definitions live in `stage.js`, world geometry in `world.js`, combat behavior in `combat.js`, controls in `input.js`, and game flow in `main.js`. See `AI.md` for the complete source map.
