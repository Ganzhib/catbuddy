/**
 * BaseChannel 鈥?閫氶亾鎶借薄鎺ュ彛
 *
 * 姣忎釜閫氶亾锛圵ebUI銆乄hatsApp銆丏esktop Notification锛夊疄鐜版鎺ュ彛銆? * 鍙傝€?catbuddy/channels/base.py
 */
import type { OutboundMessage } from "@catbuddy/shared";

export interface BaseChannel {
  readonly name: string;
  readonly displayName: string;

  /** 鍚姩閫氶亾锛堝鐩戝惉 IPC 浜嬩欢銆佽繛鎺?WhatsApp锛?*/
  start(): Promise<void>;

  /** 鍋滄閫氶亾 */
  stop(): Promise<void>;

  /** 鍙戦€佸畬鏁存秷鎭紙闈炴祦寮忥級 */
  send(msg: OutboundMessage): Promise<void>;

  /** 闈炴祦寮忓畬鏁村姪鎵嬫鏂囷紙娓叉煋涓鸿亰澶╂皵娉★紝闈炲伐鍏峰尯 progress锛?*/
  sendAssistantMessage?(chatId: string, text: string): Promise<void>;

  /** 鍙戦€佹祦寮忓閲忕墖娈?*/
  sendDelta?(chatId: string, delta: string, metadata?: Record<string, unknown>): Promise<void>;

  /** 娴佸紡缁撴潫鏍囪 */
  sendStreamEnd?(chatId: string, metadata?: Record<string, unknown>): Promise<void>;

  /** 鍙戦€佹帹鐞嗘€濊€冪墖娈?*/
  sendReasoningDelta?(chatId: string, delta: string): Promise<void>;

  /** 鎺ㄧ悊鎬濊€冪粨鏉?*/
  sendReasoningEnd?(chatId: string): Promise<void>;

  /** 宸ュ叿璋冪敤杩涘害 */
  sendToolProgress?(chatId: string, event: import("@catbuddy/shared").ToolEvent): Promise<void>;

  /** 鏂囦欢缂栬緫杩涘害锛坵rite_file / edit_file锛?*/
  sendFileEdit?(chatId: string, edit: import("@catbuddy/shared").FileEditEvent): Promise<void>;

  /** 鏁磋疆瀵硅瘽缁撴潫锛堝墠绔嵁姝ゅ仠姝?loading锛?*/
  sendTurnComplete?(chatId: string, data: import("@catbuddy/shared").TurnCompleteData): Promise<void>;
}
