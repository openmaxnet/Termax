/**
 * 国际化（i18n）系统
 * 支持中英文双语，点分隔路径查找，变量插值。
 * 组件内使用 useI18n()，非组件上下文使用 getMessage()
 */
import { useSettingsStore } from '../stores/settingsStore';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

/** 支持的语言 */
export type Locale = 'zh-CN' | 'en-US';

/** 翻译消息集合类型：嵌套对象 key 路径 */
type Messages = Record<string, unknown>;

/** 按语言 locale 映射的翻译 JSON 注册表 */
const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN as Messages,
  'en-US': enUS as Messages,
};

/** 按点分隔路径遍历嵌套对象，如 lookup('terminal.connecting') → 找到对应的翻译值 */
function lookup(obj: Messages, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/** 根据语言和 key 查找翻译文本，支持 {param} 变量插值 */
function resolveMessage(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let val = lookup(messages[locale], key) ?? lookup(messages['en-US'], key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(`{${k}}`, String(v));
    }
  }
  return val;
}

/** 组件内国际化 Hook，响应式跟随当前语言设置 */
export function useI18n() {
  const locale = useSettingsStore((s) => s.locale);

  // 翻译函数：绑定当前 locale，按 key 路径查找并替换插值变量
  const t = (key: string, params?: Record<string, string | number>): string =>
    resolveMessage(locale, key, params);

  return { t, locale };
}

/** 非 React 组件环境下使用（如终端输出），从 store 同步读取当前语言 */
export function getMessage(key: string, params?: Record<string, string | number>): string {
  const locale = useSettingsStore.getState().locale;
  return resolveMessage(locale, key, params);
}
