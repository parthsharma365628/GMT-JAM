export const stages = {
  depths: {
    name: 'The Infernal Depths', sky: 0x381824, stone: 0x4f414d,
    speed: 8, topSpeed: 25,   // runner speed ramps steadily from speed to topSpeed across the route
    // Runner generation (a new random route is built every time the stage loads)
    segments: 100,     // obstacle segments between the entry and the approach: sets the route length
    gapStart: 4,     // gaps can only appear from this obstacle segment onward (1 = first obstacle)
    // Obstacle types and the sides each may spawn on. Two consecutive segments never share
    // the same type AND side, so a type with a single side never repeats back to back.
    // gate sides name where its opening is.
    obstacles: {
      rocks: ['left','right'], fire: ['center'], gap: ['center'],
      hurdle: ['center'], gate: ['left','center','right'], pendulum: ['center']
    },
    // Turns, in order. after = obstacle segments since the previous turn (or the start);
    // angle = degrees, positive turns right, negative turns left. Each turn is a curved
    // hazard-free piece between two segments. Turns past the last segment are ignored.
    turns: [
      { after: 6, angle: 30 }, { after: 8, angle: -60 }, { after: 10, angle: 45 },
      { after: 8, angle: -90 }, { after: 10, angle: 45 }
    ],
    embers: { chance: 0.7, value: 50 },   // chance a segment gets a row of collectible embers; points each
    segmentLength: 15, guardian: 'The Ash Warden', hp: 100, damage: 20,
    chaseSpeed: 2.4, attacks: ['swing','slam'], sword: 'Ember of the Fallen Sky', next: null
  }
}

// Returns [{type, side}, ...]: an entry segment, cfg.segments random obstacles, then the approach.
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
