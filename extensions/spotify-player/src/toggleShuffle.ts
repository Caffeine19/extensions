import { showToast, Toast } from "@raycast/api";
import { getPlaybackState } from "./api/getPlaybackState";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { shuffle } from "./api/shuffle";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Toggling shuffle..." });

  const playbackStateData = await getPlaybackState();
  const shuffleState = playbackStateData?.shuffle_state;

  try {
    await shuffle(!shuffleState);
    toast.style = Toast.Style.Success;
    toast.title = `Shuffle is ${shuffleState ? "off" : "on"}`;
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "No active device";
  }
}
