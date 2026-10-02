import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { skipToNext } from "./api/skipToNext";

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

  toast.title = "Skipping to next...";
  try {
    await skipToNext();
    toast.style = Toast.Style.Success;
    toast.title = "Skipped to next";
  } catch (error) {
    console.error(error);
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
  }
}
