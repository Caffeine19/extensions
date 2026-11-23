import { LaunchProps, showToast, Toast } from "@raycast/api";
import { changeVolumeWithHUD } from "./api/changeVolume";
import { setSpotifyClient } from "./helpers/withSpotifyClient";

export default async function Command(props: LaunchProps<{ arguments: Arguments.Volume }>) {
  // volume is a string
  const volume = Number(props.arguments.volume);

  // make sure volume is a valid number
  if (isNaN(volume)) {
    await showToast({ style: Toast.Style.Failure, title: "Volume must be a number" });
    return;
  }

  // make sure volume is between 0 and 100 inclusive
  if (volume < 0 || volume > 100) {
    await showToast({ style: Toast.Style.Failure, title: "Volume must be between 0 and 100" });
    return;
  }

  await setSpotifyClient();

  await changeVolumeWithHUD(volume);
}
