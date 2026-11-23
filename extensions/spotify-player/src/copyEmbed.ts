import { Clipboard, showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";
import { getEmbedCode } from "./helpers/getEmbedCode";

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

  const external_urls = currentlyPlayingData.item.external_urls;
  const spotifyUrl = external_urls?.spotify;

  const embedCode = getEmbedCode(spotifyUrl);

  if (!embedCode) {
    return await showHUD("Nothing is currently playing");
  }

  toast.title = "Copying...";
  await Clipboard.copy(embedCode);
  toast.style = Toast.Style.Success;
  toast.title = "Copied embed code to clipboard";
}
