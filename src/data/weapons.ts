import type { WeaponDef } from './types';

/**
 * Weapon content. `base` is level 1; `levels[i]` holds the additive deltas applied when reaching
 * level i+2, so level 8 = base + all seven deltas. Numbers are ported from the Vampire Survivors
 * archetypes named in the design (whip / wand / knife / bible / garlic).
 */
export const WEAPONS = {
  plasmaBlade: {
    id: 'plasmaBlade',
    nameKey: 'weapon.plasmaBlade.name',
    descKey: 'weapon.plasmaBlade.desc',
    icon: 'icon_plasmaBlade',
    rarity: 100,
    maxLevel: 8,
    behavior: 'slash',
    // two swings from the start, one to each side. The weapon is still directional — the band is
    // horizontal, so lining the crowd up with it is the player's job — but it is never the case
    // that backing away from a horde points the only starting weapon at nothing.
    base: { damage: 10, cooldown: 1350, amount: 2, area: 1, speed: 1, duration: 150, pierce: Infinity, knockback: 1, interval: 100, hitCooldown: 0 },
    levels: [{ damage: 4 }, { damage: 5 }, { area: 0.1 }, { damage: 8 }, { area: 0.1 }, { damage: 8 }, { damage: 8 }],
    visual: { frame: 'fx_slash', blend: 'add', tint: 0x4fe0ff, sfx: 'slash' },
    evolution: { requires: 'reactorCore', into: 'annihilationBlade' },
  },
  guidedLaser: {
    id: 'guidedLaser',
    nameKey: 'weapon.guidedLaser.name',
    descKey: 'weapon.guidedLaser.desc',
    icon: 'icon_guidedLaser',
    rarity: 100,
    maxLevel: 8,
    behavior: 'aimed',
    base: { damage: 10, cooldown: 1200, amount: 1, area: 1, speed: 1, duration: 1500, pierce: 1, knockback: 0.5, interval: 100, hitCooldown: 0 },
    levels: [{ amount: 1 }, { cooldown: -200 }, { amount: 1 }, { damage: 10 }, { amount: 1 }, { damage: 10 }, { amount: 1 }],
    visual: { frame: 'bolt_laser', sfx: 'laser' },
    evolution: { requires: 'coolingSystem', into: 'fusionLance' },
  },
  railgun: {
    id: 'railgun',
    nameKey: 'weapon.railgun.name',
    descKey: 'weapon.railgun.desc',
    icon: 'icon_railgun',
    rarity: 100,
    maxLevel: 8,
    behavior: 'stream',
    base: { damage: 6.5, cooldown: 1000, amount: 1, area: 1, speed: 1, duration: 1200, pierce: 1, knockback: 0.3, interval: 80, hitCooldown: 0 },
    levels: [{ amount: 1 }, { amount: 1, damage: 5 }, { amount: 1 }, { pierce: 1 }, { amount: 1, damage: 5 }, { amount: 1 }, { pierce: 1 }],
    visual: { frame: 'bolt_rail', sfx: 'rail' },
    evolution: { requires: 'nanoArmor', into: 'shredderRail' },
  },
  orbitalDrones: {
    id: 'orbitalDrones',
    nameKey: 'weapon.orbitalDrones.name',
    descKey: 'weapon.orbitalDrones.desc',
    icon: 'icon_orbitalDrones',
    rarity: 80,
    maxLevel: 8,
    behavior: 'orbit',
    base: { damage: 10, cooldown: 3000, amount: 1, area: 1, speed: 1, duration: 3000, pierce: Infinity, knockback: 0.4, interval: 0, hitCooldown: 500 },
    levels: [{ amount: 1 }, { speed: 0.3, area: 0.1 }, { duration: 500, damage: 10 }, { amount: 1 }, { speed: 0.3, area: 0.1 }, { duration: 500, damage: 10 }, { amount: 1 }],
    visual: { frame: 'orbit_drone', sfx: 'whoosh' },
    evolution: { requires: 'fieldAmp', into: 'satelliteArray' },
  },
  empField: {
    id: 'empField',
    nameKey: 'weapon.empField.name',
    descKey: 'weapon.empField.desc',
    icon: 'icon_empField',
    rarity: 70,
    maxLevel: 8,
    behavior: 'aura',
    base: { damage: 5, cooldown: Infinity, amount: 0, area: 1, speed: 1, duration: 0, pierce: Infinity, knockback: 0.4, interval: 0, hitCooldown: 1300 },
    levels: [
      { damage: 2, area: 0.4 },
      { hitCooldown: -100, damage: 1 },
      { area: 0.2, damage: 1 },
      { hitCooldown: -100, damage: 2 },
      { area: 0.2, damage: 1 },
      { hitCooldown: -100, damage: 1 },
      { area: 0.2, damage: 1 },
    ],
    visual: { frame: 'fx_ring', blend: 'add', tint: 0x40c0ff, sfx: 'emp' },
    evolution: { requires: 'lifeCore', into: 'singularityField' },
  },

  /**
   * 电弧锚桩: the first weapon in the game that is placed rather than carried. A stake alone does
   * nothing; arcs are strung between every pair in range and between every stake and the player,
   * and the player's own arcs are the brightest on the field, so walking away visibly turns most
   * of the damage off. The reach is fixed and only the width grows with area — a lattice that grew
   * with fieldAmp would have erased its own identity by the level the player actually reaches.
   */
  arcPylons: {
    id: 'arcPylons', nameKey: 'weapon.arcPylons.name', descKey: 'weapon.arcPylons.desc',
    icon: 'icon_arcPylons', rarity: 55, maxLevel: 8, behavior: 'pylon',
    // duration is held above amount x cooldown at every level, so `amount` is the cap that binds
    // and a shorter cooldown genuinely refills an abandoned field instead of doing nothing
    base: { damage: 7, cooldown: 3000, amount: 3, area: 1, speed: 1, duration: 15000, pierce: Infinity, knockback: 0.2, interval: 0, hitCooldown: 750 },
    levels: [
      { damage: 3 },
      { amount: 1, duration: 3000 },
      { damage: 4 },
      { area: 0.12, hitCooldown: -70, speed: 0.3 },
      { damage: 4 },
      { amount: 1, duration: 4000 },
      { damage: 4, area: 0.12, hitCooldown: -60, speed: 0.3 },
    ],
    visual: { frame: 'pylon_stake', blend: 'normal', tint: 0x5cf0b0, sfx: 'emp' },
    evolution: { requires: 'stabilizer', into: 'graviticLattice' },
  },
  /**
   * 电弧导体: worth nothing in an empty field and more with every body pressed together, so the
   * correct play is to walk towards the drones — the play contact damage has spent the whole game
   * punishing. The jump is short on purpose: a loose crowd breaks the chain, so density is the
   * resource rather than mere presence.
   */
  arcConduit: {
    id: 'arcConduit', nameKey: 'weapon.arcConduit.name', descKey: 'weapon.arcConduit.desc',
    icon: 'icon_arcConduit', rarity: 80, maxLevel: 8, behavior: 'chain',
    base: { damage: 6, cooldown: 1250, amount: 1, area: 1, speed: 1, duration: 140, pierce: 4, knockback: 0.5, interval: 0, hitCooldown: 0 },
    levels: [
      { pierce: 1 },
      { damage: 2 },
      { amount: 1, cooldown: -150 },
      { damage: 2 },
      { pierce: 2, area: 0.2 },
      { damage: 3 },
      { amount: 1, cooldown: -150 },
    ],
    visual: { frame: 'fx_arc', blend: 'add', tint: 0x4fe0ff, sfx: 'emp', beam: true },
    evolution: { requires: 'heatsink', into: 'stormLattice' },
  },
  /**
   * 平射炮: a piercing beam from the character's own body down the side she faces, once per
   * cooldown. The id still says pivot because it used to fire only on the turn; the name changed
   * with the rule, the id stayed so saves and telemetry keep their history.
   */
  pivotCannon: {
    id: 'pivotCannon', nameKey: 'weapon.pivotCannon.name', descKey: 'weapon.pivotCannon.desc',
    icon: 'icon_pivotCannon', rarity: 90, maxLevel: 8, behavior: 'pivot',
    base: { damage: 26, cooldown: 2400, amount: 1, area: 1, speed: 1, duration: 200, pierce: Infinity, knockback: 1.2, interval: 0, hitCooldown: 0 },
    levels: [
      { damage: 9 },
      { amount: 1 },
      { damage: 11 },
      { cooldown: -250 },
      { damage: 13, area: 0.1 },
      { amount: 1 },
      { damage: 19, area: 0.1 },
    ],
    visual: { frame: 'fx_lance', blend: 'add', tint: 0xff8a3d, sfx: 'rail', beam: true },
    evolution: { requires: 'railTuner', into: 'horizonWipe' },
  },
  // --- evolutions: reached only through a supply chest with the base weapon maxed and its passive owned
  annihilationBlade: {
    id: 'annihilationBlade', nameKey: 'weapon.annihilationBlade.name', descKey: 'weapon.annihilationBlade.desc',
    icon: 'icon_plasmaBlade', iconTint: 0xff66aa, rarity: 0, maxLevel: 8, behavior: 'slash', evolvedOnly: true,
    base: { damage: 60, cooldown: 900, amount: 3, area: 1.5, speed: 1, duration: 220, pierce: Infinity, knockback: 1.5, interval: 90, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_slash', blend: 'add', tint: 0xff66aa, sfx: 'slash' },
  },
  fusionLance: {
    id: 'fusionLance', nameKey: 'weapon.fusionLance.name', descKey: 'weapon.fusionLance.desc',
    icon: 'icon_guidedLaser', iconTint: 0xffd166, rarity: 0, maxLevel: 8, behavior: 'aimed', evolvedOnly: true,
    base: { damage: 45, cooldown: 600, amount: 5, area: 1.3, speed: 1.4, duration: 1500, pierce: 4, knockback: 0.6, interval: 70, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'bolt_laser', tint: 0xffd166, sfx: 'laser' },
  },
  shredderRail: {
    id: 'shredderRail', nameKey: 'weapon.shredderRail.name', descKey: 'weapon.shredderRail.desc',
    icon: 'icon_railgun', iconTint: 0xff7755, rarity: 0, maxLevel: 8, behavior: 'stream', evolvedOnly: true,
    base: { damage: 24, cooldown: 700, amount: 8, area: 1.2, speed: 1.3, duration: 1200, pierce: 6, knockback: 0.4, interval: 50, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'bolt_rail', tint: 0xff7755, sfx: 'rail' },
  },
  satelliteArray: {
    id: 'satelliteArray', nameKey: 'weapon.satelliteArray.name', descKey: 'weapon.satelliteArray.desc',
    icon: 'icon_orbitalDrones', iconTint: 0x9fe6ff, rarity: 0, maxLevel: 8, behavior: 'orbit', evolvedOnly: true,
    base: { damage: 40, cooldown: 400, amount: 5, area: 1.4, speed: 1.3, duration: 9000, pierce: Infinity, knockback: 0.6, interval: 0, hitCooldown: 400 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'orbit_drone', tint: 0x9fe6ff, sfx: 'whoosh' },
  },
  singularityField: {
    id: 'singularityField', nameKey: 'weapon.singularityField.name', descKey: 'weapon.singularityField.desc',
    icon: 'icon_empField', iconTint: 0xcc88ff, rarity: 0, maxLevel: 8, behavior: 'aura', evolvedOnly: true,
    base: { damage: 18, cooldown: Infinity, amount: 0, area: 2.0, speed: 1, duration: 0, pierce: Infinity, knockback: 0.8, interval: 0, hitCooldown: 600 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_ring', blend: 'add', tint: 0xcc88ff, sfx: 'emp' },
  },

  graviticLattice: {
    id: 'graviticLattice', nameKey: 'weapon.graviticLattice.name', descKey: 'weapon.graviticLattice.desc',
    icon: 'icon_arcPylons', iconTint: 0xb070ff, rarity: 0, maxLevel: 8, behavior: 'pylon', evolvedOnly: true,
    // a negative knockback is the evolution's verb: the arcs drag bodies onto the line and hold
    // them there, so the lattice stops being a fence and becomes a room with no way across
    base: { damage: 44, cooldown: 1500, amount: 7, area: 1.7, speed: 1.6, duration: 13500, pierce: Infinity, knockback: -0.5, interval: 0, hitCooldown: 380 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'pylon_stake', blend: 'add', tint: 0xb070ff, sfx: 'emp' },
  },
  stormLattice: {
    id: 'stormLattice', nameKey: 'weapon.stormLattice.name', descKey: 'weapon.stormLattice.desc',
    icon: 'icon_arcConduit', iconTint: 0xfff0b0, rarity: 0, maxLevel: 8, behavior: 'chain', evolvedOnly: true,
    // fourteen links at a tenth of falloff each: the first weapon whose output still climbs past
    // twenty bodies, which is the archetype's promise finally paid out
    base: { damage: 20, cooldown: 900, amount: 3, area: 1.2, speed: 1, duration: 200, pierce: 14, knockback: 0.5, interval: 0, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_arc', blend: 'add', tint: 0xfff0b0, sfx: 'emp', beam: true },
  },
  horizonWipe: {
    id: 'horizonWipe', nameKey: 'weapon.horizonWipe.name', descKey: 'weapon.horizonWipe.desc',
    icon: 'icon_pivotCannon', iconTint: 0xfff2c4, rarity: 0, maxLevel: 8, behavior: 'pivot', evolvedOnly: true,
    base: { damage: 120, cooldown: 1200, amount: 5, area: 1.5, speed: 1.6, duration: 260, pierce: Infinity, knockback: 2, interval: 0, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_lance', blend: 'add', tint: 0xfff2c4, sfx: 'rail', beam: true },
  },
} as const satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;
export const WEAPON_LIST: readonly WeaponDef[] = Object.values(WEAPONS);
