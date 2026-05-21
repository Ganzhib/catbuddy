/// <reference types="vite/client" />

import type {
  AgentStatus,
  ChannelStatus,
  FileEditEvent,
  learnbuddyConfig,
  ModelPresetConfig,
  SessionDetail,
  SessionInfo,
  SkillInfo,
  ToolEvent,
  TurnCompleteData,
} from "./shared/types";

export {};

declare global {
  interface learnbuddyAPI {
    sendMessage(chatId: string, content: string, media?: string[]): Promise<void>;
    stopAgent(sessionKey: string): Promise<void>;
    getStatus(): Promise<AgentStatus>;

    onStreamDelta(cb: (data: { content: string; streamId: string }) => void): () => void;
    onStreamEnd(cb: (data: { streamId: string; resuming: boolean }) => void): () => void;
    onReasoningDelta(cb: (data: { content: string }) => void): () => void;
    onReasoningEnd(cb: () => void): () => void;
    onToolProgress(cb: (data: ToolEvent) => void): () => void;
    onFileEdit(cb: (data: FileEditEvent) => void): () => void;
    onRetryWait(cb: (data: { message: string }) => void): () => void;
    onTurnComplete(cb: (data: TurnCompleteData) => void): () => void;
    onSystemMessage(cb: (data: { text: string }) => void): () => void;
    onAssistantMessage(cb: (data: { text: string }) => void): () => void;

    listSessions(): Promise<SessionInfo[]>;
    getSession(key: string): Promise<SessionDetail | null>;
    deleteSession(key: string): Promise<boolean>;
    clearSession(key: string): Promise<void>;
    newSession(): Promise<{ key: string }>;

    getConfig(): Promise<learnbuddyConfig>;
    updateConfig(path: string, value: unknown): Promise<void>;
    listModels(): Promise<ModelPresetConfig[]>;
    setModel(presetName: string): Promise<void>;

    selectWorkspace(): Promise<string>;
    getWorkspace(): Promise<string>;

    listSkills(): Promise<SkillInfo[]>;
    toggleSkill(name: string, enabled: boolean): Promise<void>;

    restartApp(): Promise<void>;

    getChannelsStatus(): Promise<Record<string, ChannelStatus>>;
  }

  interface Window {
    learnbuddy: learnbuddyAPI;
  }
}
