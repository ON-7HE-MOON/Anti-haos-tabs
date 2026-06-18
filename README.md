# Anti-chaos tabs

A local Chrome/Edge extension that helps users stay oriented when many browser tabs are open.

## Features

- Groups tabs manually with the `Group tabs` button.
- Suggests groups when the tab count passes a configurable threshold.
- Supports auto grouping without asking every time.
- Detects related tabs by URL, domain, service, and tab title.
- Separates Excel, Word, PowerPoint, and OneDrive tabs.
- Combines related shopping research, for example Amazon + eBay laptop searches.
- Uses the browser language automatically, with a manual language switch inside the popup.
- Supports English, Russian, Spanish, French, German, Portuguese, and Italian.
- Does not send tabs or browsing data to external servers.

## Installation

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Click `Load unpacked`.
4. Select `C:\Users\qazym\AntiСhaos-tabs`.

## Usage

- Click the extension icon and choose `Group tabs`.
- Enable `Auto grouping` if you want the extension to organize tabs after the threshold is reached.
- Enable `Auto-collapse groups` if newly organized groups should start collapsed.
- Use `Group collapse locks` in the popup settings to keep selected groups expanded.
- You can also right-click a tab inside a group and choose the Anti-chaos lock item. Chrome does not expose the tab-group header context menu to extensions.
- Click the settings icon in the popup to keep browser-language detection or force a language.
- `Threshold` controls how many open tabs are needed before grouping is suggested or started automatically.
- `Min. group` controls the minimum number of similar tabs required to create a group.

## Limitations

The extension analyzes only URLs and tab titles. It does not read page content and does not use external AI, so it may group more conservatively than a human would.
