import { showToast, Toast } from "@raycast/api";
import { openNewWindow } from "./actions";

export default async function Command() {
  try {
    openNewWindow({
      incognito: true,
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to open Edge window",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
