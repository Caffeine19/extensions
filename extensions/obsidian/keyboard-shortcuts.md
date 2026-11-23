# Obsidian Raycast Extension - Keyboard Shortcuts

This document lists all actions with their keyboard shortcuts defined in the Obsidian Raycast extension.

## Note Actions (`src/utils/actions.tsx`)

| Action                           | macOS Shortcut | Windows Shortcut   | Description                              |
| -------------------------------- | -------------- | ------------------ | ---------------------------------------- |
| **Show in Finder**               | `⌘ + O`        | `Ctrl + O`         | Show note file in Finder                 |
| **Copy File Path**               | `⌘ + ⇧ + C`    | `Ctrl + Shift + C` | Copy note file path to clipboard         |
| **Edit Note**                    | `⌘ + E`        | `Ctrl + E`         | Open note for editing                    |
| **Append to Note**               | `⌘ + ⇧ + A`    | `Ctrl + Shift + A` | Append content to note                   |
| **Append Task**                  | `⌘ + ⌥ + A`    | `Ctrl + Alt + A`   | Append task to note                      |
| **Append Selected Text to Note** | `⌘ + S`        | `Ctrl + S`         | Append selected text to note             |
| **Copy Note Content**            | `⌘ + C`        | `Ctrl + C`         | Copy entire note content                 |
| **Copy Note Title**              | `⌘ + T`        | `Ctrl + T`         | Copy note title                          |
| **Copy Wikilink**                | `⌘ + ⌥ + W`    | `Ctrl + Alt + W`   | Copy `[[Note Title]]` wikilink           |
| **Paste Wikilink**               | `⌘ + ⇧ + W`    | `Ctrl + Shift + W` | Paste `[[Note Title]]` wikilink          |
| **Paste Note Content**           | `⌘ + V`        | `Ctrl + V`         | Paste note content                       |
| **Copy Markdown Link**           | `⌘ + L`        | `Ctrl + L`         | Copy `[Note Title](obsidian://...)` link |
| **Copy Obsidian Link**           | `⌘ + U`        | `Ctrl + U`         | Copy `obsidian://...` URI                |
| **Delete Note**                  | `⌘ + D`        | `Ctrl + D`         | Delete note (with confirmation)          |
| **Bookmark Note**                | `⌘ + ⇧ + P`    | `Ctrl + Shift + P` | Add note to bookmarks                    |
| **Unbookmark Note**              | `⌘ + ⇧ + P`    | `Ctrl + Shift + P` | Remove note from bookmarks               |
| **Copy Vault Path**              | `⌘ + ⇧ + C`    | `Ctrl + Shift + C` | Copy vault folder path                   |

## Custom Actions (`src/runActionCommand.tsx`)

| Action                 | macOS Shortcut | Windows Shortcut   | Description                     |
| ---------------------- | -------------- | ------------------ | ------------------------------- |
| **Copy Quicklink URL** | `⌘ + ⇧ + C`    | `Ctrl + Shift + C` | Copy quicklink URL to clipboard |
| **Edit Action**        | `⌘ + E`        | `Ctrl + E`         | Edit selected custom action     |
| **Delete Action**      | `⌃ + X`        | `Ctrl + X`         | Delete selected custom action   |
| **Create New Action**  | `⌘ + N`        | `Ctrl + N`         | Create a new custom action      |
| **Export All Actions** | `⌘ + ⇧ + E`    | `Ctrl + Shift + E` | Export all actions to clipboard |
| **Import Actions**     | `⌘ + ⇧ + I`    | `Ctrl + Shift + I` | Import actions from clipboard   |

## Create Note Form (`src/components/CreateNoteForm.tsx`)

| Action                 | macOS Shortcut  | Windows Shortcut       | Description                                |
| ---------------------- | --------------- | ---------------------- | ------------------------------------------ |
| **Create in [Folder]** | `⌘ + ⇧ + [1-9]` | `Ctrl + Shift + [1-9]` | Create note in predefined folder (dynamic) |

## Change History

The following shortcuts were changed from Option-based to Command-based shortcuts to align with Raycast conventions:

| Action                           | Old Shortcut (macOS) | New Shortcut (macOS) | Reason                                                          |
| -------------------------------- | -------------------- | -------------------- | --------------------------------------------------------------- |
| **Show in Finder**               | `⌥ + Enter`          | `⌘ + O`              | Changed to `⌘+O` to avoid Raycast reserved `⌘+Enter`            |
| **Copy File Path**               | `⌥ + ⇧ + C`          | `⌘ + ⇧ + C`          | Standardized to Command key                                     |
| **Edit Note**                    | `⌥ + E`              | `⌘ + E`              | Standardized to Command key                                     |
| **Append to Note**               | `⌥ + A`              | `⌘ + ⇧ + A`          | Changed to `⌘+⇧+A` to avoid conflict with Append Task           |
| **Append Task**                  | `⌥ + A`              | `⌘ + ⌥ + A`          | Changed to `⌘+⌥+A` to avoid conflict with Append to Note        |
| **Append Selected Text to Note** | `⌥ + S`              | `⌘ + S`              | Standardized to Command key                                     |
| **Copy Note Content**            | `⌥ + C`              | `⌘ + C`              | Standardized to Command key                                     |
| **Copy Note Title**              | `⌥ + T`              | `⌘ + T`              | Standardized to Command key                                     |
| **Copy Wikilink**                | `⌥ + W`              | `⌘ + ⌥ + W`          | Changed to `⌘+⌥+W` to avoid Raycast reserved `⌘+W`              |
| **Paste Wikilink**               | `⌥ + ⇧ + W`          | `⌘ + ⇧ + W`          | Standardized to Command key                                     |
| **Paste Note Content**           | `⌥ + V`              | `⌘ + V`              | Standardized to Command key                                     |
| **Copy Markdown Link**           | `⌥ + L`              | `⌘ + L`              | Standardized to Command key                                     |
| **Copy Obsidian Link**           | `⌥ + U`              | `⌘ + U`              | Standardized to Command key                                     |
| **Delete Note**                  | `⌥ + D`              | `⌘ + D`              | Standardized to Command key                                     |
| **Bookmark Note**                | `⌥ + P`              | `⌘ + ⇧ + P`          | Changed to avoid conflict with Raycast's `⌘ + P` (Quick Search) |
| **Unbookmark Note**              | `⌥ + P`              | `⌘ + ⇧ + P`          | Changed to avoid conflict with Raycast's `⌘ + P` (Quick Search) |
| **Copy Vault Path**              | `⌥ + ⇧ + C`          | `⌘ + ⇧ + C`          | Standardized to Command key                                     |

## Notes

- **Modifier Keys**:

  - `⌘` = Command (Ctrl on Windows)
  - `⌃` = Control
  - `⇧` = Shift

- Some actions share the same shortcut but are used in different contexts (e.g., `Copy File Path` and `Copy Vault Path` both use `⌘ + ⇧ + C`).
- The `Create in [Folder]` shortcut is dynamic and depends on the user's configured folder actions in preferences.
- Not all actions have keyboard shortcuts; only those explicitly defined in the code are listed above.
- The extension follows Raycast's keyboard shortcut conventions.
