# From Hell to Heaven — Team Integration Guide

This document explains how to plug custom **weapons**, **enemy 3D models**, **level sections**, and **VFX** into the current build without breaking existing combat or progression logic.

---

## 1. Weapon System (`weapons.js`)
The weapon HUD, Lucky Box unlocks, `2.5s` post-move switch lockout, and Ember Shop are already wired up in `main.js` and `combat.js`.

To plug in your custom weapon definitions, import `registerWeapons` from `./main.js` (or call `window.registerWeapons(WEAPONS)`) and pass an array of weapon objects:

```js
import { registerWeapons } from './main.js'

export const WEAPONS = [
  {
    id: 'ember_blade',
    name: 'Ember Blade',
    unlockType: 'starter', // 'starter' | 'box' | 'shop'
    price: 0,              // Used if unlockType === 'shop'
    desc: 'Balanced celestial blade.',
    combo: [
      { anim: 'attack_1', dur: 0.42, dmg: 10, range: 3.0, arc: 0.15, winStart: 0.12, winEnd: 0.30, step: 4.5, kb: 3.0, stop: 0.045, shake: 0.18 },
      { anim: 'attack_2', dur: 0.42, dmg: 12, range: 3.1, arc: 0.15, winStart: 0.12, winEnd: 0.30, step: 5.0, kb: 3.5, stop: 0.045, shake: 0.20 },
      { anim: 'attack_3', dur: 0.58, dmg: 20, range: 3.5, arc: -0.2, winStart: 0.18, winEnd: 0.40, step: 7.5, kb: 14.0, stop: 0.08, shake: 0.42 }
    ],
    dashStrike: {
      anim: 'dash_strike', dur: 0.36, dmg: 15, range: 3.8, arc: 0.15, winStart: 0.05, winEnd: 0.28, step: 9.0, kb: 7.5, stop: 0.06, shake: 0.28
    },
    special: {
      anim: 'special_spin', // Supported animations: 'special_spin' | 'special_slam' | 'special_thrust'
      dur: 0.56, dmg: 22, range: 3.5, arc: -1.1, winStart: 0.12, winEnd: 0.44,
      step: 3.5, kb: 11.0, stop: 0.07, shake: 0.34, cd: 2.0, deflect: true,
      proj: { speed: 18, dmg: 14, life: 0.65, color: 0xffd470 } // Optional forward energy wave
    },
    createMesh: (mountGroup) => {
      // Attach your Three.js weapon mesh or .glb clone to mountGroup (already parented to DEF-hand.R)
    }
  }
]

registerWeapons(WEAPONS)
```

### Important Weapon Notes
* **Hand Attachment:** `mountGroup` in `createMesh(mountGroup)` is permanently parented to the player's `DEF-hand.R` bone. Add your mesh directly to `mountGroup` instead of replacing `player.userData.weapon`.
* **Unlock Types:**
  * `'starter'`: Equipped at the start of every run.
  * `'box'`: Unlocked randomly when hitting cyan Lucky Boxes during runner segments.
  * `'shop'`: Appears for direct purchase (`price` in Embers) at the **Ember Merchant** stall after clearing a chamber.

---

## 2. Custom Enemy 3D Models (`enemies.js`)
All 3 enemy archetypes currently use procedural blocky 3D fallback models that automatically swap to `.glb` models as soon as a URL is provided.

To add custom `.glb` models:
1. Place your `.glb` files in the project root (or `assets/`).
2. Import them at the top of **`enemies.js`** using Vite's `?url` suffix:
   ```js
   import rusherUrl from './rusher.glb?url'
   import shooterUrl from './shooter.glb?url'
   import bruteUrl from './brute.glb?url'
   ```
3. Set `modelUrl` inside `ENEMY_TYPES` in **`enemies.js`**:
   ```js
   rusher: { name: 'Ashen Stalker', modelUrl: rusherUrl, height: 1.55, ... }
   ```
* The loader in `enemies.js` automatically centers the `.glb`, grounds its feet at `y = 0`, and scales it to `height`.

---

## 3. Replacing Section Placeholders (`stage.js` & `world.js`)
The full game loop is already wired in **`stage.js`**:
* `hell` $\rightarrow$ `middleEarth` (placeholder) $\rightarrow$ `heavensGate` (placeholder) $\rightarrow$ `heaven`

To build out **Middle Earth** or **Heaven's Gate**:
1. Open **`stage.js`** and remove `placeholder: true` from `middleEarth` or `heavensGate`, then adjust `segments`, `speed`, `obstacles`, `turns`, `waves`, and `guardian` stats.
2. To customize dungeon chamber props or themes per stage, update `arena(g, cfg)` in **`world.js`**. Note that the 4 corner pillars at `(±17, ±17)` have collision radii (`r = 0.85`) defined in `combat.js` (`PILLARS`).

---

## 4. Adding VFX (`vfx.js`)
If adding a `vfx.js` particle/slash system:
* Hook slash arcs into `Combat.prototype.startAttack(move)` in **`combat.js`**.
* Hook hit sparks into the `if (landedAny)` block inside `Combat.prototype.move(dt, active)` in **`combat.js`**.
* Update and dispose active effects inside the main `renderer.setAnimationLoop` in **`main.js`**.