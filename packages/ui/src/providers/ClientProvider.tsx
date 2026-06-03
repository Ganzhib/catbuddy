import { createContext, useContext, type ReactNode } from "react";

import type { catbuddyClient } from "@catbuddy/client";

interface ClientContextValue {
  client: catbuddyClient;
  token: string;
  modelName: string | null;
  setModelName: (name: string | null) => void;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({
  client,
  token,
  modelName = null,
  onModelNameChange,
  children,
}: {
  client: catbuddyClient;
  token: string;
  modelName?: string | null;
  onModelNameChange?: (name: string | null) => void;
  children: ReactNode;
}) {
  return (
    <ClientContext.Provider value={{ client, token, modelName, setModelName: onModelNameChange ?? (() => {}) }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error("useClient must be used within a ClientProvider");
  }
  return ctx;
}
