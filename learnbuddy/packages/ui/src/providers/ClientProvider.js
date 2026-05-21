import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const ClientContext = createContext(null);
export function ClientProvider({ client, token, modelName = null, children, }) {
    return (_jsx(ClientContext.Provider, { value: { client, token, modelName }, children: children }));
}
export function useClient() {
    const ctx = useContext(ClientContext);
    if (!ctx) {
        throw new Error("useClient must be used within a ClientProvider");
    }
    return ctx;
}
//# sourceMappingURL=ClientProvider.js.map