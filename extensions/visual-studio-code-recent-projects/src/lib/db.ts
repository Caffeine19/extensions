import { Alert, Clipboard, Icon, Toast, confirmAlert, showHUD, showToast } from "@raycast/api";
import { useSQL } from "@raycast/utils";
import fs from "fs";
import { homedir } from "os";
import path from "path";
import { useEffect, useMemo, useState } from "react";
import { build } from "./preferences";
import { EntryLike, RecentEntries } from "./types";
import { isSameEntry, isWin } from "./utils";
import { execFilePromise } from "../utils/exec";
import { getBuildNamePreference, getProductJSONPath } from "./vscode";

// VS Code currently persists recent workspaces under `recently.opened`, while
// older Electron-main builds used `history.recentlyOpenedPathsList`.
const recentEntriesStorageKeys = ["recently.opened", "history.recentlyOpenedPathsList"] as const;
const recentEntriesQuery = `
  SELECT
    key,
    json_extract(value, '$.entries') as entries
  FROM ItemTable
  WHERE key IN (${recentEntriesStorageKeys.map((key) => `'${key}'`).join(", ")})
  ORDER BY CASE key
    WHEN 'recently.opened' THEN 0
    WHEN 'history.recentlyOpenedPathsList' THEN 1
    ELSE 2
  END
  LIMIT 1
`;

type RecentEntriesRow = RecentEntries & {
  key: (typeof recentEntriesStorageKeys)[number];
};

type StoredBackupFolder = {
  folderUri: string;
  remoteAuthority?: string;
};

type StoredBackupWorkspace = {
  workspace: {
    id: string;
    configPath: string;
  };
  remoteAuthority?: string;
};

type StoredBackupWorkspaces = {
  folders?: StoredBackupFolder[];
  workspaces?: StoredBackupWorkspace[];
};

type StoredProfileAssociations = {
  workspaces?: Record<string, string>;
};

type StoredMenuBarUri = {
  $mid?: number;
  path?: string;
  scheme?: string;
  authority?: string;
};

type StoredMenuBarItem = {
  id?: string;
  uri?: StoredMenuBarUri;
  label?: string;
  submenu?: { items?: StoredMenuBarItem[] };
};

type StoredMenuBarData = {
  menus?: {
    File?: { items?: StoredMenuBarItem[] };
  };
};

