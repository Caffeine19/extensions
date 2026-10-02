import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { removeFromMySavedTracks } from "./api/removeFromMySavedTracks";

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

  if (!isTrack) {
    toast.style = Toast.Style.Failure;
    toast.title = "Liking episodes is not supported yet";
    return;
  }

  try {
    toast.title = `Disliking ${currentlyPlayingData?.item.name}...`;
    await removeFromMySavedTracks({
      trackIds: trackId ? [trackId] : [],
    });
    toast.style = Toast.Style.Success;
    toast.title = `Disliked ${currentlyPlayingData?.item.name}`;
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
  }
}
