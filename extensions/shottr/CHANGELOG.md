# Shottr Changelog

## [Fix reverse scrolling capture deeplink] - {PR_MERGE_DATE}

- Fixed "Capture Scrolling Reverse" using the wrong deeplink (`shottr://grab/delayed`, now uses the official `shottr://grab/scrolling/reverse`.
- Updated the README deeplink troubleshooting table to match.
- Argument placeholder: add default value hint to Capture Delayed.

## [Add Close Main Window preference] - 2026-07-28

- Added a "Close Main Window" preference.

## [Fix didn't close Raycast main window] - 2026-07-07

- Added `closeMainWindow()` to all commands so the Raycast window closes immediately when triggering a Shottr action.

## [Use open -g to avoid focus transfer] - 2026-07-02

- Changed all screenshot commands to use `execSync` with `open -g` flag to prevent window focus transfer during capture.

## [Security Maintenance] - 2026-05-21

- Updated the extension to address security advisories.

## [Update Documentation] - 2024-10-14

## [Initial Version] - 2024-10-14