type StoredWindowEntry = {
  folder?: string;
  workspaceIdentifier?: {
    id: string;
    configURIPath: string;
  };
  remoteAuthority?: string;
  backupPath?: string;
  uiState?: {
    mode: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type StoredWindowsState = {
  openedWindows?: StoredWindowEntry[];
};

type StoredGlobalState = {
  backupWorkspaces?: StoredBackupWorkspaces;
  profileAssociations?: StoredProfileAssociations;
  lastKnownMenubarData?: StoredMenuBarData;
  windowsState?: StoredWindowsState;
};

export type RemoveMethods = {
  removeEntry: (entry: EntryLike) => Promise<void>;
  removeAllEntries: () => Promise<void>;
};

async function warnRemoveNotSupported(title = "No removable recent entries found") {
  await showToast(Toast.Style.Failure, title);
}

/**
 * Loads recent VS Code entries from the current state database and supplements
 * them with `storage.json` metadata used by newer backup/profile flows.
 */
export function useRecentEntries() {
  const databasePath = useMemo(() => getStateDatabasePath(), []);
  const fallbackEntries = useMemo(() => getFallbackEntries(), [databasePath]);
  const [suppressedStorageEntryKeys, setSuppressedStorageEntryKeys] = useState<Set<string>>(new Set());
  const storageEntryKeys = useMemo(
    () => new Set(fallbackEntries.map((entry) => getEntryKey(entry)).filter((key): key is string => key !== undefined)),
    [fallbackEntries],
  );
  const visibleFallbackEntries = useMemo(
    () =>
      fallbackEntries.filter((entry) => {
        const key = getEntryKey(entry);
        return !key || !suppressedStorageEntryKeys.has(key);
      }),
    [fallbackEntries, suppressedStorageEntryKeys],
  );

  useEffect(() => {
    setSuppressedStorageEntryKeys(new Set());
  }, [databasePath]);

  const suppressStorageEntries = (entryKeys: string[]) => {
    if (entryKeys.length === 0) {
      return;
    }

    setSuppressedStorageEntryKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      for (const entryKey of entryKeys) {
        nextKeys.add(entryKey);
      }

      return nextKeys;
    });
  };

  const getVisibleStorageEntryKeys = (entries: EntryLike[]) =>
    entries
      .map((entry) => getEntryKey(entry))
      .filter((entryKey): entryKey is string => entryKey !== undefined && storageEntryKeys.has(entryKey));

  const showStorageEntriesHiddenToast = async (title: string) => {
    await showToast(Toast.Style.Success, title, "Storage-backed copies are hidden for this Raycast session");
  };

  if (!fs.existsSync(databasePath)) {
    return {
      data: visibleFallbackEntries,
      isLoading: false,
      error: visibleFallbackEntries.length === 0,

      removeEntry: async (entry: EntryLike) => {
        const entryKey = getEntryKey(entry);

        if (!entryKey || !storageEntryKeys.has(entryKey)) {
          await warnRemoveNotSupported();
          return;
        }

        removeEntriesFromStoredGlobalState([entry]);
        suppressStorageEntries([entryKey]);
        await showStorageEntriesHiddenToast("Entry removed");
      },
      removeAllEntries: async () => {
        const visibleStorageEntryKeys = getVisibleStorageEntryKeys(visibleFallbackEntries);

        if (visibleStorageEntryKeys.length === 0) {
          await warnRemoveNotSupported();
          return;
        }

        if (
          await confirmAlert({
            icon: Icon.Trash,
            title: "Remove all recent entries?",
            message: "This cannot be undone.",
            dismissAction: {
              title: "Cancel",
              style: Alert.ActionStyle.Cancel,
            },
            primaryAction: {
              title: "Remove",
              style: Alert.ActionStyle.Destructive,
            },
          })
        ) {
          removeEntriesFromStoredGlobalState(visibleFallbackEntries);
          suppressStorageEntries(visibleStorageEntryKeys);
          await showStorageEntriesHiddenToast("All visible entries removed");
        }
      },
    };
  }

  const { data, isLoading, revalidate } = useSQL<RecentEntriesRow>(databasePath, recentEntriesQuery);
  const storageKey = data && data.length ? data[0].key : recentEntriesStorageKeys[0];
  const entries = data && data.length ? data[0].entries : undefined;
  const parsedEntries = parseEntryList(entries);
  const combinedEntries = mergeEntries(parsedEntries, visibleFallbackEntries);

  async function removeEntry(entry: EntryLike) {
    if (!combinedEntries) {
      await warnRemoveNotSupported();
      return;
    }

    const entryKey = getEntryKey(entry);
    const isDatabaseEntry = (parsedEntries ?? []).some((currentEntry) => isSameEntry(currentEntry, entry));
    const isStorageEntry = entryKey ? storageEntryKeys.has(entryKey) : false;

    try {
      if (isDatabaseEntry && parsedEntries) {
        await saveEntries(
          parsedEntries.filter((currentEntry) => !isSameEntry(currentEntry, entry)),
          [storageKey],
          databasePath,
        );
      }

      // The entry can also exist as a storage.json copy, which would resurface
      // on the next launch once session suppression resets.
      removeEntriesFromStoredGlobalState([entry]);

      if (entryKey && isStorageEntry) {
        suppressStorageEntries([entryKey]);
      }

      if (isDatabaseEntry) {
        await revalidate();
      }

      showToast(
        Toast.Style.Success,
        "Entry removed",
        isStorageEntry
          ? "Storage-backed copies are hidden for this Raycast session"
          : `Restart ${build} to sync the list in ${build} (optional)`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to remove entry",
        message,
        primaryAction: {
          title: "Copy Error",
          onAction: () => {
            Clipboard.copy(message);
            showHUD("Copied to clipboard");
          },
        },
      });
    }
  }

  async function removeAllEntries() {
    const visibleDatabaseEntries = (combinedEntries ?? []).filter((entry) =>
      (parsedEntries ?? []).some((currentEntry) => isSameEntry(currentEntry, entry)),
    );
    const visibleStorageEntryKeys = getVisibleStorageEntryKeys(combinedEntries ?? []);

    if (visibleDatabaseEntries.length === 0) {
      if (visibleStorageEntryKeys.length === 0) {
        await warnRemoveNotSupported();
        return;
      }

      if (
        await confirmAlert({
          icon: Icon.Trash,
          title: "Remove all recent entries?",
          message: "This cannot be undone.",
          dismissAction: {
            title: "Cancel",
            style: Alert.ActionStyle.Cancel,
          },
          primaryAction: {
            title: "Remove",
            style: Alert.ActionStyle.Destructive,
          },
        })
      ) {
        removeEntriesFromStoredGlobalState(combinedEntries ?? []);
        suppressStorageEntries(visibleStorageEntryKeys);
        await showStorageEntriesHiddenToast("All visible entries removed");
      }
      return;
    }

    try {
      if (
        await confirmAlert({
          icon: Icon.Trash,
          title: "Remove all recent entries?",
          message: "This cannot be undone.",
          dismissAction: {
            title: "Cancel",
            style: Alert.ActionStyle.Cancel,
          },
          primaryAction: {
            title: "Remove",
            style: Alert.ActionStyle.Destructive,
          },
        })
      ) {
        await saveEntries([], recentEntriesStorageKeys, databasePath);
        removeEntriesFromStoredGlobalState(combinedEntries ?? []);
        suppressStorageEntries(visibleStorageEntryKeys);
        await revalidate();
        showToast(
          Toast.Style.Success,
          "All removable entries removed",
          visibleStorageEntryKeys.length > 0
            ? "Storage-backed copies are hidden for this Raycast session"
            : `Restart ${build} to sync the list in ${build} (optional)`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to remove entries",
        message,
        primaryAction: {
          title: "Copy Error",
          onAction: () => {
            Clipboard.copy(message);
            showHUD("Copied to clipboard");
          },
        },
      });
    }
  }

  return { data: combinedEntries, isLoading, removeEntry, removeAllEntries };
}

