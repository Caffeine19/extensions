import {
  List,
  Grid,
  ActionPanel,
  Action,
  Icon,
  Clipboard,
  closeMainWindow,
  showHUD,
  getPreferenceValues,
  getFrontmostApplication,
} from "@raycast/api";
import { runAppleScript, showFailureToast } from "@raycast/utils";
import { useState, useEffect, useCallback } from "react";

import { fetchPhotoMetadata, getOrExportThumbnail, getOrExportOriginal, openPhotoInPhotos } from "./api/photos";
import { ListOrGrid, ListOrGridEmptyView, ListOrGridItem, type LayoutType } from "./utils/list-or-grid";

type PhotoState = {
  id: string;
  filename: string;
  date: string;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  if (diffDays < 365) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Command() {
  const { photoCount } = getPreferenceValues();
  const count = Math.max(1, parseInt(photoCount, 10) || 24);

  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previousApp, setPreviousApp] = useState<string>("");
  const [layout, setLayout] = useState<LayoutType>("list");

  const revalidate = useCallback(() => {
    setPhotos([]);
    setThumbnails({});
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (refreshKey === 0) {
        try {
          const app = await getFrontmostApplication();
          if (!cancelled) setPreviousApp(app.name);
        } catch {
          // ignore
        }
      }

      const rawItems = await fetchPhotoMetadata(count);
      rawItems.reverse();

      if (!cancelled) {
        setPhotos(rawItems);
        setThumbnails({});
      }

      for (const item of rawItems) {
        if (cancelled) break;
        try {
          const thumb = await getOrExportThumbnail(item.id);
          if (!cancelled) {
            setThumbnails((prev) => (prev[item.id] === thumb ? prev : { ...prev, [item.id]: thumb }));
          }
        } catch {
          // leave as null thumbnail placeholder
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    load().catch((e) => showFailureToast(`Failed to load photos: ${String(e)}`));
    return () => {
      cancelled = true;
    };
  }, [refreshKey, count]);

  const toggleLayout = useCallback(() => {
    setLayout((prev) => (prev === "list" ? "grid" : "list"));
  }, []);

  const photoActions = (photo: PhotoState, thumbnailPath?: string) => (
    <ActionPanel>
      <ActionPanel.Section>
        <Action
          title="Copy to Clipboard"
          icon={Icon.Clipboard}
          onAction={async () => {
            try {
              const origPath = await getOrExportOriginal(photo.id);
              await Clipboard.copy({ file: origPath });
              await closeMainWindow();
              await showHUD("Copied to Clipboard");
            } catch (e) {
              showFailureToast(`Copy failed: ${String(e)}`);
            }
          }}
        />
        <Action
          title={previousApp ? `Paste to ${previousApp}` : "Paste to Current App"}
          icon={Icon.ArrowRight}
          shortcut={{ modifiers: ["cmd"], key: "return" }}
          onAction={async () => {
            try {
              const origPath = await getOrExportOriginal(photo.id);
              await Clipboard.copy({ file: origPath });
              await closeMainWindow();
              await runAppleScript(`
                tell application "System Events"
                  keystroke "v" using command down
                end tell
              `);
            } catch (e) {
              showFailureToast(`Paste failed: ${String(e)}`);
            }
          }}
        />
        <Action
          title="Open in Photos"
          icon={Icon.AppWindow}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
          onAction={async () => {
            try {
              await openPhotoInPhotos(photo.id);
            } catch (e) {
              showFailureToast(`Open failed: ${String(e)}`);
            }
          }}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        {layout === "grid" && thumbnailPath ? (
          <Action.ToggleQuickLook shortcut={{ modifiers: ["cmd"], key: "y" }} />
        ) : null}
        <Action
          title="Toggle Layout"
          icon={Icon.AppWindowGrid3x3}
          shortcut={{ modifiers: ["cmd"], key: "l" }}
          onAction={toggleLayout}
        />
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={revalidate}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );

  return (
    <ListOrGrid
      layoutType={layout}
      isShowingDetail
      columns={3}
      inset={Grid.Inset.Medium}
      isLoading={isLoading}
      searchBarPlaceholder="Filter by filename or date"
    >
      {photos.map((photo) => {
        const thumbnailPath = thumbnails[photo.id];

        return (
          <ListOrGridItem
            key={photo.id}
            layoutType={layout}
            icon={thumbnailPath ?? Icon.Image}
            content={thumbnailPath ?? Icon.Image}
            title={photo.filename}
            subtitle={layout === "grid" ? formatDate(photo.date) : undefined}
            accessories={layout === "list" ? [{ text: formatDate(photo.date) }] : undefined}
            keywords={[photo.filename, formatDate(photo.date)]}
            quickLook={thumbnailPath ? { name: photo.filename, path: thumbnailPath } : undefined}
            detail={
              thumbnailPath ? (
                <List.Item.Detail markdown={`![${photo.filename}](${encodeURI("file://" + thumbnailPath)})`} />
              ) : undefined
            }
            actions={photoActions(photo, thumbnailPath)}
          />
        );
      })}
      <ListOrGridEmptyView
        layoutType={layout}
        title={isLoading ? "Loading photos…" : "No photos found"}
        description={isLoading ? "Exporting thumbnails from Photos…" : ""}
      />
    </ListOrGrid>
  );
}
