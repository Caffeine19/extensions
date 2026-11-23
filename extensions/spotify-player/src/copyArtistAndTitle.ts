import { showToast, Toast, Clipboard } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { TrackObject } from "./helpers/spotify.api";

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

  const { item } = currentlyPlayingData;

  const { artists } = item as TrackObject;
  const artistName = artists?.[0]?.name;
  const title = `${item.name} · ${artistName}`;

  toast.title = "Copying...";
  await Clipboard.copy(title);
  toast.style = Toast.Style.Success;
  toast.title = "Copied artist and track title to clipboard";
}
