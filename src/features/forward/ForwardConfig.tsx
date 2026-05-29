/**
 * 端口转发配置面板
 * 列表形式展示转发规则，支持添加/编辑/删除/启动/停止。
 * 操作通过右键菜单（TContextMenu）完成。
 * rules 状态由父组件 ConnectionManager 管理，切换标签页时不丢失。
 */
import React, { useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { ArrowLeftRight } from 'lucide-react';
import { ipc } from '@/lib/ipc';
import { useI18n } from '@/i18n';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { ConnectionConfig, ForwardDirection, PortForwardRule } from '@/lib/ipc';

interface ForwardConfigProps {
  config: ConnectionConfig;
  rules: PortForwardRule[];
  onRulesChange: (rules: PortForwardRule[]) => void;
}

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2" style={{ minHeight: 30 }}>
    <Label className="w-17.5 shrink-0 text-xs">{label}</Label>
    <div className="flex-1 flex items-center gap-1.5">{children}</div>
  </div>
);

const COL = { desc: 1, type: 50, listen: 100, target: 100, status: 48 } as const;

export const ForwardConfig: React.FC<ForwardConfigProps> = ({ config, rules, onRulesChange }) => {
  const { t } = useI18n();
  const [activeSet, setActiveSet] = useState<Set<number>>(new Set());
  const [errMap, setErrMap] = useState<Map<number, string>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editRule, setEditRule] = useState<PortForwardRule | null>(null);
  const typeLabel: Record<string, string> = {
    local: t('forward.local'), remote: t('forward.remote'), dynamic: t('forward.dynamic'),
  };

  const refreshActive = useCallback(async () => {
    try {
      const list = await ipc.forward.list();
      const activeKeys = new Set(list.map((f) => `${f.listen}→${f.target}`));
      const idx: Set<number> = new Set();
      rules.forEach((r, i) => { if (activeKeys.has(`${r.listen_host}:${r.listen_port}→${r.target_host}:${r.target_port}`)) idx.add(i); });
      setActiveSet(idx);
    } catch {}
  }, [rules]);

  const handleStart = async (idx: number) => {
    setErrMap((prev) => { const n = new Map(prev); n.delete(idx); return n; });
    try { await ipc.forward.start(config, rules[idx]); } catch (err) { setErrMap((prev) => { const n = new Map(prev); n.set(idx, String(err)); return n; }); }
    finally { await refreshActive(); }
  };

  const handleStop = async (idx: number) => {
    try {
      const rule = rules[idx];
      const key = `${rule.listen_host}:${rule.listen_port}→${rule.target_host}:${rule.target_port}`;
      const list = await ipc.forward.list();
      for (const fwd of list) { if (`${fwd.listen}→${fwd.target}` === key) await ipc.forward.stop(fwd.id).catch(() => {}); }
    } catch {} finally { await refreshActive(); }
  };

  const addRule = (rule: PortForwardRule) => { onRulesChange([...rules, rule]); setShowForm(false); };
  const saveEdit = () => { if (editRule == null || editIdx == null) return; onRulesChange(rules.map((r, i) => (i === editIdx ? editRule! : r))); setEditIdx(null); setEditRule(null); };
  const removeRule = (idx: number) => onRulesChange(rules.filter((_, i) => i !== idx));
  const startEdit = (idx: number) => { setEditIdx(idx); setEditRule({ ...rules[idx] }); setShowForm(false); };
  const isActive = (idx: number) => activeSet.has(idx);

  const closeForm = () => { setShowForm(false); setEditIdx(null); setEditRule(null); };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-(--tx-text-tertiary) border-b border-(--tx-border-light)">
          <span style={{ flex: COL.desc, textAlign: 'center' }}>{t('manager.name')}</span>
          <span style={{ width: COL.type, textAlign: 'center' }}>{t('forward.type')}</span>
          <span style={{ width: COL.listen, textAlign: 'center' }}>{t('forward.listen')}</span>
          <span style={{ width: COL.target, textAlign: 'center' }}>{t('forward.target')}</span>
          <span style={{ width: COL.status, textAlign: 'center' }}>{t('forward.status')}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rules.map((r, i) => (
            <ContextMenu key={i}>
              <ContextMenuTrigger className="block">
                <div className="flex items-center gap-1.5 px-2 py-1.25 rounded-(--tx-radius-sm) text-xs hover:bg-(--tx-bg-hover)"
                  style={{
                    background: isActive(i) ? 'var(--tx-bg-hover)' : 'transparent',
                    border: '1px solid', borderColor: isActive(i) ? 'var(--tx-border-light)' : 'transparent',
                  }}>
                  <span style={{ flex: COL.desc, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-primary)' }}>{r.description || '—'}</span>
                  <span style={{ width: COL.type, textAlign: 'center', color: 'var(--tx-text-secondary)' }}>{typeLabel[r.direction] || r.direction}</span>
                  <span style={{ width: COL.listen, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-secondary)' }}>{r.listen_host}:{r.listen_port}</span>
                  <span style={{ width: COL.target, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-text-secondary)' }}>{r.target_host}:{r.target_port}</span>
                  <span className="flex justify-center items-center gap-0.5 text-[11px]"
                    style={{ width: COL.status, color: errMap.has(i) ? 'var(--tx-red)' : isActive(i) ? 'var(--tx-green)' : 'var(--tx-text-tertiary)' }}>
                    {errMap.has(i) && <Icon icon="solar:danger-circle-linear" width={12} height={12} />}
                    {errMap.has(i) ? t('transfer.failed') : isActive(i) ? t('forward.running') : t('forward.stopped')}
                  </span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {isActive(i)
                  ? <ContextMenuItem onClick={() => handleStop(i)}><Icon icon="solar:stop-circle-linear" width={14} height={14} />{t('forward.stop')}</ContextMenuItem>
                  : <ContextMenuItem onClick={() => handleStart(i)}><Icon icon="solar:play-circle-linear" width={14} height={14} />{t('forward.start')}</ContextMenuItem>
                }
                <ContextMenuItem onClick={() => startEdit(i)}><Icon icon="solar:pen-linear" width={14} height={14} />{t('forward.edit')}</ContextMenuItem>
                <ContextMenuItem onClick={() => removeRule(i)}><Icon icon="solar:trash-bin-trash-linear" width={14} height={14} />{t('forward.delete')}</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          {rules.length === 0 && !showForm && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ArrowLeftRight size={32} /></EmptyMedia>
                <EmptyTitle>{t('forward.noRules')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <Dialog open={showForm || editIdx != null} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <ForwardRuleForm
            initial={editRule}
            onSave={editIdx != null ? saveEdit : addRule}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>

      <Button variant="outline" className="self-start mt-auto border-dashed" onClick={() => setShowForm(true)}>
        <Icon icon="solar:add-circle-linear" width={16} height={16} />
        {t('manager.addForward')}
      </Button>
    </div>
  );
};

/** 添加/编辑转发规则表单 */
const ForwardRuleForm: React.FC<{
  initial?: PortForwardRule | null;
  onSave: (rule: PortForwardRule) => void;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const { t } = useI18n();
  const [desc, setDesc] = useState(initial?.description || '');
  const [direction, setDirection] = useState<ForwardDirection>(initial?.direction || 'local');
  const [listenHost, setListenHost] = useState(initial?.listen_host || '127.0.0.1');
  const [listenPort, setListenPort] = useState(initial?.listen_port ?? 8080);
  const [targetHost, setTargetHost] = useState(initial?.target_host || '');
  const [targetPort, setTargetPort] = useState(initial?.target_port ?? 80);
  const isEditing = !!initial;
  const isDynamic = direction === 'dynamic';

  const handleSave = () => {
    if (!isDynamic && !targetHost.trim()) return;
    onSave({ description: desc, direction, listen_host: listenHost, listen_port: listenPort, target_host: isDynamic ? '' : targetHost, target_port: isDynamic ? 0 : targetPort });
  };

  const dirBtnClass = (d: ForwardDirection) =>
    direction === d
      ? 'h-8 px-3 text-xs font-medium rounded-(--tx-radius-md) border border-(--tx-accent-default) bg-(--tx-accent-muted) text-(--tx-accent-default) inline-flex items-center gap-1.5'
      : 'h-8 px-3 text-xs font-medium rounded-(--tx-radius-md) border border-(--tx-border-light) bg-transparent text-(--tx-text-secondary) inline-flex items-center gap-1.5';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-sm font-semibold text-(--tx-text-primary)">{isEditing ? t('forward.editRule') : t('forward.addRule')}</div>

      <FormRow label={t('manager.name')}><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('forward.descPlaceholder')} /></FormRow>

      <FormRow label={t('forward.type')}>
        <div className="flex gap-1">
          {(['local', 'remote', 'dynamic'] as ForwardDirection[]).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={dirBtnClass(d)}>
              {t(`forward.${d}`)}
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow label={t('forward.listen')}>
        <Input value={listenHost} onChange={(e) => setListenHost(e.target.value)} placeholder="127.0.0.1" />
        <span className="text-(--tx-text-tertiary)">:</span>
        <Input type="number" value={listenPort} onChange={(e) => setListenPort(Number(e.target.value) || 0)} className="w-22.5" />
      </FormRow>

      {!isDynamic && (
        <FormRow label={t('forward.target')}>
          <Input value={targetHost} onChange={(e) => setTargetHost(e.target.value)} placeholder={t('forward.targetPlaceholder')} />
          <span className="text-(--tx-text-tertiary)">:</span>
          <Input type="number" value={targetPort} onChange={(e) => setTargetPort(Number(e.target.value) || 0)} className="w-22.5" />
        </FormRow>
      )}

      <div className="flex gap-2 justify-end mt-2">
        <Button variant="outline" onClick={onCancel}>{t('manager.cancel')}</Button>
        <Button onClick={handleSave}>{isEditing ? t('forward.save') : t('forward.add')}</Button>
      </div>
    </div>
  );
};
