// ─────────────────────────────────────────────────────────────
//  OPENING CUTSCENE SCRIPT — write your dialogue here.
// ─────────────────────────────────────────────────────────────
// The cutscene is a sequence of full-screen animated scenes.
// Each scene is a sprite sheet with its frames stacked vertically.

export const scenes = {
  angelDrop: { sheet: './sprites/angel_drop.png',  fps: 4 },  // scene 1
  quixote:   { sheet: './sprites/don_quixote.png', fps: 4 }   // scene 2
}

// One entry per text box, in order. Fields:
//   scene   : which scene plays behind this line (key from `scenes` above)
//   speaker : name on the tag, or null for narration
//   text    : the line itself (\n for a manual line break)
// Click, Space, Enter or E advances. Esc or "Skip" jumps to the game.
export const script = [
  // ── Scene 1 ──
  { scene: 'angelDrop', speaker: 'Angel', text: 'I have been slain by my own sword, by that damned demon.' },
  { scene: 'angelDrop', speaker: null,    text: 'After falling through the abyss for a long time...' },

  // ── Scene 2 ──
  { scene: 'quixote',   speaker: 'Angel', text: 'My wings withered and I grew horns as I hit the depths of Hell.\nI swear to kill that damned demon.' }
]
