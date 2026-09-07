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
    visual: { frame: 'fx_slash', blend: 'add', tint: 0x4fe0ff, sfx: 'fire' },
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
    visual: { frame: 'bolt_laser', sfx: 'fire' },
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
    visual: { frame: 'orbit_drone', sfx: 'fire' },
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
  // --- evolutions: reached only through a supply chest with the base weapon maxed and its passive owned
  annihilationBlade: {
    id: 'annihilationBlade', nameKey: 'weapon.annihilationBlade.name', descKey: 'weapon.annihilationBlade.desc',
    icon: 'icon_plasmaBlade', iconTint: 0xff66aa, rarity: 0, maxLevel: 8, behavior: 'slash', evolvedOnly: true,
    base: { damage: 60, cooldown: 900, amount: 3, area: 1.5, speed: 1, duration: 220, pierce: Infinity, knockback: 1.5, interval: 90, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_slash', blend: 'add', tint: 0xff66aa, sfx: 'fire' },
  },
  fusionLance: {
    id: 'fusionLance', nameKey: 'weapon.fusionLance.name', descKey: 'weapon.fusionLance.desc',
    icon: 'icon_guidedLaser', iconTint: 0xffd166, rarity: 0, maxLevel: 8, behavior: 'aimed', evolvedOnly: true,
    base: { damage: 45, cooldown: 600, amount: 5, area: 1.3, speed: 1.4, duration: 1500, pierce: 4, knockback: 0.6, interval: 70, hitCooldown: 0 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'bolt_laser', tint: 0xffd166, sfx: 'fire' },
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
    visual: { frame: 'orbit_drone', tint: 0x9fe6ff, sfx: 'fire' },
  },
  singularityField: {
    id: 'singularityField', nameKey: 'weapon.singularityField.name', descKey: 'weapon.singularityField.desc',
    icon: 'icon_empField', iconTint: 0xcc88ff, rarity: 0, maxLevel: 8, behavior: 'aura', evolvedOnly: true,
    base: { damage: 18, cooldown: Infinity, amount: 0, area: 2.0, speed: 1, duration: 0, pierce: Infinity, knockback: 0.8, interval: 0, hitCooldown: 600 },
    levels: [{}, {}, {}, {}, {}, {}, {}],
    visual: { frame: 'fx_ring', blend: 'add', tint: 0xcc88ff, sfx: 'emp' },
  },
} as const satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;
export const WEAPON_LIST: readonly WeaponDef[] = Object.values(WEAPONS);
