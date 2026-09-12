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
  luck: 'mult', growth: 'mult', greed: 'mult', magnet: 'mult', revival: 'flat', curse: 'flat',
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
  /** tint applied to the icon, used to mark an evolved weapon that shares its base's art */
  readonly iconTint?: number;
  /** at max level, owning this passive lets a supply chest evolve the weapon into `into` */
  readonly evolution?: { readonly requires: string; readonly into: string };
  /** never offered on level-up; only reachable through evolution */
  readonly evolvedOnly?: boolean;
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

export type EnemyBehaviorId = 'chase' | 'line' | 'boss'  | 'ranged' | 'dasher' | 'bomber' | 'healer' | 'tractor' | 'nest' | 'blink' | 'layer' | 'prop';
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
  /** ranged behavior: hold this distance and fire at the player on an interval */
  readonly ranged?: { readonly range: number; readonly intervalMs: number; readonly boltSpeed: number; readonly boltDamage: number };
  /** dasher behavior: telegraph, then lunge at a multiple of base speed */
  readonly dash?: { readonly triggerRange: number; readonly telegraphMs: number; readonly durationMs: number; readonly speedMult: number; readonly cooldownMs: number };
  /** bomber behavior: close in, arm for `fuseMs` while flashing, then detonate; a speed of 0 makes a mine */
  readonly explode?: { readonly triggerRange: number; readonly fuseMs: number; readonly radius: number; readonly damage: number };
  /** healer behavior: keeps its distance and heals every enemy within `range` on an interval */
  readonly heal?: { readonly range: number; readonly intervalMs: number; readonly amount: number; readonly keepDistance: number };
  /** tractor behavior: holds `keepDistance` and drags the player towards itself at `pull` px/s inside `range` */
  readonly tractor?: { readonly range: number; readonly pull: number; readonly keepDistance: number };
  /** nest behavior: never moves; hatches `count` of `summon` every `intervalMs` */
  readonly nest?: { readonly summon: string; readonly count: number; readonly intervalMs: number };
  /** blink behavior: every `everyMs`, reappears `distance` from the player in a random direction */
  readonly blink?: { readonly everyMs: number; readonly distance: number; readonly telegraphMs: number };
  /** layer behavior: circles the player at `keepDistance`, leaving a `mine` behind every `intervalMs` */
  readonly layer?: { readonly mine: string; readonly intervalMs: number; readonly keepDistance: number; readonly maxMines: number };
  /** on death, this many of that enemy appear where it fell */
  readonly split?: { readonly enemy: string; readonly count: number };
  /** boss behavior: periodic charge plus reinforcements, and whichever extras give this boss its own fight */
  readonly boss?: BossConfig;
}

export interface BossConfig {
  readonly chargeEveryMs: number;
  readonly telegraphMs: number;
  readonly chargeMs: number;
  readonly chargeSpeedMult: number;
  readonly summon: string;
  readonly summonCount: number;
  readonly summonEveryMs: number;
  /** a fan of hostile bolts at the player on an interval */
  readonly volley?: { readonly everyMs: number; readonly count: number; readonly spreadDeg: number; readonly boltSpeed: number; readonly boltDamage: number };
  /** drops a `mine` (a bomber with no speed) where it stands, on an interval, up to `max` alive */
  readonly mine?: { readonly enemy: string; readonly everyMs: number; readonly max: number };
  /** drags the player towards itself inside `range` at up to `strength` px/s */
  readonly pull?: { readonly range: number; readonly strength: number };
  /** fades out and reappears `distance` from the player, then charges at once */
  readonly blink?: { readonly everyMs: number; readonly distance: number; readonly telegraphMs: number };
  /** the run's last boss: killing it is how a stage is cleared; after `enrageAfterMs` it stops being fair */
  readonly final?: { readonly enrageAfterMs: number; readonly enrageSpeedMult: number; readonly enrageDmgMult: number; readonly gold: number };
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
  /**
   * Multiplies every enemy's move speed for this minute. The player moves at 200 px/s and the
   * fastest ordinary enemy at 150, so without this a straight line is never caught; a stage that
   * wants to punish running has to say so here.
   */
  readonly speedMult?: number;
}
export type WaveEvent = { readonly at: number } & (
  | { readonly kind: 'swarm'; readonly enemy: string; readonly count: number; readonly pattern: 'hLine' | 'vLine' | 'diag'; readonly speedMult?: number }
  | { readonly kind: 'boss'; readonly enemy: string; readonly hpMult: number }
  | { readonly kind: 'ring'; readonly enemy: string; readonly count: number; readonly radius: number }
  | { readonly kind: 'final'; readonly enemy: string; readonly hpMult: number }
  /** One tough enemy carrying a reward, on its own: the run's punctuation between boss fights. */
  | { readonly kind: 'elite'; readonly enemy: string; readonly hpMult: number }
  /**
   * Four rushes at once, one from each side, each line with a gap every `gapEvery` bodies. The
   * answer to a rush from one side is to step aside; the answer to this is to find the gap.
   */
  | { readonly kind: 'encircle'; readonly enemy: string; readonly count: number; readonly gapEvery: number; readonly speedMult?: number }
  /** every nest alive hatches at once, `count` each: the lab's own set piece */
  | { readonly kind: 'hatchAll'; readonly enemy: string; readonly count: number }
);
export interface StageDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  /** position in the campaign; surviving stage n unlocks stage n + 1 */
  readonly order: number;
  readonly durationSec: number;
  readonly floorTexture: string;
  readonly floorTint: number;
  readonly decorFrames: readonly string[];
  /** one row per minute, 0..14 */
  readonly waves: readonly WaveEntry[];
  /** sorted by at */
  readonly events: readonly WaveEvent[];
  /**
   * Breakable scenery: a prop enemy placed on the spawn ring every `everyMs`, at most `max` alive.
   * It does not chase, bite or count as a kill; it breaks, and it drops something.
   */
  readonly props?: { readonly enemy: string; readonly everyMs: number; readonly max: number };
  /**
   * Pickups placed at fixed world coordinates when the run starts, relative to where the player
   * stands. They do not come to the player; the HUD points at the nearest one, and going to get it
   * is the decision — a detour across a field that is not empty.
   */
  readonly relics?: readonly { readonly pickup: string; readonly x: number; readonly y: number }[];
  /**
   * Solid rectangles in world space, relative to the start. The player and ground enemies slide
   * around them; rushes, projectiles and scenery pass over. A map with walls asks where to stand
   * in a way an open floor never can, and a wall between the player and a crowd is the one thing
   * here that a kiting policy cannot outrun.
   */
  readonly obstacles?: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly frame: string }[];
  readonly gemCap: number;
  readonly spawnMargin: number;
  readonly despawnFactor: number;
}

