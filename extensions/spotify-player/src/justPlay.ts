import { showToast, Toast } from "@raycast/api";
import { setSpotifyClient } from "./helpers/withSpotifyClient";
import { searchTracks } from "./api/searchTracks";
import { play } from "./api/play";
import { getErrorMessage } from "./helpers/getError";

type Props = { arguments: { query: string } };

export default async function Command(props: Props) {
  const { query } = props.arguments;
  await setSpotifyClient();

  const toast = await showToast({ style: Toast.Style.Loading, title: `Searching "${query}"...` });

  try {
    const response = await searchTracks(query, 1);
    const firstMatch = response?.items?.[0] ?? undefined;

    if (firstMatch?.artists) {
      toast.title = `Playing ${firstMatch.name}...`;
      await play({ id: firstMatch.id, type: "track" });
      toast.style = Toast.Style.Success;
      toast.title = `Playing ${firstMatch.name} by ${firstMatch.artists[0].name}`;
    } else {
      toast.style = Toast.Style.Failure;
      toast.title = `No results for ${query}`;
    }
  } catch (err) {
    const error = getErrorMessage(err);
    toast.style = Toast.Style.Failure;
    toast.title = error;
  }
}
