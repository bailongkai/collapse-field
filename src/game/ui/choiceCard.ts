import { t, tDynamic } from '../../i18n';
import { describeDeltas } from '../../core/levelup/roll';
import { CONTENT } from '../../core/content/registry';
import type { LevelUpChoice } from '../../core/sim/runState';

export interface ChoiceInfo {
  title: string;
  tag: string;
  body: string;
  icon: string;
  iconTint?: number;
}

/**
 * How one reward reads on a card. Shared by the level-up offer and the chest reveal so the two can
 * never drift apart: a chest hands out the same `LevelUpChoice` values the level-up screen does,
 * and a player who sees "等离子刃 Lv 4 → 5" in one place must see the same words in the other.
 */
export function describeChoice(choice: LevelUpChoice): { title: string; tag: string; body: string; icon: string; iconTint?: number } {
  if (choice.kind === 'weapon') {
    const def = CONTENT.weapons[choice.id];
    const isNew = choice.toLevel === 1;
    const delta = isNew ? null : def.levels[choice.toLevel - 2];
    let body = isNew
      ? t(def.descKey)
      : describeDeltas(delta ?? {})
          .map((d) => tDynamic(d.key, { v: d.value }))
          .join(' · ');
    // reaching max level is when the evolution becomes possible; say so on the card
    if (!isNew && choice.toLevel === def.maxLevel && def.evolution) {
      const passive = CONTENT.passives[def.evolution.requires];
      const into = CONTENT.weapons[def.evolution.into];
      if (passive && into) body += ` · ${t('evolve.hint', { passive: t(passive.nameKey), into: t(into.nameKey) })}`;
    }
    return {
      title: t(def.nameKey),
      tag: isNew ? t('levelup.new_weapon') : t('levelup.level_to', { a: choice.toLevel - 1, b: choice.toLevel }),
      body: body || t(def.descKey),
      icon: def.icon,
      iconTint: def.iconTint,
    };
  }
  if (choice.kind === 'passive') {
    const def = CONTENT.passives[choice.id];
    const isNew = choice.toLevel === 1;
    return {
      title: t(def.nameKey),
      tag: isNew ? t('levelup.new_passive') : t('levelup.level_to', { a: choice.toLevel - 1, b: choice.toLevel }),
      body: t(def.descKey),
      icon: def.icon,
    };
  }
  if (choice.kind === 'gold') {
    return { title: t('levelup.gold', { n: choice.amount }), tag: '', body: t('levelup.gold_desc', { n: choice.amount }), icon: 'pk_coin' };
  }
  const healAmount = choice.kind === 'heal' ? choice.amount : 0;
  return { title: t('levelup.heal'), tag: '', body: t('levelup.heal_desc', { n: healAmount }), icon: 'pk_heal' };
}
