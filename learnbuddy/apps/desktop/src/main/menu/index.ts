import { Menu } from "electron";

/** Hide the native menu bar (app uses in-UI chrome). */
export function setupApplicationMenu(): void {
  Menu.setApplicationMenu(null);
}
