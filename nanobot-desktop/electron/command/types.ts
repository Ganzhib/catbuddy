/**
 * Command 模块类型定义
 */

export interface CommandSpec {
  command: string;      // "/stop"
  title: string;       // "停止任务"
  description: string; // 详细说明
  icon: string;        // lucide icon name
  argHint?: string;    // 参数提示，如 "[preset]"
}
