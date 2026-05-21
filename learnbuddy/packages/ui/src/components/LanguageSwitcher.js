import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/i18n";
import { currentLocale, } from "@/i18n";
import { localeOption, supportedLocales, } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
export function LanguageSwitcher() {
    const { t } = useTranslation();
    const locale = currentLocale();
    const selected = localeOption(locale);
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", "aria-label": t("sidebar.language.ariaLabel"), className: "h-7 gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground", children: [_jsx(Globe, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "max-w-[7rem] truncate", children: selected.nativeLabel })] }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsx(DropdownMenuLabel, { children: t("sidebar.language.label") }), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuRadioGroup, { value: locale, onValueChange: (value) => {
                            void setAppLanguage(value);
                        }, children: supportedLocales.map((option) => (_jsx(DropdownMenuRadioItem, { value: option.code, children: _jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [_jsx("span", { children: option.nativeLabel }), option.nativeLabel !== option.label ? (_jsx("span", { className: "truncate text-xs text-muted-foreground", children: option.label })) : null] }) }, option.code))) })] })] }));
}
//# sourceMappingURL=LanguageSwitcher.js.map