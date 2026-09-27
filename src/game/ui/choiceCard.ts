import { t, tDynamic } from '../../i18n';
import { describeDeltas } from '../../core/levelup/roll';
import { CONTENT } from '../../core/content/registry';
import { passiveBenefit } from '../../core/weapons/statUse';
import type { LevelUpChoice, OwnedItem } from '../../core/sim/runState';

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
 * `fromLevel` is for a chest that paid the same item more than once; see `describeRewards`.
 * `build` is the weapons the player holds: with it a passive's card names the ones it will make
 * stronger, or says that none of them can use it and which evolution it is half of.
 */
export function describeChoice(choice: LevelUpChoice, fromLevel?: number, build?: readonly OwnedItem[]): ChoiceInfo {
  if (choice.kind === 'weapon') {
    const def = CONTENT.weapons[choice.id];
    const from = fromLevel ?? choice.toLevel - 1;
    const isNew = from === 0;
    let body = isNew
      ? t(def.descKey)
      : describeDeltas(sumDeltas(def.levels.slice(from - 1, choice.toLevel - 1)))
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
      tag: isNew ? t('levelup.new_weapon') : t('levelup.level_to', { a: from, b: choice.toLevel }),
      body: body || t(def.descKey),
      icon: def.icon,
      iconTint: def.iconTint,
    };
  }
  if (choice.kind === 'passive') {
    const def = CONTENT.passives[choice.id];
    const from = fromLevel ?? choice.toLevel - 1;
    const isNew = from === 0;
    return {
      title: t(def.nameKey),
      tag: isNew ? t('levelup.new_passive') : t('levelup.level_to', { a: from, b: choice.toLevel }),
      body: t(def.descKey) + (build ? passiveNote(def.id, build) : ''),
      icon: def.icon,
    };
  }
  if (choice.kind === 'limit') {
    const def = CONTENT.weapons[choice.id];
    const pct = Math.round(choice.amount * 100);
    const statName = t(`limit.${choice.stat}` as Parameters<typeof t>[0]);
    return {
      title: def ? t(def.nameKey) : choice.id,
      tag: t('levelup.limit_break'),
      body: `${statName} ${choice.stat === 'cooldown' ? '−' : '+'}${pct}%`,
      icon: def?.icon ?? 'pk_coin',
      iconTint: def?.iconTint,
    };
  }
  if (choice.kind === 'gold') {
    return { title: t('levelup.gold', { n: choice.amount }), tag: '', body: t('levelup.gold_desc', { n: choice.amount }), icon: 'pk_coin' };
  }
  const healAmount = choice.kind === 'heal' ? choice.amount : 0;
  return { title: t('levelup.heal'), tag: '', body: t('levelup.heal_desc', { n: healAmount }), icon: 'pk_heal' };
}

/**
 * A chest's rewards as rows, with every level paid to the same item folded into one row.
 *
 * A chest that pushes one weapon twice used to show "Lv 4 → 5" and "Lv 5 → 6" as two cards, which
 * reads exactly like the level-up offer: two options for the same weapon, pick one. Nothing in a
 * chest is a choice, so the row says what happened to the item as a whole — "Lv 4 → 6" and the sum
 * of what both levels added. A row sits where the item first landed.
 */
export function describeRewards(rewards: readonly LevelUpChoice[]): ChoiceInfo[] {
  const rows: { choice: LevelUpChoice; from?: number }[] = [];
  for (const choice of rewards) {
    if (choice.kind !== 'weapon' && choice.kind !== 'passive') {
      rows.push({ choice });
      continue;
    }
    const row = rows.find((r) => r.choice.kind === choice.kind && r.choice.id === choice.id);
    if (!row) {
      rows.push({ choice, from: choice.toLevel - 1 });
      continue;
    }
    const held = row.choice as typeof choice;
    row.from = Math.min(row.from ?? held.toLevel - 1, choice.toLevel - 1);
    if (choice.toLevel > held.toLevel) row.choice = choice;
  }
  return rows.map((r) => describeChoice(r.choice, r.from));
}

function sumDeltas(levels: readonly Record<string, number | undefined>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const delta of levels) {
    for (const [param, raw] of Object.entries(delta)) {
      if (raw === undefined) continue;
      // two levels of +10% must read as +20%, not as what 0.1 + 0.1 happens to be in binary
      out[param] = Math.round(((out[param] ?? 0) + raw) * 1e6) / 1e6;
    }
  }
  return out;
}

/** The second line of a passive's card: who it helps in this build, or what it is for if nobody. */
function passiveNote(id: string, build: readonly OwnedItem[]): string {
  const def = CONTENT.passives[id];
  if (!def) return '';
  const benefit = passiveBenefit(def, build, CONTENT.weapons);
  if (benefit.weapons.length > 0) {
    // every weapon in the build: saying so is shorter than listing them
    if (benefit.weapons.length === build.length && build.length > 1) return `\n${t('levelup.affects_all')}`;
    const names = benefit.weapons.map((w) => t(CONTENT.weapons[w].nameKey)).join(t('common.list_sep'));
    return `\n${t('levelup.affects', { names })}`;
  }
  if (benefit.player) return '';
  const paired = Object.values(CONTENT.weapons).find((w) => w.evolution?.requires === id);
  const use = paired ? t('levelup.affects_evolves', { weapon: t(paired.nameKey) }) : '';
  return `\n${t('levelup.affects_none')}${use ? ` · ${use}` : ''}`;
}
