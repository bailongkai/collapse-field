import type { I18nKey } from '../i18n/types';

export type StatKey =
  | 'maxHealth' | 'recovery' | 'armor' | 'moveSpeed' | 'might' | 'area'
  | 'projectileSpeed' | 'duration' | 'amount' | 'cooldown' | 'luck'
  | 'growth' | 'greed' | 'magnet' | 'revival' | 'curse';
export type PlayerStats = Readonly<Record<StatKey, number>>;
export type StatBlock = Readonly<Partial<Record<StatKey, number>>>;
export const STAT_KEYS: readonly StatKey[] = [
  'maxHealth', 'recovery', 'armor', 'moveSpeed', 'might', 'area', 'projectileSpeed', 'duration',
  'amount', 'cooldown', 'luck', 'growth', 'greed', 'magnet', 'revival', 'curse',
];
/** mult stats store fractional bonuses (0.1 = +10%); flat stats add directly. */
export const STAT_KIND = {
  maxHealth: 'mult', recovery: 'flat', armor: 'flat', moveSpeed: 'mult', might: 'mult',
  area: 'mult', projectileSpeed: 'mult', duration: 'mult', amount: 'flat', cooldown: 'mult',
  luck: 'mult', growth: 'mult', greed: 'mult', magnet: 'mult', revival: 'flat', curse: 'mult',
} as const satisfies Record<StatKey, 'mult' | 'flat'>;

export interface WeaponParams {
  damage: number;
  /** ms; Infinity = never fires through the cooldown path (aura uses onTick only) */
  cooldown: number;
  amount: number;
  area: number;
  speed: number;
  /** ms */
  duration: number;
  /** Infinity allowed */
  pierce: number;
  knockback: number;
  /** ms between the shots of one volley */
  interval: number;
  /** ms per enemy between hits (aura / orbit) */
  hitCooldown: number;
}
export type WeaponBehaviorId = 'slash' | 'aimed' | 'stream' | 'orbit' | 'aura';
export interface WeaponDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly icon: string;
  /** roll weight */
  readonly rarity: number;
  readonly maxLevel: 8;
  readonly behavior: WeaponBehaviorId;
  readonly base: WeaponParams;
  /** length 7: additive deltas for L2..L8 */
  readonly levels: readonly Partial<WeaponParams>[];
  readonly visual: { frame: string; blend?: 'add' | 'normal'; tint?: number; sfx?: string };
  /** reserved for meta progression */
  readonly evolution?: { requires: string; into: string };
}
export interface PassiveDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly icon: string;
  readonly rarity: number;
  readonly maxLevel: number;
  readonly perLevel: StatBlock;
}

export type EnemyBehaviorId = 'chase' | 'line' | 'boss' | 'reaper';
export type GemTier = 'blue' | 'green' | 'red' | 'none';
export interface EnemyDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly frame: string;
  readonly tint?: number;
  readonly faceTarget: boolean;
  readonly hp: number;
  readonly damage: number;
  /** px/s */
  readonly speed: number;
  readonly radius: number;
  readonly gemTier: GemTier;
  readonly gemCount?: number;
  /** 0..1 */
  readonly knockbackResist: number;
  readonly behavior: EnemyBehaviorId;
  readonly invulnerable?: boolean;
  readonly bossBar?: boolean;
  readonly drops?: readonly { pickup: string; chance: number }[];
  readonly deathFx: 'small' | 'big';
}

export interface WaveEntry {
  readonly minute: number;
  readonly mix: readonly { enemy: string; weight: number }[];
  readonly minCount: number;
  /** ms */
  readonly interval: number;
  readonly batch: number;
  readonly hpMult: number;
  readonly dmgMult: number;
}
export type WaveEvent = { readonly at: number } & (
  | { readonly kind: 'swarm'; readonly enemy: string; readonly count: number; readonly pattern: 'hLine' | 'vLine' | 'diag'; readonly speedMult?: number }
  | { readonly kind: 'boss'; readonly enemy: string; readonly hpMult: number }
  | { readonly kind: 'ring'; readonly enemy: string; readonly count: number; readonly radius: number }
  | { readonly kind: 'reaper'; readonly enemy: string }
);
export interface StageDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly durationSec: number;
  readonly floorTexture: string;
  readonly floorTint: number;
  readonly decorFrames: readonly string[];
  /** one row per minute, 0..14 */
  readonly waves: readonly WaveEntry[];
  /** sorted by at */
  readonly events: readonly WaveEvent[];
  readonly gemCap: number;
  readonly spawnMargin: number;
  readonly despawnFactor: number;
}

export type PickupEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'vacuum' }
  | { kind: 'nuke' }
  | { kind: 'chest'; weaponLevels: number }
  | { kind: 'gold'; amount: number };
export interface PickupDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly frame: string;
  readonly radius: number;
  readonly effect: PickupEffect;
  /** per kill, 0..1 */
  readonly dropChance: number;
  readonly maxOnGround?: number;
  readonly magnetic: boolean;
  readonly sfx: string;
}

export interface CharacterDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly frame: string;
  readonly radius: number;
  readonly baseStats: PlayerStats;
  readonly startingWeapon: string;
  readonly levelBonuses?: readonly { everyLevels: number; stat: StatKey; amount: number }[];
}
