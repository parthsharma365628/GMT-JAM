export const stages = {
  hell: {
    name: 'Hell · The Infernal Depths',
    infernal: true,
    sky: 0x302a3b, stone: 0x4f414d,
    speed: 8, topSpeed: 18,
    segments: 105,
    gapStart: 4,
    obstacles: {
      rocks: ['left','right'], fire: ['center'], gap: ['center'],
      hurdle: ['center'], gate: ['left','center','right'], pendulum: ['center'],
      sweeper: ['center'], slider: ['center'], boulder: ['left','center','right']
    },
    // Optional per-type tuning for generateRoute: weight scales how often a type is picked (default 1, shared
    // across its sides) and minGap is the fewest segments between two of that type.
    weights: { boulder: 0.35 }, minGap: { boulder: 6 },
    turns: [
      { after: 7, angle: 30 }, { after: 9, angle: -60 },
      { after: 11, angle: 45 }, { after: 10, angle: -45 }
    ],
    embers: { chance: 0.72, value: 50 },
    boxes: { chance: 0.12 },
    segmentLength: 15,
    guardian: 'The Ash Warden', hp: 180, damage: 20,
    wardenModels: 'hell',
    chaseSpeed: 2.4, attacks: ['swing','slam'],
    waves: [
      { enemies: ['rusher','rusher','shooter'] },
      { enemies: ['rusher','rusher','shooter','brute'] },
      { boss: true, enemies: ['rusher','rusher'] }
    ],
    sword: 'Ember of the Fallen Sky',
    rewardWeapon: 'warden',
    rewardDamage: { combo: [19, 24, 35], dash: 27, special: 42, wave: 18 },
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
      hurdle: ['center'], gate: ['left','right'], pendulum: ['center'],
      sweeper: ['center'], slider: ['center'], boulder: ['left','right']
    },
    weights: { boulder: 0.35 }, minGap: { boulder: 6 },
    turns: [
      { after: 6, angle: -40 }, { after: 7, angle: 40 }
    ],
    embers: { chance: 0.8, value: 60 },
    boxes: { chance: 0.2 },
    segmentLength: 15,
    guardian: 'Warden of the Wastes', hp: 240, damage: 22,
    wardenModels: 'earth',
    dropRewardOnDefeat: true,
    chaseSpeed: 2.6, attacks: ['swing','slam'],
    waves: [
      { enemies: ['rusher','shooter','brute'] },
      { boss: true, enemies: ['shooter','rusher'] }
    ],
    sword: 'Blade of Middle Earth',
    rewardWeapon: 'earthSword',
    rewardDamage: { combo: [23, 29, 40], dash: 32, special: 50, wave: 21 },
    next: 'heavensGate'
  },

  heavensGate: {
    name: 'Heaven\'s Gate · Empyrean Threshold',
    celestial: true,
    sky: 0xd4e0f1, stone: 0xc3c4c2,
    speed: 8, topSpeed: 24,
    segments: 18,
    gapStart: 3,
    obstacles: {
      rocks: ['left','right'], fire: ['center'],
      hurdle: ['center'], pendulum: ['center'],
      sweeper: ['center'], slider: ['center'], boulder: ['left','right']
    },
    weights: { boulder: 0.35 }, minGap: { boulder: 6 },
    turns: [
      { after: 6, angle: 45 }, { after: 7, angle: -45 }
    ],
    embers: { chance: 0.85, value: 75 },
    boxes: { chance: 0.25 },
    segmentLength: 15,
    guardian: 'Seraphic Gatekeeper', hp: 310, damage: 25,
    wardenModels: 'heaven',
    dropRewardOnDefeat: true,
    chaseSpeed: 2.8, attacks: ['swing','slam'],
    waves: [
      { enemies: ['brute','shooter','shooter'] },
      { boss: true, enemies: ['brute','rusher'] }
    ],
    sword: 'Crownblade of Heaven',
    rewardWeapon: 'heavenSword',
    rewardDamage: { combo: [27, 34, 47], dash: 38, special: 58, wave: 24 },
    next: null
  }
}

export function generateRoute(cfg, random = Math.random) {
  const options = Object.entries(cfg.obstacles)
    .flatMap(([type, sides]) => sides.map(side => ({type, side, weight: (cfg.weights?.[type] ?? 1) / sides.length})))
  const route = [{type: 'entry', side: 'center'}]
  const lastSeen = {}
  for (let n = 1; n <= cfg.segments; n++) {
    const last = route.at(-1)
    const allowed = options.filter(o => (o.type !== 'gap' || n >= cfg.gapStart) &&
      !(n - (lastSeen[o.type] ?? -Infinity) <= (cfg.minGap?.[o.type] ?? 0)))
    const fresh = allowed.filter(o => o.type !== last.type || o.side !== last.side)
    const pool = fresh.length ? fresh : allowed.length ? allowed : options
    let pick = random() * pool.reduce((sum, o) => sum + o.weight, 0)
    const choice = pool.find(o => (pick -= o.weight) < 0) ?? pool.at(-1)
    lastSeen[choice.type] = n
    route.push({type: choice.type, side: choice.side})
  }
  route.push({type: 'approach', side: 'center'})
  return route
}