export type PickupEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'vacuum' }
  | { kind: 'nuke' }
  /**
   * A supply chest. `grade` decides how many rewards it rolls, not what they are: a chest that
   * cost a scripted boss fight should never pay out a single weapon level.
   */
  | { kind: 'chest'; grade: 'standard' | 'boss' }
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
  /**
   * How near the player has to get before this is pulled in, when it differs from the usual magnet
   * radius. A chest is the payoff for a fight and must not be walkable-past, so it reaches out
   * about half a screen rather than the arm's length a coin does.
   */
  readonly magnetRadius?: number;
  /** How fast it closes once it is coming, when the usual pickup speed is wrong for it. */
  readonly magnetSpeed?: number;
  /** Left on the ground rather than recycled when the player walks away; chests are come-back-for. */
  readonly persistent?: boolean;
  /**
   * The least time that may pass between two of these dropping, in run milliseconds.
   *
   * A flat per-kill chance is a positive feedback loop for anything valuable: a run that is going
   * well kills more, so it drops more, so it gets stronger. Measured, one seed on a wide view ended
   * at level 53 with 6,522 kills and about twenty-six of these, while an ordinary run saw one.
   */
  readonly minIntervalMs?: number;
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
  /** gold to unlock in the shop; absent means available from the start */
  readonly cost?: number;
  /** the character's one signature ability, triggered by play rather than by a button */
  readonly signature: SignatureDef;
}

/**
 * Signature abilities fire on their own — there is no button for one on a phone with a stick and
 * a pause control — so each is a rule about when something happens, with a cooldown.
 */
export type SignatureDef =
  /** below `threshold` of max health: heal `healFraction` and become invulnerable for `invulnMs` */
  | { readonly kind: 'secondWind'; readonly nameKey: I18nKey; readonly descKey: I18nKey; readonly threshold: number; readonly healFraction: number; readonly invulnMs: number; readonly cooldownMs: number }
  /** every `kills` kills: `bonus` is added to stats for `durationMs` */
  | { readonly kind: 'killStreak'; readonly nameKey: I18nKey; readonly descKey: I18nKey; readonly kills: number; readonly bonus: StatBlock; readonly durationMs: number }
  /** opening a chest adds `bonus` to stats for `durationMs` */
  | { readonly kind: 'chestSurge'; readonly nameKey: I18nKey; readonly descKey: I18nKey; readonly bonus: StatBlock; readonly durationMs: number }
  /** a charge that negates the next hit outright, then takes `cooldownMs` to come back */
  | { readonly kind: 'shield'; readonly nameKey: I18nKey; readonly descKey: I18nKey; readonly cooldownMs: number }
  /** taking a hit adds `bonus` to stats for `durationMs` */
  | { readonly kind: 'onHurt'; readonly nameKey: I18nKey; readonly descKey: I18nKey; readonly bonus: StatBlock; readonly durationMs: number; readonly cooldownMs: number };
