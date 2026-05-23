/**
 * 设置面板共享组件
 * Section（分组容器）、Sel（Select 包装）、InfoRow（键值对行）、PanelProps（面板通用属性）
 */
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FontInfo } from '@/lib/fonts';

/** 设置分组容器：label + 子项 */
export const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--tx-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </div>
    {children}
  </div>
);

/** Select 包装（value 安全兜底，显示当前选中项文本） */
export const Sel: React.FC<{ value: string | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void }> = ({ value, options, onChange }) => {
  const safeValue = value ?? '';
  const label = options.find(o => o.value === safeValue)?.label ?? '';
  return (
    <Select value={safeValue} onValueChange={onChange}>
      <SelectTrigger>
        <span className={cn("flex-1 text-left", !safeValue && "text-muted-foreground")}>{label || ' '}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** 信息行：label + value 键值对 */
export const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '2px 0' }}>
    <span style={{ color: 'var(--tx-text-secondary)' }}>{label}</span>
    <span style={{ color: 'var(--tx-text-primary)', fontFamily: 'var(--tx-font-mono)' }}>{value}</span>
  </div>
);

/** 设置面板通用属性 */
export interface PanelProps {
  t: (k: string, p?: any) => string;
  draft: Record<string, any>;
  setD: (k: string, v: any) => void;
  fonts: FontInfo[];
  themeOptions: { value: string; label: string }[];
}
