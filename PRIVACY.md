# Privacy

Effective date: June 19, 2026

Anti-chaos tabs is designed to run locally in your browser.

## Data The Extension Uses

To organize tabs into useful groups, the extension uses only the data needed for its core tab-management features. This includes:

- tab titles;
- tab URLs;
- tab group IDs, titles, colors, and collapsed state;
- browser window IDs;
- extension settings saved in browser storage.

This data is used locally to detect related open tabs, suggest or create tab groups, keep the active group expanded, and apply the user's grouping and collapse preferences.

The extension does not read page content, form fields, cookies, passwords, files, or the browser's saved browsing history. It only reads information about currently open tabs through Chrome extension APIs.

## Data Sharing

Anti-chaos tabs does not send tab data, browsing data, settings, analytics, or telemetry to any external server. It does not use remote AI services.

Anti-chaos tabs does not sell, transfer, or share user data with third parties.

## Local Storage

The extension stores only local preferences, including:

- automatic grouping settings;
- threshold and minimum group size;
- language preference;
- pinned-tab behavior;
- automatic group collapse preference;
- group collapse locks.

These values are stored using the browser extension storage APIs.

Users can remove this locally stored data by uninstalling the extension or clearing the extension's storage in the browser.

## Permissions

The requested permissions are used only for tab organization:

- `tabs`: read tab titles and URLs for local grouping.
- `tabGroups`: create, update, collapse, expand, and ungroup tab groups.
- `storage`: save local settings.
- `windows`: support current-window and all-window grouping.
- `contextMenus`: add a lock/unlock action to tab context menus.

The extension does not request host permissions.

## Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. For this extension, that information is limited to Chrome extension API data used locally for tab organization.
