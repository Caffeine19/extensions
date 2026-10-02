import { showToast, Toast } from "@raycast/api";
import { getErrorMessage } from "./helpers/getError";
import { runSpotifyScript, SpotifyScriptType } from "./helpers/script";
import { setSpotifyClient } from "./helpers/withSpotifyClient";

export default async function Command() {
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: "Starting DJ..." });

  try {
    // API doesn't support playing DJ, only AppleScript does
    // await play({ id: "37i9dQZF1EYkqdzj48dyYq", type: "track" });
    await runSpotifyScript(SpotifyScriptType.PlayTrack, true, "spotify:playlist:37i9dQZF1EYkqdzj48dyYq");
    toast.style = Toast.Style.Success;
    toast.title = "Playing DJ";
  } catch (err) {
    const error = getErrorMessage(err);
    toast.style = Toast.Style.Failure;
    toast.title = error;
  }
}
