import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { addToMySavedTracks } from "./api/addToMySavedTracks";
import { containsMySavedTracks } from "./api/containsMySavedTrack";
import { TrackObject } from "./helpers/spotify.api";

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

  const item = currentlyPlayingData.item as TrackObject;
  const artistNameSuffix = item.artists && item.artists.length > 0 ? ` by ${item.artists[0]?.name}` : "";

  if (trackId === undefined) {
    toast.style = Toast.Style.Failure;
    toast.title = "Unable to retrieve the track ID";
    return;
  }

  try {
    const trackAlreadyLiked = await containsMySavedTracks({ trackIds: [trackId] });

    if (trackAlreadyLiked[0]) {
      toast.style = Toast.Style.Success;
      toast.title = `${item.name}${artistNameSuffix} has already been liked`;
      return;
    }

    toast.title = `Liking ${item.name}${artistNameSuffix}...`;
    await addToMySavedTracks({
      trackIds: [trackId],
    });
    toast.style = Toast.Style.Success;
    toast.title = `Liked ${item.name}${artistNameSuffix}`;
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "Nothing is currently playing";
  }
}
