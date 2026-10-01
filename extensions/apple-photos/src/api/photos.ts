import { runAppleScript } from "@raycast/utils";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { thumbnailPath, originalPath, idToFilename, thumbnailDir, originalsDir } from "../utils/cache";

const execFileAsync = promisify(execFile);
const CONVERTIBLE_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp",
  ".webp",
]);

function isConvertibleImageFilename(filename: string): boolean {
  return CONVERTIBLE_IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export async function fetchPhotoMetadata(count = 24): Promise<{ id: string; filename: string; date: string }[]> {
  try {
    return await fetchMetadataFromDB(count);
  } catch {
    return await fetchMetadataFromAppleScript(count);
  }
}

async function fetchMetadataFromDB(count: number): Promise<{ id: string; filename: string; date: string }[]> {
  const dbPath = path.join(os.homedir(), "Pictures", "Photos Library.photoslibrary", "database", "Photos.sqlite");

  const query = `SELECT a.ZUUID, COALESCE(aa.ZORIGINALFILENAME, a.ZFILENAME), CAST(a.ZDATECREATED + 978307200 AS INTEGER) FROM ZASSET a LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.Z_PK = a.ZADDITIONALATTRIBUTES WHERE a.ZTRASHEDSTATE = 0 AND a.ZHIDDEN = 0 AND a.ZLIBRARYSCOPETYPE = 0 ORDER BY a.ZDATECREATED DESC LIMIT ${count};`;

  const { stdout } = await execFileAsync("/usr/bin/sqlite3", ["-separator", "\t", dbPath, query]);

  if (!stdout.trim()) return [];

  return stdout
    .trim()
    .split("\n")
    .map((line) => {
      const [uuid, filename, unixTs] = line.split("\t");
      const date = new Date(parseInt(unixTs, 10) * 1000);
      return { id: `${uuid}/L0/001`, filename, date: date.toString() };
    })
    .filter((item) => isConvertibleImageFilename(item.filename))
    .reverse();
}

async function fetchMetadataFromAppleScript(count: number): Promise<{ id: string; filename: string; date: string }[]> {
  const result = await runAppleScript(`
    tell application "Photos"
      set allItems to media items
      set totalCount to count of allItems
      set startIndex to totalCount - ${count - 1}
      if startIndex < 1 then set startIndex to 1
      set theItems to items startIndex thru totalCount of allItems
      set output to ""
      repeat with i from 1 to count of theItems
        set theItem to item i of theItems
        set theId to id of theItem
        set theFilename to filename of theItem
        set theRawDate to date of theItem
        set theDate to (date string of theRawDate) & " " & (time string of theRawDate)
        if i > 1 then set output to output & "\n"
        set output to output & theId & "\t" & theFilename & "\t" & theDate
      end repeat
      return output
    end tell
  `);

  if (!result.trim()) return [];

  return result
    .trim()
    .split("\n")
    .map((line) => {
      const [id, filename, date] = line.split("\t");
      return { id, filename, date };
    })
    .filter((item) => isConvertibleImageFilename(item.filename));
}

export async function fetchMostRecentPhotoId(): Promise<string> {
  return runAppleScript(`
    tell application "Photos"
      return id of last media item
    end tell
  `);
}

async function exportPhoto(photoId: string, destDir: string, rendered = false): Promise<void> {
  await runAppleScript(`
    tell application "Photos"
      set theItem to media item id "${photoId}"
      export {theItem} to (POSIX file "${destDir}")${rendered ? "" : " with using originals"}
    end tell
  `);
}

async function sipsConvert(inputPath: string, outputPath: string, maxDimension?: number): Promise<void> {
  const args = ["-s", "format", "jpeg"];
  if (maxDimension) {
    args.push("-Z", String(maxDimension));
  }
  args.push(inputPath, "--out", outputPath);
  await execFileAsync("/usr/bin/sips", args);
}

async function exportAndConvert(
  photoId: string,
  destDir: string,
  outputPath: string,
  maxDimension?: number,
  rendered = false,
): Promise<void> {
  const safe = idToFilename(photoId);
  const tempDir = path.join(destDir, `tmp_${safe}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await exportPhoto(photoId, tempDir, rendered);

    const exported = fs.readdirSync(tempDir).sort();
    if (exported.length === 0) {
      throw new Error(`Export produced no files for photo ${photoId}`);
    }

    const sourceFilename = exported.find((filename) => isConvertibleImageFilename(filename));
    if (!sourceFilename) {
      throw new Error(`Export produced no convertible image files for photo ${photoId}`);
    }

    const srcPath = path.join(tempDir, sourceFilename);
    await sipsConvert(srcPath, outputPath, maxDimension);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function getOrExportThumbnail(photoId: string, rendered = false): Promise<string> {
  const cachePath = thumbnailPath(photoId);
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }
  await exportAndConvert(photoId, thumbnailDir(), cachePath, undefined, rendered);
  return cachePath;
}

export async function getOrExportOriginal(photoId: string): Promise<string> {
  const cachePath = originalPath(photoId);
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }
  await exportAndConvert(photoId, originalsDir(), cachePath);
  return cachePath;
}

export async function openPhotoInPhotos(photoId: string): Promise<void> {
  await runAppleScript(`
    tell application "Photos"
      spotlight (media item id "${photoId}")
      activate
    end tell
  `);
}

export type PhotoAlbum = {
  id: string;
  name: string;
  parentPath: string;
  itemCount: number;
  coverMediaId: string | null;
  isSmartAlbum: boolean;
};

export async function fetchAlbums(): Promise<PhotoAlbum[]> {
  const result = await runAppleScript(`
    on albumRow(theAlbum, parentPath)
      tell application "Photos"
        set albumName to name of theAlbum
        set albumId to id of theAlbum
        set itemCount to 0
        try
          set itemCount to count of media items of theAlbum
        end try
      end tell
      return albumName & tab & albumId & tab & (itemCount as text) & tab & parentPath
    end albumRow

    on walkFolder(theFolder, parentPath)
      tell application "Photos"
        set folderName to name of theFolder
      end tell
      if parentPath is "" then
        set currentPath to folderName
      else
        set currentPath to parentPath & " / " & folderName
      end if
      set rows to {}
      tell application "Photos"
        repeat with theAlbum in albums of theFolder
          set end of rows to my albumRow(theAlbum, currentPath)
        end repeat
        repeat with subFolder in folders of theFolder
          set rows to rows & (my walkFolder(subFolder, currentPath))
        end repeat
      end tell
      return rows
    end walkFolder

    set allRows to {}
    tell application "Photos"
      repeat with theAlbum in albums
        set end of allRows to my albumRow(theAlbum, "")
      end repeat
      repeat with subFolder in folders
        set allRows to allRows & (my walkFolder(subFolder, ""))
      end repeat
    end tell
    set output to ""
    repeat with i from 1 to count of allRows
      if i > 1 then set output to output & linefeed
      set output to output & item i of allRows
    end repeat
    return output
  `);

  if (!result.trim()) return [];

  const albums = result
    .trim()
    .split("\n")
    .map((line) => {
      const [name, id, itemCount, parentPath = ""] = line.split("\t");
      return {
        id,
        name,
        parentPath,
        itemCount: parseInt(itemCount, 10) || 0,
      };
    })
    .filter((album) => album.id && album.name);

  // Cover = the album's key photo (Photos → Make Key Photo) via PhotoKit. Smart albums don't exist
  // in PhotoKit at all (and Photos can't assign them a key photo), so their ids are absent from the
  // map — that's how they're detected, letting the UI show a fitting placeholder instead of guessing.
  const covers = await fetchAlbumCoverIds(albums.map((album) => album.id));

  return albums
    .map((album) => ({
      ...album,
      coverMediaId: covers[album.id] ?? null,
      isSmartAlbum: !(album.id in covers),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

async function fetchAlbumCoverIds(albumIds: string[]): Promise<Record<string, string | null>> {
  if (albumIds.length === 0) return {};

  // AppleScriptObjC: Photos' AppleScript dictionary has no key-asset property, so reach for
  // PhotoKit directly (`count` must be written |count|() — it collides with the `count` command).
  // Only regular user albums are considered (assetCollectionSubtype = 2): smart albums can't have
  // a key photo in Photos, and PhotoKit doesn't even resolve them for their AppleScript ids.
  const result = await runAppleScript(
    `
      use framework "Photos"
      use framework "Foundation"

      on keyAssetId(theCollection, opts)
        set keys to current application's PHAsset's fetchKeyAssetsInAssetCollection:theCollection options:opts
        if keys is missing value then return ""
        if (keys's |count|()) = 0 then return ""
        return ((keys's objectAtIndex:0)'s localIdentifier()) as text
      end keyAssetId

      on coverRow(theCollection, opts)
        if (theCollection's assetCollectionSubtype()) is not 2 then return ""
        set albumId to (theCollection's localIdentifier()) as text
        return albumId & tab & my keyAssetId(theCollection, opts)
      end coverRow

      on run argv
        set output to ""
        set opts to current application's PHFetchOptions's alloc()'s init()
        set ids to current application's NSArray's arrayWithArray:argv
        set cols to current application's PHAssetCollection's fetchAssetCollectionsWithLocalIdentifiers:ids options:opts
        repeat with i from 0 to ((cols's |count|()) - 1)
          set theRow to my coverRow(cols's objectAtIndex:i, opts)
          if (output is not "") and (theRow is not "") then set output to output & linefeed
          set output to output & theRow
        end repeat
        return output
      end run
    `,
    albumIds,
  );

  if (!result.trim()) return {};

  // Key presence = a regular album PhotoKit knows; value = its key photo id, or null when unset.
  return result
    .trim()
    .split("\n")
    .map((line) => line.split("\t"))
    .reduce<Record<string, string | null>>((covers, [albumId, coverId]) => {
      if (albumId) covers[albumId] = coverId || null;
      return covers;
    }, {});
}

export async function openAlbumInPhotos(albumId: string): Promise<void> {
  await runAppleScript(`
    tell application "Photos"
      spotlight (album id "${albumId}")
      activate
    end tell
  `);
}
