import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { startRadio } from "./api/startRadio";
import { getErrorMessage } from "./helpers/getError";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Checking song..." });

  const currentlyPlayingData = await getCurrentlyPlaying();
  const nothingIsPlaying = !currentlyPlayingData || !currentlyPlayingData?.item;
  const isTrack = currentlyPlayingData?.currently_playing_type !== "episode";
  const trackId = currentlyPlayingData?.item?.id;

  if (nothingIsPlaying) {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
    return;
  }

  if (!isTrack && !trackId) {
    toast.style = Toast.Style.Failure;
    toast.title = "Radio based on episodes isn't available yet";
    return;
  }

  toast.title = "Starting radio...";
  try {
    await startRadio({
      trackIds: trackId ? [trackId] : undefined,
    });
    toast.style = Toast.Style.Success;
    toast.title = "Playing Radio";
  } catch (err) {
    const error = getErrorMessage(err);
    toast.style = Toast.Style.Failure;
    toast.title = error;
  }
}
