import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '@/components/BrandMark'
import { DeleteConfirm } from '@/components/DeleteConfirm'
import { Sidebar } from '@/components/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { ThreadShell } from '@/components/thread/ThreadShell'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useSessions } from '@/hooks/useSessions'
import { useDeferredTitleRefresh } from '@/hooks/useDeferredTitleRefresh'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { AuthGate } from '@/components/auth/AuthGate'
import { deriveTitle } from '@/lib/format'
import { ClientProvider, useClient } from '@/providers/ClientProvider'
import {
  normalizeChatSummary,
  parseSessionKey,
  toSessionKey,
  type ChatSummary,
} from "@learnbuddy/shared"

const SIDEBAR_STORAGE_KEY = 'learnbuddy-webui.sidebar'
const RESTART_STARTED_KEY = 'learnbuddy-webui.restartStartedAt'
const SIDEBAR_WIDTH = 296
type ShellView = 'chat' | 'settings'

function readSidebarOpen(): boolean {
  try { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== '0' } catch { return true }
}

export default function App() {
  const [modelName, setModelName] = useState<string | null>(null)

  return (
    <AuthGate>
      {({ client, token, modelName: bootModel, onLogout }) => (
        <ClientProvider client={client} token={token} modelName={modelName ?? bootModel}>
          <Shell
            onModelNameChange={setModelName}
            onLogout={onLogout}
          />
        </ClientProvider>
      )}
    </AuthGate>
  )
}

