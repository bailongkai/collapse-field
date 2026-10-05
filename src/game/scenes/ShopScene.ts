import Phaser from 'phaser';
import { t, tDynamic } from '../../i18n';
import { COLORS, textStyle } from '../ui/textStyles';
import { UiButton } from '../ui/button';
import { techPanel } from '../ui/panel';
import { restartOnResize } from '../ui/responsive';
import { viewOf, fitPanel, isPortraitScene } from '../layout';
import { UPGRADE_LIST } from '../../data/upgrades';
import { buyUpgrade, upgradeCost, upgradeLevel } from '../../core/save/upgrades';
import { buyCharacter, isCharacterUnlocked } from '../../core/save/unlocks';
import { CHARACTER_LIST } from '../../data/characters';
import { app } from '../app';
import { sfx } from '../audio/sfx';
import { analytics, getPlatform } from '../../platform';
import { PRODUCT_IDS, applyPurchase, productOwned, type ProductId } from '../../core/save/purchases';
import { tDynamic as td } from '../../i18n';
import { upgradeLabel, upgradeValue, weaponLine } from '../ui/shopNumbers';

const ROW_H = 58;

/** Between-run shop: gold from finished runs buys permanent stat upgrades. */
export class ShopScene extends Phaser.Scene {
  /** whether this build of the scene is the store's page, so a purchase comes back to it */
  private onStorePage = false;

  constructor() {
    super('Shop');
  }

