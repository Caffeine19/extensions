import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { seek } from "./api/seek";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Checking song..." });

  const currentlyPlayingData = await getCurrentlyPlaying();
  const nothingIsPlaying = !currentlyPlayingData || !currentlyPlayingData.item;

  if (nothingIsPlaying) {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
    return;
  }

  toast.title = "Skipping ahead 15 seconds...";
  try {
    const currentPositionSeconds = (currentlyPlayingData?.progress_ms || 0) / 1000;
    await seek(currentPositionSeconds + 15, currentlyPlayingData?.item?.duration_ms);
    toast.style = Toast.Style.Success;
    toast.title = "Skipped ahead 15 seconds";
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
  }
}
