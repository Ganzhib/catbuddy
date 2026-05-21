import { type ReactNode } from "react";
import type { learnbuddyClient } from "@learnbuddy/client";
interface ClientContextValue {
    client: learnbuddyClient;
    token: string;
    modelName: string | null;
}
export declare function ClientProvider({ client, token, modelName, children, }: {
    client: learnbuddyClient;
    token: string;
    modelName?: string | null;
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useClient(): ClientContextValue;
export {};
//# sourceMappingURL=ClientProvider.d.ts.map