  /** `store`: show the store's own page, which only a one-column layout has */
  create(data?: { store?: boolean }): void {
    restartOnResize(this, { store: !!data?.store });
    const ctx = app();
    const cx = viewOf(this).width / 2;
    const cy = viewOf(this).height / 2;
    const priced = CHARACTER_LIST.filter((c) => c.cost !== undefined);
    // the store rows sit under the characters: only where there is a store to buy from
    const allStore = getPlatform().purchases.available() ? PRODUCT_IDS : [];
    // upgrades and characters side by side when there is room; one column under the other on a
    // phone held upright. Thirteen rows in one column on a landscape screen squeezed the text
    // together until the names sat on the descriptions.
    const wide = viewOf(this).width >= 980 && !isPortraitScene(this);
    // One column has no room for the store under thirteen upgrades and seven characters: an
    // upright phone is about 930 units tall, and the rows had already reached their minimum height
    // when the store block ran on under the back button. So there the store is a page of its own,
    // behind a button beside Back, and each page fits.
    const paged = allStore.length > 0 && !wide;
    const storePage = paged && !!data?.store;
    const store = paged && !storePage ? [] : allStore;
    this.onStorePage = storePage;
    // side by side on a wide screen, and on the store's own page; two to a row otherwise
    const storeCols = wide || storePage ? 1 : 2;
    const storeRows = store.length > 0 ? Math.ceil(store.length / storeCols) + 2 : 0;
    // seven characters in one column no longer fit a phone held upright, so they pair up the way
    // the store rows do: two to a line, which is four lines instead of seven
    const charCols = wide ? 1 : 2;
    const charRows = Math.ceil(priced.length / charCols);
    const rowsTall = storePage ? storeRows : wide ? Math.max(UPGRADE_LIST.length, charRows + storeRows) : UPGRADE_LIST.length + charRows + storeRows;
    // the row height comes from the panel the screen can actually hold, not the other way round:
    // sizing rows first and clamping the panel after left the store rows under the back button
    const chrome = wide ? 170 : 210;
    const panel = fitPanel(this, wide ? 1180 : 760, chrome + rowsTall * ROW_H);
    const rowH = Math.max(40, Math.min(ROW_H, (panel.h - chrome) / rowsTall));
    const narrow = !wide && panel.w < 640;
    // a short, wide screen (a 2:1 monitor, a phone on its side) cannot give thirteen rows two lines
    // each: the name and the description share one line instead, so nothing overprints the row
    // below. A row needs about fifty units for two lines of 19 and 14 with their padding.
    const tight = rowH < 50;
    const rowBtnH = Math.min(44, rowH - 6);
    const colW = wide ? (panel.w - 72) / 2 : panel.w - 48;
    const left = cx - panel.w / 2 + 24;
    this.add.rectangle(cx, cy, viewOf(this).width, viewOf(this).height, 0x05070c, 0.85);
    techPanel(this, cx, cy, panel.w, panel.h, { alpha: 0.97, tint: 0x16243a, rule: true });
    this.add.text(left, cy - panel.h / 2 + 36, t('shop.title'), textStyle(26, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    this.add
      .text(cx + panel.w / 2 - 24, cy - panel.h / 2 + 36, t('shop.gold', { n: ctx.save.gold }), textStyle(20, { bold: true, color: COLORS.gold }))
      .setOrigin(1, 0.5);

    const btnW = narrow ? 118 : 150;
    const buyX = left + colW - btnW / 2;
    (storePage ? [] : UPGRADE_LIST).forEach((def, i) => {
      const y = cy - panel.h / 2 + 88 + i * rowH;
      const level = upgradeLevel(ctx.save, def.id);
      const cost = upgradeCost(def, level);
      this.add.image(left + 18, y, 'game', def.icon).setDisplaySize(32, 32);
      const textX = left + 44;
      const levelLabel = t('shop.level', { a: level, b: def.maxLevel });
      const levelColor = level >= def.maxLevel ? COLORS.good : COLORS.text;
      // what it is worth, not only what one level adds. Where the row has no room for both, the
      // worth and the stat it raises win: the numbers are why it is bought, and a bare "now 0 →
      // +10%" next to a name like Hull Plating did not say what the ten per cent was of. Last of
      // all the type gets smaller; the stat's name is never dropped.
      const value = upgradeValue(def, level);
      const short = `${upgradeLabel(def)} ${value}`;
      const fit = (text: Phaser.GameObjects.Text, room: number, prefix = ''): void => {
        if (text.width > room) text.setText(`${prefix}${short}`);
        for (let size = 12; text.width > room && size >= 10; size--) text.setFontSize(size);
        text.setName(`shop.value.${def.id}`);
      };
      const desc = `${t(def.descKey)} · ${value}`;
      const levelX = left + colW - btnW - 96;
      if (narrow) {
        // on a phone the description moves next to the level, since there is no room for a column
        this.add.text(textX, y - 11, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        fit(this.add.text(textX, y + 11, `${levelLabel}  ${desc}`, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5), buyX - btnW / 2 - 8 - textX, `${levelLabel}  `);
      } else if (tight) {
        const name = this.add.text(textX, y, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        fit(this.add.text(textX + name.width + 10, y, desc, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5), levelX - 8 - (textX + name.width + 10));
        this.add.text(levelX, y, levelLabel, textStyle(15, { color: levelColor })).setOrigin(0, 0.5);
      } else {
        this.add.text(textX, y - 12, t(def.nameKey), textStyle(19, { bold: true })).setOrigin(0, 0.5);
        fit(this.add.text(textX, y + 12, desc, textStyle(14, { color: COLORS.dim })).setOrigin(0, 0.5), levelX - 8 - textX);
        this.add.text(levelX, y, levelLabel, textStyle(16, { color: levelColor })).setOrigin(0, 0.5);
      }
      const btn = new UiButton(this, buyX, y, {
        id: `shop.buy.${def.id}`,
        label: cost === null ? t('shop.max') : t('shop.buy', { n: cost }),
        width: btnW,
        height: rowBtnH,
        fontSize: narrow || tight ? 15 : 17,
        onPress: () => this.buy(def.id),
      });
      if (cost === null || ctx.save.gold < cost) btn.setEnabled(false);
    });

    // characters are bought here too, so gold has somewhere to go once the upgrades are maxed
    const charLeft = wide ? left + colW + 24 : left;
    const charTop = wide ? cy - panel.h / 2 + 60 : cy - panel.h / 2 + 88 + UPGRADE_LIST.length * rowH + 8;
    const charCellW = colW / charCols;
    const charBtnW = charCols === 1 ? btnW : 104;
    if (!storePage) this.add.text(charLeft, charTop, t('shop.characters'), textStyle(18, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
    (storePage ? [] : priced).forEach((def, i) => {
      const col = i % charCols;
      const cellX = charLeft + col * charCellW;
      const y = charTop + 30 + Math.floor(i / charCols) * rowH;
      const owned = isCharacterUnlocked(ctx.save, def.id);
      this.add.image(cellX + 16, y, 'game', def.frame).setDisplaySize(charCols === 1 ? 32 : 26, charCols === 1 ? 32 : 26);
      const textX = cellX + (charCols === 1 ? 44 : 34);
      // the starting weapon in numbers: what the gold buys
      const weapon = weaponLine(def.startingWeapon) || tDynamic(`weapon.${def.startingWeapon}.name`);
      // a line that would run under the buy button falls back to the numbers alone, then the name
      const room = cellX + charCellW - charBtnW - 6 - textX;
      const fitWeapon = (text: Phaser.GameObjects.Text): void => {
        if (text.width > room) text.setText(weaponLine(def.startingWeapon, true));
        if (text.width > room) text.setText(tDynamic(`weapon.${def.startingWeapon}.name`));
      };
      if (charCols > 1) {
        this.add.text(textX, y - 10, t(def.nameKey), textStyle(14, { bold: true })).setOrigin(0, 0.5);
        fitWeapon(this.add.text(textX, y + 10, weapon, textStyle(11, { color: COLORS.dim })).setOrigin(0, 0.5));
      } else if (narrow) {
        this.add.text(textX, y - 11, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        fitWeapon(this.add.text(textX, y + 11, weapon, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5));
      } else if (tight) {
        const name = this.add.text(textX, y, t(def.nameKey), textStyle(17, { bold: true })).setOrigin(0, 0.5);
        this.add.text(textX + name.width + 10, y, weapon, textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5);
      } else {
        this.add.text(textX, y - 12, t(def.nameKey), textStyle(19, { bold: true })).setOrigin(0, 0.5);
        fitWeapon(this.add.text(textX, y + 12, weapon, textStyle(14, { color: COLORS.dim })).setOrigin(0, 0.5));
      }
      const btn = new UiButton(this, cellX + charCellW - charBtnW / 2, y, {
        id: `shop.buyChar.${def.id}`,
        label: owned ? t('shop.owned') : t('shop.buy', { n: def.cost ?? 0 }),
        width: charBtnW,
        height: charCols === 1 ? rowBtnH : 38,
        fontSize: charCols === 1 ? (narrow || tight ? 15 : 17) : 13,
        onPress: () => this.buyChar(def.id),
      });
      if (owned || ctx.save.gold < (def.cost ?? 0)) btn.setEnabled(false);
    });

    if (store.length > 0) {
      const storeTop = storePage ? cy - panel.h / 2 + 76 : charTop + 30 + Math.ceil(priced.length / charCols) * rowH + 14;
      this.add.text(charLeft, storeTop, t('shop.iap'), textStyle(18, { bold: true, color: COLORS.accent })).setOrigin(0, 0.5);
      const restore = new UiButton(this, charLeft + colW - btnW / 2, storeTop, { id: 'shop.restore', label: t('shop.restore'), width: btnW, height: 36, fontSize: 13, onPress: () => void this.restore() });
      void restore;
      const cellW = colW / storeCols;
      const cellBtnW = storeCols === 1 ? btnW : 96;
      store.forEach((id, i) => {
        const col = i % storeCols;
        // on its own page there is room to keep the first row clear of the restore button's reach
        const y = storeTop + (storePage ? Math.max(52, rowH) : 30) + Math.floor(i / storeCols) * rowH;
        const owned = productOwned(ctx.save, id);
        const cellX = charLeft + col * cellW;
        const textX = cellX + 12;
        if (tight && storeCols === 1) {
          const name = this.add.text(textX, y, td(`shop.iap.${id}`), textStyle(17, { bold: true })).setOrigin(0, 0.5);
          this.add.text(textX + name.width + 10, y, td(`shop.iap.${id}.desc`), textStyle(13, { color: COLORS.dim })).setOrigin(0, 0.5);
        } else {
          this.add.text(textX, y - 11, td(`shop.iap.${id}`), textStyle(storeCols === 1 ? 19 : 15, { bold: true })).setOrigin(0, 0.5);
          this.add.text(textX, y + 11, td(`shop.iap.${id}.desc`), textStyle(storeCols === 1 ? 14 : 12, { color: COLORS.dim })).setOrigin(0, 0.5);
        }
        const btn = new UiButton(this, cellX + cellW - cellBtnW / 2, y, {
          id: `shop.iap.${id}`,
          label: owned ? t('shop.iap.owned') : t('shop.iap.buy'),
          width: cellBtnW,
          height: storeCols === 1 ? rowBtnH : 38,
          fontSize: storeCols === 1 ? 17 : 14,
          onPress: () => void this.purchase(id),
        });
        if (owned) btn.setEnabled(false);
      });
    }

    const bottomY = cy + panel.h / 2 - 36;
    if (paged) {
      const w = Math.min(200, (panel.w - 72) / 2);
      new UiButton(this, cx - w / 2 - 12, bottomY, { id: 'shop.back', label: t('common.back'), width: w, height: 48, onPress: () => this.close() });
      new UiButton(this, cx + w / 2 + 12, bottomY, {
        id: 'shop.page',
        label: storePage ? t('shop.title') : t('shop.iap'),
        width: w,
        height: 48,
        onPress: () => this.scene.restart({ store: !storePage }),
      });
    } else {
      new UiButton(this, cx, bottomY, { id: 'shop.back', label: t('common.back'), width: Math.min(200, panel.w - 48), height: 48, onPress: () => this.close() });
    }
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
      analytics.track({ name: 'unlock', kind: 'character', id });
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
    this.scene.restart({ store: this.onStorePage });
  }

  private async restore(): Promise<void> {
    sfx.play('click');
    const owned = await getPlatform().purchases.restore();
    if (!this.scene.isActive()) return;
    const ctx = app();
    for (const id of owned) if (PRODUCT_IDS.includes(id)) ctx.save = applyPurchase(ctx.storage, ctx.save, id);
    if (owned.length > 0) this.scene.restart({ store: this.onStorePage });
  }

  private close(): void {
    this.scene.stop();
    const menu = this.scene.get('Menu');
    if (menu) menu.scene.restart();
  }
}
