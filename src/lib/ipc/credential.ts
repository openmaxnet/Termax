import { invoke } from '@tauri-apps/api/core';
import { debugInvoke } from '@/lib/debug';
import type { SshCredential } from './types';

/** 凭证管理 IPC */
export const credential = {
  /** 列出所有凭证（不含敏感信息） */
  list: () => debugInvoke('list_credentials', () => invoke<SshCredential[]>('list_credentials')),

  /** 保存新凭证，secret 存入系统密钥链 */
  save: (cred: SshCredential, secret?: string) =>
    debugInvoke('save_credential', () => invoke<void>('save_credential', { credential: cred, secret: secret ?? null }), { name: cred.name }),

  /** 更新已有凭证，secret 为 null 时保持密钥链原值 */
  update: (id: string, cred: SshCredential, secret?: string) =>
    debugInvoke('update_credential', () => invoke<void>('update_credential', { id, credential: cred, secret: secret ?? null })),

  /** 删除凭证（同时清理密钥链） */
  delete: (id: string) =>
    debugInvoke('delete_credential', () => invoke<void>('delete_credential', { id })),

  /** 从系统密钥链读取凭证的敏感信息（编辑时使用） */
  getSecret: (id: string) =>
    debugInvoke('get_credential_secret', () => invoke<string | null>('get_credential_secret', { id })),

  /** 检查凭证被哪些连接配置引用 */
  checkUsage: (id: string) =>
    debugInvoke('check_credential_usage', () => invoke<string[]>('check_credential_usage', { id })),

  /** 打开原生文件选择器，返回选中文件的绝对路径 */
  pickFile: () =>
    debugInvoke('pick_file', () => invoke<string | null>('pick_file')),
};

/** 调试工具 IPC */
export const debug = {
  /** 打开"另存为"对话框，将日志内容保存到用户选择的文件 */
  saveLogFile: (content: string) =>
    invoke<string>('save_log_file', { content }),
};
