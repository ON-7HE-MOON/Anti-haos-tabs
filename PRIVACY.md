# Privacy

Anti-chaos tabs is designed to run locally in your browser.

## Data The Extension Uses

To group tabs, the extension reads:

- tab titles;
- tab URLs;
- tab group IDs, titles, colors, and collapsed state;
- browser window IDs;
- extension settings saved in browser storage.

The extension does not read page content, form fields, cookies, passwords, files, or browsing history.

## Data Sharing

Anti-chaos tabs does not send tab data, browsing data, settings, analytics, or telemetry to any external server. It does not use remote AI services.

## Local Storage

The extension stores only local preferences, including:

- automatic grouping settings;
- threshold and minimum group size;
- language preference;
- pinned-tab behavior;
- automatic group collapse preference;
- group collapse locks.

These values are stored using the browser extension storage APIs.

## Permissions

The requested permissions are used only for tab organization:

- `tabs`: read tab titles and URLs for local grouping.
- `tabGroups`: create, update, collapse, expand, and ungroup tab groups.
- `storage`: save local settings.
- `windows`: support current-window and all-window grouping.
- `contextMenus`: add a lock/unlock action to tab context menus.

The extension does not request host permissions.