/**
 * Returns the currently opened (active) VS Code workspace entries from
 * `storage.json` → `windowsState.openedWindows`. The last-active window
 * is placed first.
 */
export function useActiveEntries() {
  const storageState = useMemo(() => getStoredGlobalState(), []);
  const data = useMemo(() => getActiveEntries(storageState), [storageState]);

  return { data, isLoading: false };
}

function getStateDatabasePath() {
  const sharedStateDatabasePath = getSharedStateDatabasePath();

  if (sharedStateDatabasePath && fs.existsSync(sharedStateDatabasePath)) {
    return sharedStateDatabasePath;
  }

  return path.join(getGlobalStorageDirectory(), "state.vscdb");
}

function getStorageJsonPath() {
  return path.join(getGlobalStorageDirectory(), "storage.json");
}

function getGlobalStorageDirectory() {
  const build = getBuildNamePreference();

  if (isWin) {
    const appDataPath = process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming");
    return path.join(appDataPath, build, "User", "globalStorage");
  }

  return path.join(homedir(), "Library", "Application Support", build, "User", "globalStorage");
}

function getSharedStateDatabasePath() {
  const sharedDataFolderName = getSharedDataFolderName();

  if (!sharedDataFolderName) return undefined;

  // sharedDataFolderName (e.g. ".vscode-shared") lives directly in the home
  // directory on all platforms — not in AppData/Roaming or Library/Application Support.
  return path.join(homedir(), sharedDataFolderName, "sharedStorage", "state.vscdb");
}

