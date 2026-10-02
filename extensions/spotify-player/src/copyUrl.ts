import { showToast, Toast, Clipboard } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { getCurrentlyPlaying } from "./api/getCurrentlyPlaying";

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

  const external_urls = currentlyPlayingData.item.external_urls;
  const title = currentlyPlayingData.item.name;

  toast.title = "Copying...";
  await Clipboard.copy({
    html: `<a href=${external_urls?.spotify}>${title}</a>`,
    text: external_urls?.spotify,
  });
  toast.style = Toast.Style.Success;
  toast.title = "Copied URL to clipboard";
}
