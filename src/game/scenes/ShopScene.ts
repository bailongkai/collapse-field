import Phaser from 'phaser';
import { t, tDynamic } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { restartOnResize } from '../ui/responsive';
import { fitPanel, isPortraitScene } from '../layout';
import { UPGRADE_LIST } from '../../data/upgrades';
import { buyUpgrade, upgradeCost, upgradeLevel } from '../../core/save/upgrades';
import { buyCharacter, isCharacterUnlocked } from '../../core/save/unlocks';
import { CHARACTER_LIST } from '../../data/characters';
import { app } from '../app';
import { sfx } from '../audio/sfx';
import { analytics, getPlatform } from '../../platform';
import { PRODUCT_IDS, applyPurchase, productOwned, type ProductId } from '../../core/save/purchases';
import { tDynamic as td } from '../../i18n';

const ROW_H = 58;

/** Between-run shop: gold from finished runs buys permanent stat upgrades. */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    restartOnResize(this);
    const ctx = app();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const priced = CHARACTER_LIST.filter((c) => c.cost !== undefined);
    // the store rows sit under the characters: only where there is a store to buy from
    const store = getPlatform().purchases.available() ? PRODUCT_IDS : [];
    // upgrades and characters side by side when there is room; one column under the other on a
    // phone held upright. Thirteen rows in one column on a landscape screen squeezed the text
    // together until the names sat on the descriptions.
    const wide = this.scale.width >= 980 && !isPortraitScene(this);
    // side by side on a wide screen; two products per row on a phone, where every row is scarce
    const storeCols = wide ? 1 : 2;
    const storeRows = store.length > 0 ? Math.ceil(store.length / storeCols) + 2 : 0;
    const rowsTall = wide ? Math.max(UPGRADE_LIST.length, priced.length + storeRows) : UPGRADE_LIST.length + priced.length + storeRows;
    // the row height comes from the panel the screen can actually hold, not the other way round:
    // sizing rows first and clamping the panel after left the store rows under the back button
    const chrome = wide ? 170 : 210;
    const panel = fitPanel(this, wide ? 1180 : 760, chrome + rowsTall * ROW_H);
    const rowH = Math.max(36, Math.min(ROW_H, (panel.h - chrome) / rowsTall));
    const narrow = !wide && panel.w < 640;
    const colW = wide ? (panel.w - 72) / 2 : panel.w - 48;
    const left = cx - panel.w / 2 + 24;
    this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x05070c, 0.85);
    this.add.nineslice(cx, cy, 'ui', 'panel_glass', panel.w, panel.h, 24, 24, 24, 24).setAlpha(0.97).setTint(0x16243a);
    this.add.text(left, cy - panel.h / 2 + 36, t('shop.title'), textStyle(26, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    this.add
      .text(cx + panel.w / 2 - 24, cy - panel.h / 2 + 36, t('shop.gold', { n: ctx.save.gold }), textStyle(20, { bold: true, color: COLORS.gold }))
      .setOrigin(1, 0.5);

    const btnW = narrow ? 118 : 150;
    const buyX = left + colW - btnW / 2;
    UPGRADE_LIST.forEach((def, i) => {
      const y = cy - panel.h / 2 + 88 + i * rowH;
      const level = upgradeLevel(ctx.save, def.id);
      const cost = upgradeCost(def, level);
      this.add.image(left + 18, y, 'game', def.icon).setDisplaySize(32, 32);
      const textX = left + 44;
      const levelLabel = t('shop.level', { a: level, b: def.maxLevel });
      if (narrow) {
        // on a phone the description moves next to the level, since there is no room for a column
        this.add.text(textX, y - 11, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX, y + 11, `${levelLabel}  ${t(def.descKey)}`, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5);
      } else {
        this.add.text(textX, y - 12, t(def.nameKey), textStyle(19, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX, y + 12, t(def.descKey), textStyle(14, { color: COLORS.dim })).setOrigin(0, 0.5);
        this.add
          .text(left + colW - btnW - 96, y, levelLabel, textStyle(16, { color: level >= def.maxLevel ? COLORS.good : COLORS.text }))
          .setOrigin(0, 0.5);
      }
      const btn = new UiButton(this, buyX, y, {
        id: `shop.buy.${def.id}`,
        label: cost === null ? t('shop.max') : t('shop.buy', { n: cost }),
        width: btnW,
        height: 44,
        fontSize: narrow ? 15 : 17,
        onPress: () => this.buy(def.id),
      });
      if (cost === null || ctx.save.gold < cost) btn.setEnabled(false);
    });

    // characters are bought here too, so gold has somewhere to go once the upgrades are maxed
    const charLeft = wide ? left + colW + 24 : left;
    const charTop = wide ? cy - panel.h / 2 + 60 : cy - panel.h / 2 + 88 + UPGRADE_LIST.length * rowH + 8;
    const charBuyX = charLeft + colW - btnW / 2;
    this.add.text(charLeft, charTop, t('shop.characters'), textStyle(18, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    priced.forEach((def, i) => {
      const y = charTop + 30 + i * rowH;
      const owned = isCharacterUnlocked(ctx.save, def.id);
      this.add.image(charLeft + 18, y, 'game', def.frame).setDisplaySize(32, 32);
      const textX = charLeft + 44;
      const weapon = tDynamic(`weapon.${def.startingWeapon}.name`);
      if (narrow) {
        this.add.text(textX, y - 11, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX, y + 11, weapon, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5);
      } else {
        this.add.text(textX, y - 12, t(def.nameKey), textStyle(19, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX, y + 12, weapon, textStyle(14, { color: COLORS.dim })).setOrigin(0, 0.5);
      }
      const btn = new UiButton(this, charBuyX, y, {
        id: `shop.buyChar.${def.id}`,
        label: owned ? t('shop.owned') : t('shop.buy', { n: def.cost ?? 0 }),
        width: btnW,
        height: 44,
        fontSize: narrow ? 15 : 17,
        onPress: () => this.buyChar(def.id),
      });
      if (owned || ctx.save.gold < (def.cost ?? 0)) btn.setEnabled(false);
    });

    if (store.length > 0) {
      const storeTop = charTop + 30 + priced.length * rowH + 14;
      this.add.text(charLeft, storeTop, t('shop.iap'), textStyle(18, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
      const restore = new UiButton(this, charBuyX, storeTop, { id: 'shop.restore', label: t('shop.restore'), width: btnW, height: 36, fontSize: 13, onPress: () => void this.restore() });
      void restore;
      const cellW = colW / storeCols;
      const cellBtnW = storeCols === 1 ? btnW : 96;
      store.forEach((id, i) => {
        const col = i % storeCols;
        const y = storeTop + 30 + Math.floor(i / storeCols) * rowH;
        const owned = productOwned(ctx.save, id);
        const cellX = charLeft + col * cellW;
        const textX = cellX + 12;
        this.add.text(textX, y - 11, td(`shop.iap.${id}`), textStyle(storeCols === 1 ? 19 : 15, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX, y + 11, td(`shop.iap.${id}.desc`), textStyle(storeCols === 1 ? 14 : 12, { color: COLORS.dim })).setOrigin(0, 0.5);
        const btn = new UiButton(this, cellX + cellW - cellBtnW / 2, y, {
          id: `shop.iap.${id}`,
          label: owned ? t('shop.iap.owned') : t('shop.iap.buy'),
          width: cellBtnW,
          height: storeCols === 1 ? 44 : 38,
          fontSize: storeCols === 1 ? 17 : 14,
          onPress: () => void this.purchase(id),
        });
        if (owned) btn.setEnabled(false);
      });
    }

    new UiButton(this, cx, cy + panel.h / 2 - 36, { id: 'shop.back', label: t('common.back'), width: Math.min(200, panel.w - 48), height: 48, onPress: () => this.close() });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private buy(id: string): void {
    const ctx = app();
    const { result, save } = buyUpgrade(ctx.storage, ctx.save, id);
    if (result === 'bought') {
      ctx.save = save;
      sfx.play('levelup');
      this.scene.restart();
    } else {
      sfx.play('click');
    }
  }

  private buyChar(id: string): void {
    const ctx = app();
    const { result, save } = buyCharacter(ctx.storage, ctx.save, id);
    if (result === 'bought') {
      ctx.save = save;
      sfx.play('levelup');
      this.scene.restart();
    } else {
      sfx.play('click');
    }
  }

  private async purchase(id: ProductId): Promise<void> {
    sfx.play('click');
    const ok = await getPlatform().purchases.buy(id);
    analytics.track({ name: 'purchase', id, ok });
    if (!this.scene.isActive()) return;
    if (!ok) return;
    const ctx = app();
    ctx.save = applyPurchase(ctx.storage, ctx.save, id);
    sfx.play('levelup');
    this.scene.restart();
  }

  private async restore(): Promise<void> {
    sfx.play('click');
    const owned = await getPlatform().purchases.restore();
    if (!this.scene.isActive()) return;
    const ctx = app();
    for (const id of owned) if (PRODUCT_IDS.includes(id)) ctx.save = applyPurchase(ctx.storage, ctx.save, id);
    if (owned.length > 0) this.scene.restart();
  }

  private close(): void {
    this.scene.stop();
    const menu = this.scene.get('Menu');
    if (menu) menu.scene.restart();
  }
}
