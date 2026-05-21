import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Menu, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function ThreadHeader({ title, onToggleSidebar, theme, onToggleTheme, hideSidebarToggleOnDesktop = false, minimal = false, }) {
    const { t } = useTranslation();
    if (minimal) {
        return (_jsxs("div", { className: "relative z-10 flex h-11 items-center justify-between gap-3 px-3 py-2", children: [_jsx(Button, { variant: "ghost", size: "icon", "aria-label": t("thread.header.toggleSidebar"), onClick: onToggleSidebar, className: cn("h-7 w-7 rounded-md text-muted-foreground hover:bg-accent/35 hover:text-foreground", hideSidebarToggleOnDesktop && "lg:pointer-events-none lg:opacity-0"), children: _jsx(Menu, { className: "h-3.5 w-3.5" }) }), _jsx(ThemeButton, { theme: theme, onToggleTheme: onToggleTheme, label: t("thread.header.toggleTheme") })] }));
    }
    return (_jsxs("div", { className: "relative z-10 flex items-center justify-between gap-3 px-3 py-2", children: [_jsxs("div", { className: "relative flex min-w-0 items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "icon", "aria-label": t("thread.header.toggleSidebar"), onClick: onToggleSidebar, className: cn("h-7 w-7 rounded-md text-muted-foreground hover:bg-accent/35 hover:text-foreground", hideSidebarToggleOnDesktop && "lg:pointer-events-none lg:opacity-0"), children: _jsx(Menu, { className: "h-3.5 w-3.5" }) }), _jsx("div", { className: "flex min-w-0 items-center rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground", children: _jsx("span", { className: "max-w-[min(60vw,32rem)] truncate", children: title }) })] }), _jsx(ThemeButton, { theme: theme, onToggleTheme: onToggleTheme, label: t("thread.header.toggleTheme") }), _jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-x-0 top-full h-4" })] }));
}
function ThemeButton({ theme, onToggleTheme, label, }) {
    return (_jsx(Button, { variant: "ghost", size: "icon", "aria-label": label, onClick: onToggleTheme, className: "h-8 w-8 rounded-full text-muted-foreground/85 hover:bg-accent/40 hover:text-foreground", children: theme === "dark" ? (_jsx(Sun, { className: "h-4 w-4" })) : (_jsx(Moon, { className: "h-4 w-4" })) }));
}
//# sourceMappingURL=ThreadHeader.js.map