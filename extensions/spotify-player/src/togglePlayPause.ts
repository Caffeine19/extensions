import { showToast, Toast } from "@raycast/api";
import { getPlaybackState } from "./api/getPlaybackState";
import { getSpotifyAppData } from "./api/getSpotifyAppData";
import { pause } from "./api/pause";
import { getErrorMessage } from "./helpers/getError";
import { play } from "./api/play";
import { checkSpotifyApp } from "./helpers/isSpotifyInstalled";
import { runSpotifyScript, SpotifyScriptType } from "./helpers/script";
import { setSpotifyClient } from "./helpers/withSpotifyClient";

export default async function Command() {
  const toast = await showToast({ style: Toast.Style.Loading, title: "Toggling playback..." });

  // Try AppleScript first (free, no API call)
  const isSpotifyInstalled = await checkSpotifyApp();

  if (isSpotifyInstalled) {
    try {
      const appData = await getSpotifyAppData();

      if (appData?.state === "PLAYING") {
        await runSpotifyScript(SpotifyScriptType.Pause);
        toast.style = Toast.Style.Success;
        toast.title = "Paused";
        return;
      } else if (appData?.state === "PAUSED" || appData?.state === "NOT_PLAYING") {
        await runSpotifyScript(SpotifyScriptType.Play);
        toast.style = Toast.Style.Success;
        toast.title = "Playing";
        return;
      }
      // If NOT_RUNNING or undefined, fall through to Web API
    } catch {
      // AppleScript failed, fall through to Web API
    }
  }

  // Fallback to Web API
  await setSpotifyClient();

  const playbackStateData = await getPlaybackState();
  const isPlaying = playbackStateData?.is_playing;

  if (isPlaying) {
    try {
      await pause();
      toast.style = Toast.Style.Success;
      toast.title = "Paused";
    } catch (err) {
      const message = getErrorMessage(err);
      toast.style = Toast.Style.Failure;
      toast.title = message;
    }
  } else {
    try {
      await play();
      toast.style = Toast.Style.Success;
      toast.title = "Playing";
    } catch (err) {
      const message = getErrorMessage(err);
      toast.style = Toast.Style.Failure;
      toast.title = message;
    }
  }
}