function Shell({
  onModelNameChange, onLogout,
}: {
  onModelNameChange: (name: string | null) => void
  onLogout: () => void
}) {
  const { t } = useTranslation()
  const { client } = useClient()
  const { theme, toggle } = useTheme()
  const { sessions, loading, refresh, createChat, deleteChat } = useSessions()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const placeholderSessionsRef = useRef<Map<string, ChatSummary>>(new Map())
  const [view, setView] = useState<ShellView>('chat')
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(readSidebarOpen)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ key: string; label: string } | null>(null)
  const [isRestarting, setIsRestarting] = useState(false)
  const [restartToast, setRestartToast] = useState<string | null>(null)

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopSidebarOpen ? '1' : '0') } catch {}
  }, [desktopSidebarOpen])

  const activeSession = useMemo<ChatSummary | null>(() => {
    if (!activeKey) return null
    const key = toSessionKey(activeKey)
    const found = sessions.find((s) => toSessionKey(s.key) === key)
    if (found) return normalizeChatSummary(found)
    let placeholder = placeholderSessionsRef.current.get(key)
    if (!placeholder) {
      const parsed = parseSessionKey(key)
      const now = new Date().toISOString()
      placeholder = normalizeChatSummary({
        key: parsed.key,
        channel: parsed.channel,
        chatId: parsed.chatId,
        createdAt: now,
        updatedAt: now,
        title: '',
        preview: '',
      })
      placeholderSessionsRef.current.set(key, placeholder)
    }
    return placeholder
  }, [sessions, activeKey])

  const closeDesktopSidebar = useCallback(() => setDesktopSidebarOpen(false), [])
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [])

  const toggleSidebar = useCallback(() => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) setDesktopSidebarOpen(v => !v)
    else setMobileSidebarOpen(v => !v)
  }, [])

  const onCreateChat = useCallback(async () => {
    try {
      const chatId = await createChat()
      setActiveKey(toSessionKey(chatId))
      setView('chat')
      setMobileSidebarOpen(false)
      return chatId
    } catch (e) { console.error('Failed to create chat', e); return null }
  }, [createChat])

  const onNewChat = useCallback(() => {
    setActiveKey(null); setView('chat'); setMobileSidebarOpen(false)
  }, [])

  const onSelectChat = useCallback((key: string) => {
    setActiveKey(toSessionKey(key))
    setView('chat')
    setMobileSidebarOpen(false)
  }, [])

  const onOpenSettings = useCallback(() => {
    setView('settings'); setMobileSidebarOpen(false)
  }, [])

  const onBackToChat = useCallback(() => {
    setView('chat')
    setActiveKey(current => {
      if (!current) return null
      return sessions.some(s => s.key === current) ? current : sessions[0]?.key ?? null
    })
  }, [sessions])

  useEffect(() => {
    const id = activeSession?.chatId
    if (id) client.attach(id)
  }, [activeSession?.chatId, client])

  // Desktop 新建/切换对话并发消息时，跟随到对应 sessionKey（见 session_updated scope=focus）
  useEffect(() => {
    return client.onSessionUpdate((chatId, scope) => {
      if (scope !== 'focus' || !chatId || chatId === 'metadata') return
      const key = toSessionKey(chatId)
      setActiveKey((prev) => (prev === key ? prev : key))
      setView('chat')
    })
  }, [client])

  useEffect(() => {
    return client.onRuntimeModelUpdate((modelName) => onModelNameChange(modelName))
  }, [client, onModelNameChange])

  // /new 命令 → 回到首页
  useEffect(() => {
    return client.onGoHomeRequest(() => {
      setActiveKey(null);
      setView('chat');
    })
  }, [client])

  const onTurnEnd = useDeferredTitleRefresh(activeSession, refresh)

  const onConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    const key = pendingDelete.key
    const deletingActive = activeKey === key
    const currentIndex = sessions.findIndex(s => s.key === key)
    const fallbackKey = deletingActive
      ? (sessions[currentIndex + 1]?.key ?? sessions[currentIndex - 1]?.key ?? null)
      : activeKey
    setPendingDelete(null)
    if (deletingActive) setActiveKey(fallbackKey)
    try { await deleteChat(key) } catch (e) {
      if (deletingActive) setActiveKey(key)
      console.error('Failed to delete session', e)
    }
  }, [pendingDelete, deleteChat, activeKey, sessions])

  const headerTitle = activeSession
    ? activeSession.title || deriveTitle(activeSession.preview, t('chat.newChat'))
    : t('app.brand')

  const sidebarProps = {
    sessions, activeKey, loading, onNewChat, onSelect: onSelectChat,
    onRequestDelete: (key: string, label: string) => setPendingDelete({ key, label }),
    onOpenSettings,
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="relative flex h-full w-full overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'relative z-20 hidden shrink-0 overflow-hidden lg:block',
            'transition-[width] duration-300 ease-out',
          )}
          style={{ width: desktopSidebarOpen ? SIDEBAR_WIDTH : 0 }}
        >
          <div
            className={cn(
              'absolute inset-y-0 left-0 h-full overflow-hidden bg-sidebar shadow-inner-right',
              'transition-transform duration-300 ease-out',
              desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
            style={{ width: SIDEBAR_WIDTH }}
          >
            <Sidebar {...sidebarProps} onCollapse={closeDesktopSidebar} />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" showCloseButton={false} className="p-0 lg:hidden" style={{ width: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}>
            <Sidebar {...sidebarProps} onCollapse={closeMobileSidebar} />
          </SheetContent>
        </Sheet>

        <main className="relative flex h-full min-w-0 flex-1 flex-col">
          <div className={cn('absolute inset-0 flex flex-col', view === 'settings' && 'invisible pointer-events-none')}>
            <ThreadShell
              session={activeSession}
              title={headerTitle}
              onToggleSidebar={toggleSidebar}
              onNewChat={onNewChat}
              onCreateChat={onCreateChat}
              onTurnEnd={onTurnEnd}
              theme={theme}
              onToggleTheme={toggle}
              hideSidebarToggleOnDesktop={desktopSidebarOpen}
            />
          </div>
          {view === 'settings' && (
            <div className="absolute inset-0 flex flex-col">
              <SettingsView
                theme={theme}
                onToggleTheme={toggle}
                onBackToChat={onBackToChat}
                onModelNameChange={onModelNameChange}
                onLogout={onLogout}
                onRestart={async () => {
                  setIsRestarting(true)
                  try { window.localStorage.setItem(RESTART_STARTED_KEY, String(Date.now())) } catch {}
                  await window.learnbuddy?.restartApp()
                }}
                isRestarting={isRestarting}
              />
            </div>
          )}
        </main>

        <DeleteConfirm
          open={!!pendingDelete}
          title={pendingDelete?.label ?? ''}
          onCancel={() => setPendingDelete(null)}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ThemeProvider>
  )
}
