import type { I18nKey } from '../i18n/types';
import type { StatKey } from './types';

/** A permanent upgrade bought with gold between runs. `perLevel` is a stat bonus like a passive's. */
export interface UpgradeDef {
  readonly id: string;
  readonly nameKey: I18nKey;
  readonly descKey: I18nKey;
  readonly icon: string;
  /** a stat upgrade; absent for the ones that grant level-up charges instead */
  readonly stat?: StatKey;
  /** a charge upgrade: one more of these per run per level */
  readonly charge?: 'reroll' | 'skip' | 'banish';
  readonly perLevel: number;
  readonly maxLevel: number;
  /** gold cost of each level, in order */
  readonly costs: readonly number[];
}

export const UPGRADES = {
  hull: { id: 'hull', nameKey: 'upgrade.hull.name', descKey: 'upgrade.hull.desc', icon: 'icon_lifeCore', stat: 'maxHealth', perLevel: 0.1, maxLevel: 5, costs: [100, 200, 350, 550, 800] },
  firepower: { id: 'firepower', nameKey: 'upgrade.firepower.name', descKey: 'upgrade.firepower.desc', icon: 'icon_reactorCore', stat: 'might', perLevel: 0.05, maxLevel: 5, costs: [120, 240, 420, 650, 950] },
  plating: { id: 'plating', nameKey: 'upgrade.plating.name', descKey: 'upgrade.plating.desc', icon: 'icon_nanoArmor', stat: 'armor', perLevel: 1, maxLevel: 3, costs: [200, 450, 800] },
  coolant: { id: 'coolant', nameKey: 'upgrade.coolant.name', descKey: 'upgrade.coolant.desc', icon: 'icon_coolingSystem', stat: 'cooldown', perLevel: -0.03, maxLevel: 5, costs: [150, 300, 500, 750, 1050] },
  servos: { id: 'servos', nameKey: 'upgrade.servos.name', descKey: 'upgrade.servos.desc', icon: 'icon_railgun', stat: 'moveSpeed', perLevel: 0.05, maxLevel: 4, costs: [120, 250, 450, 700] },
  magnet: { id: 'magnet', nameKey: 'upgrade.magnet.name', descKey: 'upgrade.magnet.desc', icon: 'pk_vacuum', stat: 'magnet', perLevel: 0.25, maxLevel: 3, costs: [100, 220, 400] },
  luck: { id: 'luck', nameKey: 'upgrade.luck.name', descKey: 'upgrade.luck.desc', icon: 'icon_fieldAmp', stat: 'luck', perLevel: 0.1, maxLevel: 3, costs: [180, 380, 650] },
  growth: { id: 'growth', nameKey: 'upgrade.growth.name', descKey: 'upgrade.growth.desc', icon: 'gem_big', stat: 'growth', perLevel: 0.05, maxLevel: 5, costs: [150, 300, 500, 750, 1050] },
  // level-up agency. These are what turn "take what you are given" into a build.
  reroll: { id: 'reroll', nameKey: 'upgrade.reroll.name', descKey: 'upgrade.reroll.desc', icon: 'orbit_drone', charge: 'reroll', perLevel: 1, maxLevel: 4, costs: [150, 300, 500, 800] },
  skip: { id: 'skip', nameKey: 'upgrade.skip.name', descKey: 'upgrade.skip.desc', icon: 'bolt_rail', charge: 'skip', perLevel: 1, maxLevel: 3, costs: [120, 260, 450] },
  banish: { id: 'banish', nameKey: 'upgrade.banish.name', descKey: 'upgrade.banish.desc', icon: 'pk_nuke', charge: 'banish', perLevel: 1, maxLevel: 3, costs: [200, 400, 700] },
  revival: { id: 'revival', nameKey: 'upgrade.revival.name', descKey: 'upgrade.revival.desc', icon: 'pk_heal', stat: 'revival', perLevel: 1, maxLevel: 1, costs: [1500] },
} as const satisfies Record<string, UpgradeDef>;

export type UpgradeId = keyof typeof UPGRADES;
export const UPGRADE_LIST: readonly UpgradeDef[] = Object.values(UPGRADES);
