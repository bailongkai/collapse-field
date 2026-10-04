import Phaser from 'phaser';
import { formatTime, t } from '../../i18n';
import { textStyle, COLORS } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel } from '../layout';
import { IconRow } from '../ui/iconRow';
import { planResults, oneColumnWidth, twoColumnWidth, RESULTS_HEADER, RESULTS_BLOCK_GAP } from '../ui/resultsLayout';
import { commitRun, awardAchievements, grantGold, interstitialDue } from '../../core/save/saveData';
import { analytics, getPlatform } from '../../platform';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { ACHIEVEMENTS as CONTENT_ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
import { stageUnlockedBySurviving } from '../../core/save/unlocks';
import { CONTENT } from '../../core/content/registry';
import { app } from '../app';
import { PROTOCOLS, isProtocolId } from '../../data/protocols';
import type { OwnedItem, RunEnd } from '../../core/sim/runState';

export interface ResultsData {
  timeSec: number;
  kills: number;
  level: number;
  gold: number;
  ended: RunEnd;
  weapons: OwnedItem[];
  passives: OwnedItem[];
  seed: number;
  characterId: string;
  stageId: string;
  curse: number;
  /** the protocol the run was played under, '' for none */
  protocol?: string;
  chestsOpened: number;
  bossKills: number;
  damageByWeapon: { id: string; damage: number }[];
  seen: string[];
  /** what landed the last hit, when the run ended in death */
  killedBy?: string;
}

/** End-of-run summary. Commits the run into the save on entry, then offers a retry or the menu. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    music.setMood('menu');
    music.setIntensity(0);
    const cx = viewOf(this).width / 2;
    const survived = data.ended === 'survived';
    const ctx = app();

    // a resize rebuilds the screen with the same summary; the run is only committed once, and the
    // stage it opened is remembered so the rebuilt screen can still say so
    const carried = data as ResultsData & { committed?: boolean; unlockedStage?: string | null; earned?: string[]; doubled?: boolean };
    let unlockedStage: string | null = carried.unlockedStage ?? null;
    let earned: string[] = carried.earned ?? [];
    if (!carried.committed) {
      unlockedStage = survived && data.stageId ? stageUnlockedBySurviving(ctx.save, data.stageId) : null;
      const summary = {
        timeSec: data.timeSec ?? 0,
        kills: data.kills ?? 0,
        gold: data.gold ?? 0,
        stageId: data.stageId,
        characterId: data.characterId,
        survived,
        level: data.level,
        curse: data.curse,
        chestsOpened: data.chestsOpened,
        bossKills: data.bossKills,
        items: [...(data.weapons ?? []), ...(data.passives ?? [])],
        evolved: (data.weapons ?? []).filter((w) => CONTENT.weapons[w.id]?.evolvedOnly).map((w) => w.id),
        seen: data.seen ?? [],
      };
      ctx.save = commitRun(ctx.storage, ctx.save, summary);
      // judged after the run is folded in, so cumulative conditions see this run too
      const award = awardAchievements(ctx.storage, ctx.save, summary);
      ctx.save = award.save;
      earned = award.earned;
      if (unlockedStage) analytics.track({ name: 'unlock', kind: 'stage', id: unlockedStage });
      for (const id of earned) analytics.track({ name: 'unlock', kind: 'achievement', id });
      // an interstitial every few run ends, never over the first frame of a fresh player's game,
      // and never once it has been bought off
      const due = interstitialDue(ctx.storage, ctx.save);
      ctx.save = due.save;
      if (due.show) void getPlatform().ads.showInterstitial().then(() => analytics.track({ name: 'ad_shown', kind: 'interstitial', earned: false, result: 'completed' }));
    }
    const doubled = carried.doubled ?? false;
    restartOnResize(this, { ...data, committed: true, unlockedStage, earned, doubled });

    const view = viewOf(this);
    const cy = view.height / 2;
    const max = fitPanel(this, view.width, view.height);
    const oneW = oneColumnWidth(max.w);
    const twoW = twoColumnWidth(max.w);
    const stacked = oneW < 520;
    const offerDouble = !doubled && (data.gold ?? 0) > 0 && getPlatform().ads.available();

    // The summary and the build are each built in a container from its own top-left, so they can
    // be measured before anything is placed. Where they go is `planResults`' decision.
    const colW = oneW - 60;
    const half = Math.min(150, colW / 2);
    const stats = this.add.container(0, 0);
    const build = this.add.container(0, 0);

    const stage = data.stageId ? CONTENT.stages[data.stageId] : undefined;
    const rows: [string, string][] = [
      [t('results.stage'), (stage ? t(stage.nameKey) : '—') + (data.curse > 0 ? ` · ${t('results.challenge', { n: Math.round(data.curse * 100) })}` : '')],
      [t('results.time'), formatTime(data.timeSec ?? 0) + (!survived && (data.timeSec ?? 0) >= 900 ? ` · ${t('results.final_reached')}` : '')],
      [t('results.level'), String(data.level ?? 1)],
      [t('results.kills'), String(data.kills ?? 0)],
      [t('results.gold'), doubled ? t('results.doubled', { n: data.gold ?? 0 }) : String(data.gold ?? 0)],
    ];
    const protocol = data.protocol && isProtocolId(data.protocol) ? PROTOCOLS[data.protocol] : null;
    if (protocol) rows.splice(1, 0, [t('results.protocol'), t(protocol.nameKey)]);
    // the one line a new player needs after a death: what to look out for next time
    if (!survived && data.killedBy) rows.push([t('results.killedBy'), this.causeName(data.killedBy)]);
    rows.forEach(([label, value], i) => {
      const y = 18 + i * 36;
      stats.add(this.add.text(-half, y, label, textStyle(19, { color: COLORS.dim })).setOrigin(0, 0.5));
      stats.add(this.add.text(half, y, value, textStyle(19, { bold: true })).setOrigin(1, 0.5));
    });
    let statsH = rows.length * 36;

    if (unlockedStage) {
      const next = CONTENT.stages[unlockedStage];
      stats.add(
        this.add
          .text(0, statsH + 20, t('results.unlocked_stage', { name: next ? t(next.nameKey) : unlockedStage }), textStyle(16, { bold: true, color: COLORS.good }))
          .setOrigin(0.5),
      );
      statsH += 40;
    }
    let achievements: Phaser.GameObjects.Text | null = null;
    if (earned.length > 0) {
      const table = CONTENT_ACHIEVEMENTS as Record<string, AchievementDef>;
      const names = earned.map((id) => (table[id] ? t(table[id].nameKey) : id)).join(' · ');
      achievements = this.add
        .text(0, statsH + 8, t('results.achievements', { names }), textStyle(15, { bold: true, color: COLORS.gold, wrapWidth: colW, align: 'center' }))
        .setOrigin(0.5, 0);
      stats.add(achievements);
    }
    // a long list of achievements wraps, and wraps sooner in a column half as wide
    const statsHeight = (wrap: number): number => {
      if (!achievements) return statsH;
      achievements.setWordWrapWidth(wrap, true);
      return statsH + 8 + achievements.height;
    };

    const weapons = new IconRow(this, -half + 20, 16, 6, 32);
    weapons.setItems(data.weapons ?? [], 'weapon');
    weapons.addTo(build);
    const passives = new IconRow(this, -half + 20, 58, 6, 32);
    passives.setItems(data.passives ?? [], 'passive');
    passives.addTo(build);
    let buildH = 74;

    // which weapon did the work: the same bars the reference game ends on, and the only honest
    // answer to "was that pick worth it"
    const dealt = (data.damageByWeapon ?? []).filter((d) => d.damage > 0).sort((a, b) => b.damage - a.damage);
    const total = dealt.reduce((n, d) => n + d.damage, 0);
    if (total > 0) {
      const barW = half * 2;
      const barX = -half;
      const barTop = 108;
      build.add(this.add.text(0, barTop - 22, t('results.damage'), textStyle(14, { color: COLORS.dim })).setOrigin(0.5));
      const shown = dealt.slice(0, 4);
      shown.forEach((d, i) => {
        const y = barTop + i * 22;
        const def = CONTENT.weapons[d.id];
        const frac = d.damage / total;
        build.add(this.add.rectangle(barX, y, barW, 14, 0x0d1420).setOrigin(0, 0.5));
        build.add(this.add.rectangle(barX, y, barW * frac, 14, def?.iconTint ?? 0x4fe0ff).setOrigin(0, 0.5).setAlpha(0.85));
        // stroked, because a full bar puts the text on top of its own colour
        build.add(this.add.text(barX + 6, y, def ? t(def.nameKey) : d.id, textStyle(12, { bold: true, stroke: true })).setOrigin(0, 0.5));
        build.add(this.add.text(barX + barW - 6, y, `${Math.round(frac * 100)}%`, textStyle(12, { bold: true, stroke: true })).setOrigin(1, 0.5));
      });
      buildH = barTop + (shown.length - 1) * 22 + 10;
    }

    // what the buttons take from the bottom of the panel, their own margin included
    const footerH = 88 + (stacked ? 60 : 0) + (offerDouble ? 56 : 0);
    const twoColW = twoW > 0 ? twoW / 2 - 40 : 0;
    const plan = planResults({
      maxW: max.w,
      maxH: max.h,
      footerH,
      one: { stats: statsHeight(colW), build: buildH },
      two: twoW > 0 ? { stats: statsHeight(twoColW), build: buildH } : null,
    });
    const finalStatsH = statsHeight(plan.columns === 2 ? twoColW : colW);
    const panel = { w: plan.panelW, h: plan.panelH };
    const top = cy - panel.h / 2;

    this.add.rectangle(cx, cy, view.width, view.height, 0x05070c, 0.93);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    const title = this.add
      .text(cx, top + 52, survived ? t('results.survived') : t('results.died'), textStyle(Math.round(Math.min(44, panel.w * 0.075)), { bold: true, color: survived ? COLORS.good : COLORS.warn }))
      .setOrigin(0.5);
    // the panel is drawn after the content it was sized from, so the content goes back on top
    this.children.bringToTop(title);
    this.children.bringToTop(stats);
    this.children.bringToTop(build);

    const contentTop = top + RESULTS_HEADER;
    stats.setScale(plan.scale);
    build.setScale(plan.scale);
    if (plan.columns === 2) {
      // side by side the pair is shorter than the room it was given; sit it in the middle
      const room = panel.h - RESULTS_HEADER - footerH;
      const y = contentTop + Math.max(0, (room - Math.max(finalStatsH, buildH) * plan.scale) / 2);
      stats.setPosition(cx - panel.w / 4, y);
      build.setPosition(cx + panel.w / 4, y);
    } else {
      stats.setPosition(cx, contentTop);
      build.setPosition(cx, contentTop + (finalStatsH + RESULTS_BLOCK_GAP) * plan.scale);
    }

    const btnW = Math.min(220, panel.w / 2 - 24);
    const btnY = cy + panel.h / 2 - 48;
    // the gold of this run again for an ad: the one offer worth making every time, and only once
    if (offerDouble) {
      const dbl = new UiButton(this, cx, btnY - (stacked ? 120 : 60), { id: 'results.doubleGold', label: t('results.doubleGold'), width: Math.min(300, panel.w - 48), height: 44, fontSize: 17, onPress: () => void this.doubleGold(data, dbl) });
    }
    if (stacked) {
      new UiButton(this, cx, btnY - 60, { id: 'results.retry', label: t('results.retry'), width: Math.min(260, panel.w - 48), onPress: () => this.retry(data) });
      new UiButton(this, cx, btnY, { id: 'results.menu', label: t('results.menu'), width: Math.min(260, panel.w - 48), onPress: () => this.scene.start('Menu') });
    } else {
      new UiButton(this, cx - btnW / 2 - 10, btnY, { id: 'results.retry', label: t('results.retry'), width: btnW, onPress: () => this.retry(data) });
      new UiButton(this, cx + btnW / 2 + 10, btnY, { id: 'results.menu', label: t('results.menu'), width: btnW, onPress: () => this.scene.start('Menu') });
    }
    this.input.keyboard?.on('keydown-ENTER', () => this.retry(data));
    this.input.keyboard?.on('keydown-M', () => this.scene.start('Menu'));
  }

  /** An enemy's name, or the name of the one hazard that is not an enemy. */
  private causeName(id: string): string {
    const def = CONTENT.enemies[id];
    if (def) return t(def.nameKey);
    if (id === 'collapse') return t('cause.collapse');
    return t('cause.bolt');
  }

  private async doubleGold(data: ResultsData, btn: UiButton): Promise<void> {
    btn.setEnabled(false);
    sfx.play('click');
    analytics.track({ name: 'ad_offer', kind: 'doubleGold' });
    const ads = getPlatform().ads;
    const earned = await ads.showRewarded('doubleGold');
    analytics.track({ name: 'ad_shown', kind: 'doubleGold', earned, result: ads.lastResult() });
    if (!this.scene.isActive()) return;
    if (!earned) {
      btn.setEnabled(true);
      return;
    }
    const ctx = app();
    ctx.save = grantGold(ctx.storage, ctx.save, data.gold ?? 0);
    sfx.play('levelup');
    this.scene.restart({ ...data, committed: true, doubled: true });
  }

  private retry(data: ResultsData): void {
    // a fixed ?seed= keeps replays reproducible; otherwise every retry is a fresh run
    const seed = app().seed ?? (data.seed + 1) >>> 0;
    // the launch screen does this for a run started from the menu; a run started from here used
    // to play the menu theme until its first boss
    music.setMood('battle');
    music.setIntensity(0.15);
    this.scene.start('Game', { seed, characterId: data.characterId, stageId: data.stageId, curse: data.curse, protocol: data.protocol || null });
  }
}
