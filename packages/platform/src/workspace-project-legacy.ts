import type { WorkspaceProjectInfo } from "@catbuddy/shared";
import { hasCatbuddyIpc } from "./create-platform";

export async function fetchWorkspaceProjectInfo(): Promise<WorkspaceProjectInfo | null> {
  if (!hasCatbuddyIpc() || !window.catbuddy?.getWorkspaceProjectInfo) return null;
  return window.catbuddy.getWorkspaceProjectInfo();
}
