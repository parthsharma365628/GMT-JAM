export const stages = {
  hell: {
    name: 'Hell · The Infernal Depths',
    sky: 0x381824, stone: 0x4f414d,
    speed: 9, topSpeed: 24,
    segments: 55,
    gapStart: 4,
    obstacles: {
      rocks: ['left','right'], fire: ['center'], gap: ['center'],
      hurdle: ['center'], gate: ['left','center','right'], pendulum: ['center']
    },
    turns: [
      { after: 7, angle: 30 }, { after: 9, angle: -60 },
      { after: 11, angle: 45 }, { after: 10, angle: -45 }
    ],
    embers: { chance: 0.72, value: 50 },
    boxes: { chance: 0.12 },
    segmentLength: 15,
    guardian: 'The Ash Warden', hp: 100, damage: 20,
    wardenModels: 'hell',
    chaseSpeed: 2.4, attacks: ['swing','slam'],
    waves: [
      { enemies: ['rusher','rusher','shooter'] },
      { enemies: ['rusher','rusher','shooter','brute'] },
      { boss: true, enemies: ['rusher','rusher'] }
    ],
    sword: 'Ember of the Fallen Sky',
    rewardWeapon: 'warden',
    next: 'middleEarth'
  },

  middleEarth: {
    name: 'Middle Earth · Ashen Wastes',
    hedgeObstacles: true,
    forest: true,
    sky: 0x8c9c7d, stone: 0x55543b,
    speed: 11, topSpeed: 25,
    segments: 18,
    gapStart: 3,
    obstacles: {
      rocks: ['left','right'], gap: ['center'],
      hurdle: ['center'], gate: ['left','right']
    },
    turns: [
      { after: 6, angle: -40 }, { after: 7, angle: 40 }
    ],
    embers: { chance: 0.8, value: 60 },
    boxes: { chance: 0.2 },
    segmentLength: 15,
    guardian: 'Warden of the Wastes', hp: 120, damage: 22,
    wardenModels: 'earth',
    chaseSpeed: 2.6, attacks: ['swing','slam'],
    waves: [
      { enemies: ['rusher','shooter','brute'] },
      { boss: true, enemies: ['shooter','rusher'] }
    ],
    sword: 'Blade of Middle Earth',
    rewardWeapon: 'earthSword',
    next: 'heavensGate'
  },

  heavensGate: {
    name: 'Heaven\'s Gate · Empyrean Threshold (Placeholder)',
    placeholder: true,
    sky: 0x4a3b2c, stone: 0x8c7b6b,
    speed: 12, topSpeed: 26,
    segments: 18,
    gapStart: 3,
    obstacles: {
      rocks: ['left','right'], fire: ['center'],
      hurdle: ['center'], pendulum: ['center']
    },
    turns: [
      { after: 6, angle: 45 }, { after: 7, angle: -45 }
    ],
    embers: { chance: 0.85, value: 75 },
    boxes: { chance: 0.25 },
    segmentLength: 15,
    guardian: 'Seraphic Gatekeeper (Placeholder)', hp: 145, damage: 25,
    chaseSpeed: 2.8, attacks: ['swing','slam'],
    waves: [
      { enemies: ['brute','shooter','shooter'] },
      { boss: true, enemies: ['brute','rusher'] }
    ],
    sword: 'Crownblade of Heaven',
    next: null
  }
}

export function generateRoute(cfg, random = Math.random) {
  const options = Object.entries(cfg.obstacles)
    .flatMap(([type, sides]) => sides.map(side => ({type, side})))
  const route = [{type: 'entry', side: 'center'}]
  for (let n = 1; n <= cfg.segments; n++) {
    const last = route.at(-1)
    const allowed = options.filter(o => o.type !== 'gap' || n >= cfg.gapStart)
    const fresh = allowed.filter(o => o.type !== last.type || o.side !== last.side)
    const pool = fresh.length ? fresh : allowed
    route.push(pool[Math.floor(random() * pool.length)])
  }
  route.push({type: 'approach', side: 'center'})
  return route
}
