/**
 * 主题包定义
 * 每个主题包含浅色和深色两套 CSS 变量覆盖
 * light 对应 :root（浅色模式），dark 对应 .dark（深色模式）
 */
export interface ThemeBundle {
  /** 唯一标识，如 'termax'、'one-dark' */
  id: string;
  /** 显示名，如 'Termax'、'One Dark' */
  name: string;
  /** 浅色模式 CSS 变量覆盖（空对象表示使用 index.css 默认值） */
  light: Record<string, string>;
  /** 深色模式 CSS 变量覆盖 */
  dark: Record<string, string>;
}
