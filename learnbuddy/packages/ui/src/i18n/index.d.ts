import i18n from "i18next";
import { LOCALE_STORAGE_KEY, type SupportedLocale } from "./config";
export declare const resources: {
    readonly en: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                auth: {
                    title: string;
                    hint: string;
                    placeholder: string;
                    submit: string;
                    invalid: string;
                };
                account: {
                    section: string;
                    logoutHint: string;
                    logout: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                navigation: string;
                globalActions: string;
                collapse: string;
                toggleTheme: string;
                home: string;
                newChat: string;
                searchAria: string;
                searchPlaceholder: string;
                searchResults: string;
                noSearchResults: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                relay: {
                    section: string;
                    connection: string;
                    connectionHelp: string;
                    connected: string;
                    disconnected: string;
                    pairingCode: string;
                    pairingHelp: string;
                    copy: string;
                    sessionKey: string;
                    sessionKeyHelp: string;
                    lastError: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                    compaction: string;
                    compactionEnable: string;
                    compactionThreshold: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                    compactionEnable: string;
                    compactionThreshold: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
                groups: {
                    today: string;
                    yesterday: string;
                    earlier: string;
                };
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                    newChat: string;
                    toggleTheme: string;
                    settings: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    goalStateCloseAria: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    tools: {
                        search: string;
                        reason: string;
                        deepResearch: string;
                        voice: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolCard: {
                    running: string;
                    done: string;
                    error: string;
                    arguments: string;
                    output: string;
                    waiting: string;
                    duration: string;
                };
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                copyReply: string;
                copiedReply: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly "zh-CN": {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                navigation: string;
                globalActions: string;
                collapse: string;
                toggleTheme: string;
                home: string;
                newChat: string;
                searchAria: string;
                searchPlaceholder: string;
                searchResults: string;
                noSearchResults: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                relay: {
                    section: string;
                    connection: string;
                    connectionHelp: string;
                    connected: string;
                    disconnected: string;
                    pairingCode: string;
                    pairingHelp: string;
                    copy: string;
                    sessionKey: string;
                    sessionKeyHelp: string;
                    lastError: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                    compaction: string;
                    compactionEnable: string;
                    compactionThreshold: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                    compactionEnable: string;
                    compactionThreshold: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
                groups: {
                    today: string;
                    yesterday: string;
                    earlier: string;
                };
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                    newChat: string;
                    toggleTheme: string;
                    settings: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    tools: {
                        search: string;
                        reason: string;
                        deepResearch: string;
                        voice: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolCard: {
                    running: string;
                    done: string;
                    error: string;
                    arguments: string;
                    output: string;
                    waiting: string;
                    duration: string;
                };
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                copyReply: string;
                copiedReply: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly "zh-TW": {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly fr: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly ja: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly ko: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly es: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly vi: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
    readonly id: {
        readonly common: {
            app: {
                brand: string;
                loading: {
                    connecting: string;
                    boot: string;
                };
                error: {
                    title: string;
                    gatewayHint: string;
                };
                system: {
                    section: string;
                    restartHint: string;
                    restart: string;
                    restarting: string;
                };
                restart: {
                    completed: string;
                };
                documentTitle: {
                    base: string;
                    chat: string;
                };
                meta: {
                    description: string;
                };
            };
            sidebar: {
                collapse: string;
                toggleTheme: string;
                newChat: string;
                recent: string;
                refreshSessions: string;
                settings: string;
                language: {
                    label: string;
                    ariaLabel: string;
                };
            };
            settings: {
                backToChat: string;
                sidebar: {
                    title: string;
                    ariaLabel: string;
                };
                nav: {
                    general: string;
                    byok: string;
                };
                sections: {
                    interface: string;
                    ai: string;
                    system: string;
                };
                rows: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    restart: string;
                    configPath: string;
                };
                help: {
                    theme: string;
                    language: string;
                    provider: string;
                    model: string;
                    configPath: string;
                };
                values: {
                    light: string;
                    dark: string;
                    notAvailable: string;
                };
                status: {
                    loading: string;
                    loadError: string;
                    unsaved: string;
                    savedRestart: string;
                };
                actions: {
                    save: string;
                    saving: string;
                    edit: string;
                    cancel: string;
                };
                byok: {
                    description: string;
                    configured: string;
                    notConfigured: string;
                    configuredSection: string;
                    notConfiguredSection: string;
                    showMore: string;
                    showLess: string;
                    apiKey: string;
                    apiBase: string;
                    apiKeyPlaceholder: string;
                    apiKeyConfiguredPlaceholder: string;
                    configuredKeyHint: string;
                    apiBasePlaceholder: string;
                    apiKeyRequired: string;
                    showApiKey: string;
                    hideApiKey: string;
                    noConfiguredProviders: string;
                    configureFirst: string;
                    openByok: string;
                    tabs: {
                        ariaLabel: string;
                        llm: string;
                        webSearch: string;
                    };
                    webSearch: {
                        provider: string;
                        providerHelp: string;
                        selectProvider: string;
                        credentials: string;
                        noCredentialRequired: string;
                        noCredentialHelp: string;
                        apiKeyHelp: string;
                        baseUrl: string;
                        baseUrlHelp: string;
                        baseUrlPlaceholder: string;
                        apiKeyRequired: string;
                        baseUrlRequired: string;
                        missingCredential: string;
                        saveHint: string;
                    };
                };
            };
            chat: {
                fallbackTitle: string;
                loading: string;
                noSessions: string;
                actions: string;
                delete: string;
                newChat: string;
            };
            deleteConfirm: {
                title: string;
                description: string;
                cancel: string;
                confirm: string;
            };
            connection: {
                idle: string;
                connecting: string;
                open: string;
                reconnecting: string;
                closed: string;
                error: string;
            };
            thread: {
                loadingConversation: string;
                empty: {
                    description: string;
                    greeting: string;
                    quickActions: {
                        plan: {
                            title: string;
                            prompt: string;
                        };
                        analyze: {
                            title: string;
                            prompt: string;
                        };
                        brainstorm: {
                            title: string;
                            prompt: string;
                        };
                        code: {
                            title: string;
                            prompt: string;
                        };
                        summarize: {
                            title: string;
                            prompt: string;
                        };
                        more: {
                            title: string;
                            prompt: string;
                        };
                    };
                    imageQuickActions: {
                        icon: {
                            title: string;
                            prompt: string;
                        };
                        sticker: {
                            title: string;
                            prompt: string;
                        };
                        poster: {
                            title: string;
                            prompt: string;
                        };
                        product: {
                            title: string;
                            prompt: string;
                        };
                        portrait: {
                            title: string;
                            prompt: string;
                        };
                        edit: {
                            title: string;
                            prompt: string;
                        };
                    };
                };
                header: {
                    toggleSidebar: string;
                };
                composer: {
                    placeholderThread: string;
                    placeholderHero: string;
                    placeholderOpening: string;
                    placeholderStreaming: string;
                    inputAria: string;
                    sendHint: string;
                    runRuntimeTitle: string;
                    goalStateStrip: string;
                    goalStateFallback: string;
                    goalStateExpandAria: string;
                    goalStateSheetTitle: string;
                    send: string;
                    stop: string;
                    attachImage: string;
                    imageMode: {
                        label: string;
                        toggle: string;
                        placeholder: string;
                        aspectAria: string;
                        aspectLabel: string;
                        aspect: {
                            auto: string;
                            "1_1": string;
                            "3_4": string;
                            "9_16": string;
                            "4_3": string;
                            "16_9": string;
                        };
                    };
                    encoding: string;
                    remove: string;
                    normalizedSizeHint: string;
                    imageRejected: {
                        unsupported_type: string;
                        too_many_images: string;
                        magic_mismatch: string;
                        decode_failed: string;
                        too_large: string;
                        io: string;
                    };
                    slash: {
                        ariaLabel: string;
                        label: string;
                        navigateHint: string;
                        selectHint: string;
                        closeHint: string;
                        commands: {
                            new: {
                                title: string;
                                description: string;
                            };
                            stop: {
                                title: string;
                                description: string;
                            };
                            restart: {
                                title: string;
                                description: string;
                            };
                            status: {
                                title: string;
                                description: string;
                            };
                            history: {
                                title: string;
                                description: string;
                            };
                            dream: {
                                title: string;
                                description: string;
                            };
                            dream_log: {
                                title: string;
                                description: string;
                            };
                            dream_restore: {
                                title: string;
                                description: string;
                            };
                            goal: {
                                title: string;
                                description: string;
                            };
                            help: {
                                title: string;
                                description: string;
                            };
                        };
                    };
                    goalStateCloseAria: string;
                };
                scrollToBottom: string;
                loadEarlier: string;
            };
            message: {
                streaming: string;
                assistantTyping: string;
                toolSingle: string;
                toolMany: string;
                toolSummary: string;
                toolSummaryMany: string;
                reasoningTools: string;
                reasoningToolsSingular: string;
                reasoning: string;
                reasoningStreaming: string;
                reasoningSummary: string;
                agentActivitySummary: string;
                agentActivityToolsOnly: string;
                agentActivityLiveSummary: string;
                agentActivityLiveToolsOnly: string;
                imageAttachment: string;
                turnLatencyTitle: string;
            };
            lightbox: {
                title: string;
                open: string;
                prev: string;
                next: string;
                close: string;
            };
            code: {
                fallbackLanguage: string;
                copyAria: string;
                copy: string;
                copied: string;
            };
            common: {
                dismiss: string;
            };
            errors: {
                messageTooBig: {
                    title: string;
                    body: string;
                };
            };
        };
    };
};
export declare function currentLocale(): SupportedLocale;
export declare function setAppLanguage(locale: SupportedLocale): Promise<void>;
export { LOCALE_STORAGE_KEY };
export default i18n;
//# sourceMappingURL=index.d.ts.map