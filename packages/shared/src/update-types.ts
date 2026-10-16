export type DesktopUpdateStatus =
  | {
      state: "idle" | "checking" | "current" | "error" | "unsupported";
      currentVersion: string;
    }
  | {
      state: "available";
      currentVersion: string;
      latestVersion: string;
    };
