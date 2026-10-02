import { Alert, Icon, Toast, confirmAlert, showToast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { removeFromPlaylist } from "./api/removeFromPlaylist";
import { skipToNext } from "./api/skipToNext";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Checking song..." });

  const currentlyPlayingData = await getCurrentlyPlaying();
  const nothingIsPlaying = !currentlyPlayingData || !currentlyPlayingData.item;
  const isTrack = currentlyPlayingData?.currently_playing_type !== "episode";
  const trackUri = currentlyPlayingData?.item?.uri;
  const playlistId = (currentlyPlayingData?.context?.uri ?? "").split(":")[2];

  if (nothingIsPlaying) {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
    return;
  }

  if (!isTrack) {
    toast.style = Toast.Style.Failure;
    toast.title = "Removing episodes is not supported yet";
    return;
  }

  if (trackUri === undefined) {
    toast.style = Toast.Style.Failure;
    toast.title = "Unable to find track";
    return;
  }

  if (!playlistId) {
    toast.style = Toast.Style.Failure;
    toast.title = "Unable to find the playlist";
    return;
  }

  if (
    await confirmAlert({
      title: "Remove Song",
      message:
        "Are you sure you want to remove the current playing song from the playlist? This will delete every instance of the song.",
      icon: Icon.Trash,
      rememberUserChoice: true,
      primaryAction: {
        title: "Remove",
        style: Alert.ActionStyle.Destructive,
      },
    })
  ) {
    toast.title = "Removing song...";
    try {
      await removeFromPlaylist({ playlistId, trackUris: [{ uri: trackUri }] });

      if (
        await confirmAlert({
          title: "Skip Song",
          message: `"${currentlyPlayingData.item.name}" has been removed from the playlist. Do you want to skip to the next song?`,
          icon: Icon.Forward,
          primaryAction: {
            title: "Skip",
          },
        })
      ) {
        toast.title = "Skipping to next...";
        try {
          await skipToNext();
          toast.style = Toast.Style.Success;
          toast.title = "Skipped to next";
        } catch {
          toast.style = Toast.Style.Failure;
          toast.title = "Could not skip to next song";
        }
      } else {
        toast.style = Toast.Style.Success;
        toast.title = "Removed song from playlist";
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error removing song from playlist. Please try again.";
      toast.style = Toast.Style.Failure;
      toast.title = errorMessage;
    }
  } else {
    toast.style = Toast.Style.Failure;
    toast.title = "Remove cancelled";
  }
}
