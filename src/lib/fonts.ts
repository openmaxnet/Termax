/**
 * 系统等宽字体检测
 * 通过 Rust 端 font-kit 枚举系统已安装字体，仅返回等宽字体用于终端字体选择
 */
import { ipc } from './ipc'

export interface FontInfo {
  value: string;
  label: string;
}

/** 将字体名转为 FontInfo 格式，含空格时添加引号 */
function makeFontInfo(family: string): FontInfo {
  const cleanName = family.trim();
  const needsQuotes = cleanName.includes(' ') && !cleanName.startsWith("'");
  const value = needsQuotes
    ? `'${cleanName}', monospace`
    : `${cleanName}, monospace`;
  return { value, label: cleanName };
}

let cached: FontInfo[] | null = null;

/** 获取系统字体列表，结果缓存到内存中避免重复查询 */
export async function getMonospaceFonts(): Promise<FontInfo[]> {
  if (cached) return cached;
  try {
    const allFonts = await ipc.local.detectFonts();
    const seen = new Set<string>();
    const fonts: FontInfo[] = [];
    for (const f of allFonts) {
      const name = f.family;
      if (seen.has(name)) continue;
      seen.add(name);
      fonts.push(makeFontInfo(name));
    }
    cached = fonts.sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    cached = [];
  }
  return cached;
}
