import type { I18nKey } from '../i18n/types';
import type { StatBlock } from './types';

export type ProtocolId = 'collapse' | 'oneSide' | 'noMagnet' | 'dash';

/**
 * Protocols: one rule change a player may take into a run, chosen on the launch screen and opened
 * by an achievement. The challenge toggle makes a stage harder and nothing else; a protocol changes
 * what the right play is, which is what brings a player who has cleared a stage back to it.
 *
 * Each is applied inside the Simulation, so a protocol run is as deterministic as any other and
 * the balance harness can measure one. `bonus` is folded into the run's stats like a permanent
 * upgrade; the rest of each rule lives where it acts (see Simulation and PROTOCOL_TUNING).
 */
export interface ProtocolDef {
  readonly id: ProtocolId;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  /** the achievement that opens it; its description is what the launch screen shows while locked */
  readonly achievement: string;
  readonly bonus?: StatBlock;
}

export const PROTOCOLS: Readonly<Record<ProtocolId, ProtocolDef>> = {
  // the station's own hazard on every stage: what the game is named after, opened by clearing it
  collapse: { id: 'collapse', nameKey: 'protocol.collapse.name', descKey: 'protocol.collapse.desc', achievement: 'clearStation' },
  // the marine's lesson made a rule: everything fires the way she faces, and hits harder for it
  oneSide: { id: 'oneSide', nameKey: 'protocol.oneSide.name', descKey: 'protocol.oneSide.desc', achievement: 'marineFive', bonus: { might: 0.4 } },
  // every gem has to be walked over, and pays more for it
  noMagnet: { id: 'noMagnet', nameKey: 'protocol.noMagnet.name', descKey: 'protocol.noMagnet.desc', achievement: 'level30', bonus: { growth: 0.3 } },
  // the turn becomes a dodge; opened by the first boss kill, so it is the first one most players see
  dash: { id: 'dash', nameKey: 'protocol.dash.name', descKey: 'protocol.dash.desc', achievement: 'bossSlayer' },
};

export const PROTOCOL_LIST: readonly ProtocolDef[] = Object.values(PROTOCOLS);

export function isProtocolId(v: unknown): v is ProtocolId {
  return typeof v === 'string' && v in PROTOCOLS;
}

export const PROTOCOL_TUNING = {
  /** 塌缩加剧: a stage without collapsing floor gets the station's three, and every cache pays this many times its rewards */
  collapse: { at: [120, 450, 780], rewardMult: 1.5 },
  /** 回身冲刺: on a turn, this long untouchable and this far along the new facing, at most this often */
  dash: { iframesMs: 150, px: 40, cooldownMs: 2000 },
} as const;
