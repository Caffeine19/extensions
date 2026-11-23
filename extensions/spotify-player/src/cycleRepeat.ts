import { showToast, Toast } from "@raycast/api";
import { getPlaybackState } from "./api/getPlaybackState";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { repeat } from "./api/repeat";

function cycleRepeatState(repeatState?: string) {
  switch (repeatState) {
    case "off":
      return "context";
    case "context":
      return "track";
    case "track":
      return "off";
    default:
      return "off";
  }
}

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Cycling repeat..." });

  const playbackStateData = await getPlaybackState();
  const repeatState = playbackStateData?.repeat_state;

  const newState = cycleRepeatState(repeatState);

  try {
    await repeat(newState);
    toast.style = Toast.Style.Success;
    toast.title = `Repeat is set to ${newState}`;
  } catch {
    toast.style = Toast.Style.Failure;
    toast.title = "No active device";
  }
}
