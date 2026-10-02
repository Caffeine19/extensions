import { Grid, ActionPanel, Action, Icon, closeMainWindow } from "@raycast/api";
import { showFailureToast, useCachedPromise } from "@raycast/utils";
import { useState, useEffect, useMemo } from "react";

import { fetchAlbums, getOrExportThumbnail, openAlbumInPhotos, type PhotoAlbum } from "./api/photos";

type AlbumSection = {
  id: string;
  title?: string;
  albums: PhotoAlbum[];
};

const TRASH_ALBUM_NAME = "trash";

const SMART_ALBUM_PLACEHOLDER = { source: "gearshape.svg" };
const NO_COVER_PLACEHOLDER = { source: "rectangle-stack.svg" };

function groupAlbums(albums: PhotoAlbum[]): AlbumSection[] {
  const rootAlbums: PhotoAlbum[] = [];
  const trashAlbums: PhotoAlbum[] = [];
  const albumsByFolder = new Map<string, PhotoAlbum[]>();

  for (const album of albums) {
    if (album.name.toLowerCase() === TRASH_ALBUM_NAME) {
      trashAlbums.push(album);
    } else if (!album.parentPath) {
      rootAlbums.push(album);
    } else {
      const folderAlbums = albumsByFolder.get(album.parentPath) ?? [];
      folderAlbums.push(album);
      albumsByFolder.set(album.parentPath, folderAlbums);
    }
  }

  const sections: AlbumSection[] = [];
  if (rootAlbums.length > 0) sections.push({ id: "root", albums: rootAlbums });

  const folders = [...albumsByFolder.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  for (const folder of folders) {
    sections.push({ id: folder, title: folder, albums: albumsByFolder.get(folder) ?? [] });
  }

  if (trashAlbums.length > 0) sections.push({ id: "trash", albums: trashAlbums });
  return sections;
}

export default function Command() {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const {
    data: albums,
    isLoading,
    error,
    revalidate,
  } = useCachedPromise(fetchAlbums, [], {
    keepPreviousData: true,
  });

  useEffect(() => {
    if (error) showFailureToast(`Failed to load albums: ${String(error)}`);
  }, [error]);

  // Covers keyed by cover media id: shared key photos export once, a changed key photo reloads.
  useEffect(() => {
    let cancelled = false;

    async function loadCovers() {
      for (const album of albums ?? []) {
        if (cancelled) break;
        const coverMediaId = album.coverMediaId;
        if (!coverMediaId) continue;
        try {
          // rendered JPEG export: album covers can be any asset (e.g. RAW), not just convertible originals
          const thumb = await getOrExportThumbnail(coverMediaId, true);
          if (!cancelled) {
            setThumbnails((prev) => (prev[coverMediaId] === thumb ? prev : { ...prev, [coverMediaId]: thumb }));
          }
        } catch {
          // leave as placeholder icon for albums whose cover can't be exported
        }
      }
    }

    loadCovers().catch(() => {
      // individual cover failures are already handled above
    });
    return () => {
      cancelled = true;
    };
  }, [albums]);

  const sections = useMemo(() => groupAlbums(albums ?? []), [albums]);

  return (
    <Grid
      columns={6}
      fit={Grid.Fit.Contain}
      isLoading={isLoading}
      searchBarPlaceholder="Filter by album name or folder"
    >
      {sections.map((section) => (
        <Grid.Section key={section.id} title={section.title}>
          {section.albums.map((album) => {
            const coverPath = album.coverMediaId ? thumbnails[album.coverMediaId] : undefined;

            return (
              <Grid.Item
                key={album.id}
                content={coverPath ?? (album.isSmartAlbum ? SMART_ALBUM_PLACEHOLDER : NO_COVER_PLACEHOLDER)}
                title={album.name}
                subtitle={`${album.itemCount} items`}
                keywords={[album.name, album.parentPath]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action
                        title="Open in Photos"
                        icon={Icon.AppWindow}
                        onAction={async () => {
                          try {
                            await openAlbumInPhotos(album.id);
                            closeMainWindow();
                          } catch (e) {
                            showFailureToast(`Open failed: ${String(e)}`);
                          }
                        }}
                      />
                      <Action.CopyToClipboard title="Copy Album Name" icon={Icon.Clipboard} content={album.name} />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="Refresh"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                        onAction={revalidate}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            );
          })}
        </Grid.Section>
      ))}
      <Grid.EmptyView
        title={albums ? "No albums found" : "Loading albums…"}
        description={albums ? "" : "Reading albums from Photos…"}
      />
    </Grid>
  );
}
