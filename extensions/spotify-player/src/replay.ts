import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { seek } from "./api/seek";
import { WinNotSupportedError } from "./helpers/script";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Replaying..." });

  try {
    await seek(0, Infinity);
    toast.style = Toast.Style.Success;
    toast.title = "Replaying";
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = error instanceof WinNotSupportedError ? error.message : "No active device";
  }
}
