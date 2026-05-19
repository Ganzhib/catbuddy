import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DeleteConfirm } from '@/components/DeleteConfirm'
import { Sidebar } from '@/components/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { ThreadShell } from '@/components/thread/ThreadShell'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useSessions } from '@/hooks/useSessions'
import { useDeferredTitleRefresh } from '@/hooks/useDeferredTitleRefresh'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { clearSavedSecret, fetchBootstrap, loadSavedSecret, saveSecret } from '@/lib/bootstrap'
import { deriveTitle } from '@/lib/format'
import { NanobotClient } from '@/lib/nanobot-client'
import { ClientProvider, useClient } from '@/providers/ClientProvider'
import type { ChatSummary } from '@/lib/types'

const SIDEBAR_STORAGE_KEY = 'nanobot-webui.sidebar'
const RESTART_STARTED_KEY = 'nanobot-webui.restartStartedAt'
const SIDEBAR_WIDTH = 272
type ShellView = 'chat' | 'settings'

function readSidebarOpen(): boolean {
  try { return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== '0' } catch { return true }
}

export default function App() {
  const [state, setState] = useState<{
    client: NanobotClient; token: string; modelName: string | null
  } | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootAttempts, setBootAttempts] = useState(0)

  const doBootstrap = useCallback(async () => {
    setBootError(null)
    try {
      const boot = await fetchBootstrap()
      const client = new NanobotClient(boot.token, boot.ws_path)
      client.connect()
      setState({ client, token: boot.token, modelName: boot.model_name ?? null })
      setBootError(null)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      console.error('Bootstrap failed:', msg)
      setBootError(msg)
    }
  }, [])

  useEffect(() => {
    doBootstrap()
  }, [doBootstrap, bootAttempts])

  const handleModelNameChange = useCallback((modelName: string | null) => {
    setState(prev => prev ? { ...prev, modelName } : prev)
  }, [])

  const handleLogout = useCallback(() => {
    state?.client.close()
    clearSavedSecret()
    setState(null)
  }, [state])

  if (!state) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {bootError ? (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
            <p className="text-red-500 text-sm font-medium">Connection Failed</p>
            <p className="text-xs text-gray-400 break-all">{bootError}</p>
            <button
              onClick={() => setBootAttempts(n => n + 1)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/60" />
            </span>
            Loading nanobot…
          </div>
        )}
      </div>
    )
  }

  return (
    <ClientProvider client={state.client} token={state.token} modelName={state.modelName}>
      <Shell onModelNameChange={handleModelNameChange} onLogout={handleLogout} />
    </ClientProvider>
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
    return sessions.find(s => s.key === activeKey) ?? null
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
      setActiveKey(`desktop:${chatId}`)  // 带 prefix，匹配 JSONL session key
      setView('chat')
      setMobileSidebarOpen(false)
      return chatId
    } catch (e) { console.error('Failed to create chat', e); return null }
  }, [createChat])

  const onNewChat = useCallback(() => {
    setActiveKey(null); setView('chat'); setMobileSidebarOpen(false)
  }, [])

  const onSelectChat = useCallback((key: string) => {
    setActiveKey(key); setView('chat'); setMobileSidebarOpen(false)
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
    return client.onRuntimeModelUpdate((modelName) => onModelNameChange(modelName))
  }, [client, onModelNameChange])

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
                  await window.nanobot.restartApp()
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
