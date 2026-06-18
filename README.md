# Anti-chaos tabs

Anti-chaos tabs is a local Chrome/Edge extension that helps users stay oriented when many browser tabs are open. It suggests and creates tab groups by looking at tab URLs, domains, services, and titles.

## Features

- Groups tabs manually with the `Group tabs` button.
- Suggests groups when the tab count passes a configurable threshold.
- Supports automatic grouping without asking every time.
- Detects related tabs by URL, domain, service, and tab title.
- Separates Excel, Word, PowerPoint, Google Workspace, and OneDrive tabs.
- Combines related shopping research, for example Amazon + eBay laptop searches.
- Can automatically collapse inactive groups while keeping the active group open.
- Lets users lock selected groups so they stay expanded.
- Uses the browser language automatically, with a manual language switch inside the popup.
- Supports English, Russian, Spanish, French, German, Portuguese, and Italian.
- Does not send tabs or browsing data to external servers.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click `Load unpacked`.
5. Select the repository folder that contains `manifest.json`.

## Usage

- Click the extension icon and choose `Group tabs`.
- Enable `Auto grouping` if you want the extension to organize tabs after the threshold is reached.
- Enable `Collapse groups automatically` if inactive groups should be collapsed.
- Use `Group collapse locks` in the popup settings to keep selected groups expanded.
- You can also right-click a tab inside a group and choose the Anti-chaos lock item. Chrome does not expose the tab-group header context menu to extensions.
- Click the settings icon in the popup to keep browser-language detection or force a language.
- `Threshold` controls how many open tabs are needed before grouping is suggested or started automatically.
- `Min. group` controls the minimum number of similar tabs required to create a group.

## Permissions

The extension asks for these browser permissions:

- `tabs`: reads tab URLs and titles so it can detect related tabs.
- `tabGroups`: creates, updates, collapses, expands, and ungroups tab groups.
- `storage`: saves user settings, language choice, and group collapse locks.
- `windows`: supports grouping in the current window or across all normal windows.
- `contextMenus`: adds a lock/unlock action when right-clicking a tab inside a group.

Anti-chaos tabs does not request host permissions and does not read page content.

## Privacy

All analysis happens locally in the browser. The extension does not collect analytics, does not use a remote AI service, and does not send tab URLs, titles, settings, or browsing data to any external server.

See [PRIVACY.md](PRIVACY.md) for the full privacy note.

## Limitations

The extension analyzes only URLs and tab titles. It does not read page content and does not use external AI, so it may group more conservatively than a human would.

## License

MIT. See [LICENSE](LICENSE).
