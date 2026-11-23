import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { skipToPrevious } from "./api/skipToPrevious";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Checking song..." });

  const currentlyPlayingData = await getCurrentlyPlaying();
  const nothingIsPlaying = !currentlyPlayingData || !currentlyPlayingData?.item;

  if (nothingIsPlaying) {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
    return;
  }

  toast.title = "Skipping to previous...";
  try {
    await skipToPrevious();
    toast.style = Toast.Style.Success;
    toast.title = "Skipped to previous";
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
  }
}
