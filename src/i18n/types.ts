import type { zhCN } from './zh-CN';

export type I18nKey = keyof typeof zhCN;
export type Locale = 'zh-CN' | 'en';
export type I18nParams = Record<string, string | number>;
