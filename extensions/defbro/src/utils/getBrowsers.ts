import execPromise from "../utils/execPromise";
import { Browser } from "../types";

interface DefbroEntry {
  name: string;
  url: string;
  isDefault: boolean;
  id: string;
}

const fileUrlToPath = (url: string) => decodeURIComponent(new URL(url).pathname);

export const getBrowsers = async (defbroPath: string) => {
  const { stdout } = await execPromise(`"${defbroPath}" --json`);
  const entries = JSON.parse(stdout) as DefbroEntry[];

  return entries.map<Browser>((entry) => ({
    id: entry.id,
    title: entry.name,
    default: entry.isDefault,
    path: fileUrlToPath(entry.url),
  }));
};