function getSharedDataFolderName() {
  const productJSONPath = getProductJSONPath();

  if (productJSONPath && fs.existsSync(productJSONPath)) {
    try {
      const productJSONString = fs.readFileSync(productJSONPath, "utf-8");
      const productJSON = JSON.parse(productJSONString) as { sharedDataFolderName?: string };
      if (productJSON.sharedDataFolderName) {
        return productJSON.sharedDataFolderName;
      }
    } catch {
      // Ignore malformed product.json.
    }
  }

  return undefined;
}

async function saveEntries(
  entries: EntryLike[],
  storageKeys: readonly (typeof recentEntriesStorageKeys)[number][],
  databasePath: string,
) {
  const data = JSON.stringify({ entries });

  let DatabaseSync;
  try {
    // `node:sqlite` is available on Node 22.13+ (which Raycast bundles) and works on
    // all platforms, unlike the `sqlite3` CLI which only ships with macOS.
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    // Fall back to the `sqlite3` CLI on runtimes without `node:sqlite`.
    const escapedData = data.replace(/'/g, "''");
    const query = storageKeys
      .map((storageKey) => `INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('${storageKey}', '${escapedData}');`)
      .join("\n");
    await execFilePromise("sqlite3", [databasePath, query]);
    return;
  }

  const database = new DatabaseSync(databasePath);
  try {
    database.exec("BEGIN");
    const statement = database.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)");
    for (const storageKey of storageKeys) {
      statement.run(storageKey, data);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

function getFallbackEntries(): EntryLike[] {
  const storageState = getStoredGlobalState();
  if (!storageState) {
    return [];
  }

  // Prefer menubar recent order (actual recency from VS Code's File > Open Recent)
  // over profileAssociations (which is insertion order, not recency).
  const menubarEntries = getMenubarRecentEntries(storageState);
  const backupEntries = getBackupWorkspaceEntries(storageState);
  const profileEntries = getProfileAssociationEntries(storageState);

  const fallbackSource =
    menubarEntries.length > 0
      ? [...menubarEntries, ...backupEntries, ...profileEntries]
      : [...backupEntries, ...profileEntries];

  return mergeEntries(undefined, fallbackSource) ?? [];
}

function getStoredGlobalState(): StoredGlobalState | undefined {
  const storageJsonPath = getStorageJsonPath();
  if (!fs.existsSync(storageJsonPath)) {
    return undefined;
  }

  try {
    const storageContents = fs.readFileSync(storageJsonPath, "utf8");
    return JSON.parse(storageContents) as StoredGlobalState;
  } catch {
    return undefined;
  }
}

function getEntryUris(entry: EntryLike): string[] {
  if ("folderUri" in entry) {
    return [entry.folderUri];
  }

  if ("workspace" in entry) {
    return entry.workspace?.configPath ? [entry.workspace.configPath] : [];
  }

  if ("fileUri" in entry) {
    return [entry.fileUri];
  }

  return [];
}

/**
 * Removes entries from `storage.json` (`backupWorkspaces` and
 * `profileAssociations`). The visible list merges the state database with
 * these storage-backed copies, so deleting from the database alone lets
 * removed entries resurface on the next launch.
 *
 * Returns true when the file was changed. Never throws — callers treat this
 * as best-effort persistence on top of session suppression.
 */
function removeEntriesFromStoredGlobalState(entries: EntryLike[]): boolean {
  const storageJsonPath = getStorageJsonPath();
  if (!fs.existsSync(storageJsonPath)) {
    return false;
  }

  let state: StoredGlobalState;
  try {
    state = JSON.parse(fs.readFileSync(storageJsonPath, "utf8")) as StoredGlobalState;
  } catch {
    return false;
  }

  const uris = new Set(entries.flatMap((entry) => getEntryUris(entry)));
  if (uris.size === 0) {
    return false;
  }

  let changed = false;

  const folders = state.backupWorkspaces?.folders;
  if (folders) {
    // Keep records we cannot positively identify instead of crashing on them.
    const remaining = folders.filter((folder) => !folder?.folderUri || !uris.has(folder.folderUri));
    if (remaining.length !== folders.length) {
      state.backupWorkspaces!.folders = remaining;
      changed = true;
    }
  }

  const workspaces = state.backupWorkspaces?.workspaces;
  if (workspaces) {
    // Keep records we cannot positively identify instead of crashing on them.
    const remaining = workspaces.filter(
      (workspace) => !workspace?.workspace?.configPath || !uris.has(workspace.workspace.configPath),
    );
    if (remaining.length !== workspaces.length) {
      state.backupWorkspaces!.workspaces = remaining;
      changed = true;
    }
  }

  const associations = state.profileAssociations?.workspaces;
  if (associations) {
    for (const uri of Object.keys(associations)) {
      if (uris.has(uri)) {
        delete associations[uri];
        changed = true;
      }
    }
  }

  if (!changed) {
    return false;
  }

  try {
    fs.writeFileSync(storageJsonPath, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts recent entries from `lastKnownMenubarData` in `storage.json`.
 * This data reflects VS Code's actual File > Open Recent menu order,
 * which is the true recency order. Available in VS Code 1.122+ where
 * `recently.opened` is no longer stored in `state.vscdb`.
 */
function getMenubarRecentEntries(storageState: StoredGlobalState): EntryLike[] {
  const menubarData = storageState.lastKnownMenubarData;
  if (!menubarData) {
    return [];
  }

  const entries: EntryLike[] = [];
  const fileItems = menubarData.menus?.File?.items ?? [];

  for (const item of fileItems) {
    // Recurse into submenus (Open Recent is a submenu)
    const subItems = item.submenu?.items ?? [item];
    for (const subItem of subItems) {
      // Also recurse one more level if needed
      const deepItems = subItem.submenu?.items ?? [subItem];
      for (const recentItem of deepItems) {
        const id = recentItem.id;
        if (!id?.startsWith("openRecent")) continue;

        const uri = recentItem.uri;
        if (!uri?.path) continue;

        // Convert filesystem path to file:// URI
        const fileUri =
          uri.scheme === "file" || !uri.scheme
            ? `file://${encodeURI(uri.path).replace(/#/g, "%23")}`
            : `${uri.scheme}://${uri.authority ?? ""}${encodeURI(uri.path).replace(/#/g, "%23")}`;

        if (id === "openRecentWorkspace") {
          entries.push({ workspace: { configPath: fileUri } });
        } else if (id === "openRecentFolder") {
          entries.push({ folderUri: fileUri });
        } else if (id === "openRecentFile") {
          entries.push({ fileUri: fileUri });
        }
      }
    }
  }

  return entries;
}

function getBackupWorkspaceEntries(storageState: StoredGlobalState): EntryLike[] {
  const backupWorkspaces = storageState.backupWorkspaces;
  if (!backupWorkspaces) {
    return [];
  }

  const workspaceEntries = backupWorkspaces.workspaces ?? [];
  const folderEntries = backupWorkspaces.folders ?? [];

  return [...workspaceEntries, ...folderEntries].reverse();
}

function getProfileAssociationEntries(storageState: StoredGlobalState): EntryLike[] {
  const workspaceAssociations = storageState.profileAssociations?.workspaces;
  if (!workspaceAssociations) {
    return [];
  }

  return Object.keys(workspaceAssociations)
    .reverse()
    .map((uri) => toEntryFromUri(uri))
    .filter((entry): entry is EntryLike => entry !== undefined);
}

/**
 * Extracts currently opened (active) workspace entries from `windowsState` in `storage.json`.
 * This reflects the VS Code windows that are actually open right now.
 * Deduplicates by entry key so each workspace appears only once.
 */
export function getActiveEntries(storageState?: StoredGlobalState): EntryLike[] {
  const state = storageState ?? getStoredGlobalState();
  if (!state?.windowsState?.openedWindows?.length) {
    return [];
  }

  return state.windowsState.openedWindows
    .map(windowEntryToEntryLike)
    .filter((entry): entry is EntryLike => entry !== undefined);
}

function windowEntryToEntryLike(window: StoredWindowEntry): EntryLike | undefined {
  if (window.workspaceIdentifier?.configURIPath) {
    const uri = window.workspaceIdentifier.configURIPath;
    return window.remoteAuthority
      ? { workspace: { configPath: uri }, remoteAuthority: window.remoteAuthority, label: undefined }
      : { workspace: { configPath: uri } };
  }

  if (window.folder) {
    return window.remoteAuthority
      ? { folderUri: window.folder, remoteAuthority: window.remoteAuthority, label: undefined }
      : { folderUri: window.folder };
  }

  return undefined;
}

function parseEntryList(entries: string | undefined): EntryLike[] | undefined {
  if (!entries) {
    return undefined;
  }

  try {
    return JSON.parse(entries) as EntryLike[];
  } catch {
    return undefined;
  }
}

function mergeEntries(databaseEntries: EntryLike[] | undefined, backupEntries: EntryLike[]): EntryLike[] | undefined {
  const mergedEntries: EntryLike[] = [];
  const seenEntries = new Set<string>();
  const primaryEntries = hasBrowsableEntries(databaseEntries) ? (databaseEntries ?? []) : backupEntries;
  const secondaryEntries = hasBrowsableEntries(databaseEntries) ? backupEntries : (databaseEntries ?? []);

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = getEntryKey(entry);
    if (!key || seenEntries.has(key)) {
      continue;
    }

    seenEntries.add(key);
    mergedEntries.push(entry);
  }

  return mergedEntries.length > 0 ? mergedEntries : undefined;
}

function hasBrowsableEntries(entries: EntryLike[] | undefined): boolean {
  return (entries ?? []).some((entry) => {
    if ("folderUri" in entry) {
      return entry.folderUri.startsWith("file://") || entry.folderUri.startsWith("vscode-remote://");
    }

    if ("workspace" in entry) {
      return (
        entry.workspace.configPath.startsWith("file://") || entry.workspace.configPath.startsWith("vscode-remote://")
      );
    }

    if ("fileUri" in entry) {
      return entry.fileUri.startsWith("file://") || entry.fileUri.startsWith("vscode-remote://");
    }

    return false;
  });
}

function getEntryKey(entry: EntryLike): string | undefined {
  if ("folderUri" in entry) {
    return `folder:${entry.folderUri}`;
  }

  if ("workspace" in entry) {
    return `workspace:${entry.workspace.configPath}`;
  }

  if ("fileUri" in entry) {
    return `file:${entry.fileUri}`;
  }

  return undefined;
}

function toEntryFromUri(uri: string): EntryLike | undefined {
  if (uri.endsWith(".code-workspace")) {
    const remoteAuthority = getRemoteAuthorityFromUri(uri);
    return remoteAuthority ? { workspace: { configPath: uri }, remoteAuthority } : { workspace: { configPath: uri } };
  }

  const remoteAuthority = getRemoteAuthorityFromUri(uri);
  return remoteAuthority ? { folderUri: uri, remoteAuthority } : { folderUri: uri };
}

function getRemoteAuthorityFromUri(uri: string): string | undefined {
  if (!uri.startsWith("vscode-remote://")) {
    return undefined;
  }

  try {
    return decodeURIComponent(new URL(uri).host);
  } catch {
    return undefined;
  }
}
