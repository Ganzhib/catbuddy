import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/BrandMark';
import { DeleteConfirm } from '@/components/DeleteConfirm';
import { Sidebar } from '@/components/Sidebar';
import { SettingsView } from '@/components/settings/SettingsView';
import { ThreadShell } from '@/components/thread/ThreadShell';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useSessions } from '@/hooks/useSessions';
import { useDeferredTitleRefresh } from '@/hooks/useDeferredTitleRefresh';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { clearSavedSecret, fetchBootstrap } from "@learnbuddy/platform";
import { deriveTitle } from '@/lib/format';
import { createLearnbuddyClient } from "@learnbuddy/client";
import { ClientProvider, useClient } from '@/providers/ClientProvider';
const SIDEBAR_STORAGE_KEY = 'learnbuddy-webui.sidebar';
const RESTART_STARTED_KEY = 'learnbuddy-webui.restartStartedAt';
const SIDEBAR_WIDTH = 272;
function readSidebarOpen() {
    try {
        return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== '0';
    }
    catch {
        return true;
    }
}
export default function App() {
    const [state, setState] = useState(null);
    const [bootError, setBootError] = useState(null);
    const [bootAttempts, setBootAttempts] = useState(0);
    const doBootstrap = useCallback(async () => {
        setBootError(null);
        try {
            const boot = await fetchBootstrap();
            const client = createLearnbuddyClient({
                token: boot.token,
                wsPath: boot.ws_path,
            });
            client.connect();
            setState({ client, token: boot.token, modelName: boot.model_name ?? null });
            setBootError(null);
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            console.error('Bootstrap failed:', msg);
            setBootError(msg);
        }
    }, []);
    useEffect(() => {
        doBootstrap();
    }, [doBootstrap, bootAttempts]);
    const handleModelNameChange = useCallback((modelName) => {
        setState(prev => prev ? { ...prev, modelName } : prev);
    }, []);
    const handleLogout = useCallback(() => {
        state?.client.close();
        clearSavedSecret();
        setState(null);
    }, [state]);
    if (!state) {
        return (_jsx("div", { className: "flex h-full w-full items-center justify-center", children: bootError ? (_jsxs("div", { className: "flex flex-col items-center gap-4 max-w-sm text-center px-6", children: [_jsx("p", { className: "text-red-500 text-sm font-medium", children: "Connection Failed" }), _jsx("p", { className: "text-xs text-gray-400 break-all", children: bootError }), _jsx("button", { onClick: () => setBootAttempts(n => n + 1), className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors", children: "Retry" })] })) : (_jsxs("div", { className: "flex flex-col items-center gap-3 text-sm text-muted-foreground", children: [_jsx(BrandMark, { className: "h-12 w-12 object-contain opacity-90" }), _jsx("span", { children: "Loading learnbuddy\u2026" })] })) }));
    }
    return (_jsx(ClientProvider, { client: state.client, token: state.token, modelName: state.modelName, children: _jsx(Shell, { onModelNameChange: handleModelNameChange, onLogout: handleLogout }) }));
}
function Shell({ onModelNameChange, onLogout, }) {
    const { t } = useTranslation();
    const { client } = useClient();
    const { theme, toggle } = useTheme();
    const { sessions, loading, refresh, createChat, deleteChat } = useSessions();
    const [activeKey, setActiveKey] = useState(null);
    const [view, setView] = useState('chat');
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(readSidebarOpen);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [isRestarting, setIsRestarting] = useState(false);
    const [restartToast, setRestartToast] = useState(null);
    useEffect(() => {
        try {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, desktopSidebarOpen ? '1' : '0');
        }
        catch { }
    }, [desktopSidebarOpen]);
    const activeSession = useMemo(() => {
        if (!activeKey)
            return null;
        return sessions.find(s => s.key === activeKey) ?? null;
    }, [sessions, activeKey]);
    const closeDesktopSidebar = useCallback(() => setDesktopSidebarOpen(false), []);
    const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
    const toggleSidebar = useCallback(() => {
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        if (isDesktop)
            setDesktopSidebarOpen(v => !v);
        else
            setMobileSidebarOpen(v => !v);
    }, []);
    const onCreateChat = useCallback(async () => {
        try {
            const chatId = await createChat();
            setActiveKey(`desktop:${chatId}`); // 带 prefix，匹酝 JSONL session key
            setView('chat');
            setMobileSidebarOpen(false);
            return chatId;
        }
        catch (e) {
            console.error('Failed to create chat', e);
            return null;
        }
    }, [createChat]);
    const onNewChat = useCallback(() => {
        setActiveKey(null);
        setView('chat');
        setMobileSidebarOpen(false);
    }, []);
    const onSelectChat = useCallback((key) => {
        setActiveKey(key);
        setView('chat');
        setMobileSidebarOpen(false);
    }, []);
    const onOpenSettings = useCallback(() => {
        setView('settings');
        setMobileSidebarOpen(false);
    }, []);
    const onBackToChat = useCallback(() => {
        setView('chat');
        setActiveKey(current => {
            if (!current)
                return null;
            return sessions.some(s => s.key === current) ? current : sessions[0]?.key ?? null;
        });
    }, [sessions]);
    useEffect(() => {
        return client.onRuntimeModelUpdate((modelName) => onModelNameChange(modelName));
    }, [client, onModelNameChange]);
    // /new 命令 → 回到首页
    useEffect(() => {
        return client.onGoHomeRequest(() => {
            setActiveKey(null);
            setView('chat');
        });
    }, [client]);
    const onTurnEnd = useDeferredTitleRefresh(activeSession, refresh);
    const onConfirmDelete = useCallback(async () => {
        if (!pendingDelete)
            return;
        const key = pendingDelete.key;
        const deletingActive = activeKey === key;
        const currentIndex = sessions.findIndex(s => s.key === key);
        const fallbackKey = deletingActive
            ? (sessions[currentIndex + 1]?.key ?? sessions[currentIndex - 1]?.key ?? null)
            : activeKey;
        setPendingDelete(null);
        if (deletingActive)
            setActiveKey(fallbackKey);
        try {
            await deleteChat(key);
        }
        catch (e) {
            if (deletingActive)
                setActiveKey(key);
            console.error('Failed to delete session', e);
        }
    }, [pendingDelete, deleteChat, activeKey, sessions]);
    const headerTitle = activeSession
        ? activeSession.title || deriveTitle(activeSession.preview, t('chat.newChat'))
        : t('app.brand');
    const sidebarProps = {
        sessions, activeKey, loading, onNewChat, onSelect: onSelectChat,
        onRequestDelete: (key, label) => setPendingDelete({ key, label }),
        onOpenSettings,
    };
    return (_jsx(ThemeProvider, { theme: theme, children: _jsxs("div", { className: "relative flex h-full w-full overflow-hidden", children: [_jsx("aside", { className: cn('relative z-20 hidden shrink-0 overflow-hidden lg:block', 'transition-[width] duration-300 ease-out'), style: { width: desktopSidebarOpen ? SIDEBAR_WIDTH : 0 }, children: _jsx("div", { className: cn('absolute inset-y-0 left-0 h-full overflow-hidden bg-sidebar shadow-inner-right', 'transition-transform duration-300 ease-out', desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'), style: { width: SIDEBAR_WIDTH }, children: _jsx(Sidebar, { ...sidebarProps, onCollapse: closeDesktopSidebar }) }) }), _jsx(Sheet, { open: mobileSidebarOpen, onOpenChange: setMobileSidebarOpen, children: _jsx(SheetContent, { side: "left", showCloseButton: false, className: "p-0 lg:hidden", style: { width: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }, children: _jsx(Sidebar, { ...sidebarProps, onCollapse: closeMobileSidebar }) }) }), _jsxs("main", { className: "relative flex h-full min-w-0 flex-1 flex-col", children: [_jsx("div", { className: cn('absolute inset-0 flex flex-col', view === 'settings' && 'invisible pointer-events-none'), children: _jsx(ThreadShell, { session: activeSession, title: headerTitle, onToggleSidebar: toggleSidebar, onNewChat: onNewChat, onCreateChat: onCreateChat, onTurnEnd: onTurnEnd, theme: theme, onToggleTheme: toggle, hideSidebarToggleOnDesktop: desktopSidebarOpen }) }), view === 'settings' && (_jsx("div", { className: "absolute inset-0 flex flex-col", children: _jsx(SettingsView, { theme: theme, onToggleTheme: toggle, onBackToChat: onBackToChat, onModelNameChange: onModelNameChange, onLogout: onLogout, onRestart: async () => {
                                    setIsRestarting(true);
                                    try {
                                        window.localStorage.setItem(RESTART_STARTED_KEY, String(Date.now()));
                                    }
                                    catch { }
                                    await window.learnbuddy?.restartApp();
                                }, isRestarting: isRestarting }) }))] }), _jsx(DeleteConfirm, { open: !!pendingDelete, title: pendingDelete?.label ?? '', onCancel: () => setPendingDelete(null), onConfirm: onConfirmDelete })] }) }));
}
//# sourceMappingURL=App.js.map