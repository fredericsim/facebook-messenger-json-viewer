# Messenger JSON Viewer

A private, local-only viewer and exporter for Facebook Messenger JSON exports, including end-to-end encrypted conversation JSON exports.

Planned GitHub Pages app: https://fredericsim.github.io/facebook-messenger-json-viewer/

This tool turns one or more Messenger conversation JSON files and their matching media folder into a readable conversation view that can be printed or saved as PDF from your browser. It supports the newer end-to-end encrypted export JSON shape, where conversations commonly use fields such as `threadName`, `senderName`, `text`, `timestamp`, and `media`.

## Privacy

- Runs locally in your browser.
- Does not upload Messenger data anywhere.
- Does not use external analytics, cloud APIs, or remote processing.
- Uses the browser File API to read selected files.
- Uses the browser Web Crypto API for SHA-256 hashing.

You should still preserve the original Messenger JSON and media files unchanged. A generated PDF or HTML view is only a rendered copy.

## Notice

This project is a conversation viewer. It is intended to help create a private, traceable, readable view from an export while preserving original files.

This project is not affiliated with, endorsed by, or sponsored by Meta, Facebook, or Messenger.

## Features

- Select one or more Messenger conversation JSON files, including end-to-end encrypted export JSON files.
- Select the matching exported media folder.
- Parse, merge, and chronologically sort messages.
- Render sender, timestamp, text, reactions, shares, photos, videos, audio, GIFs, files, stickers, and call/system messages when present.
- Show missing media placeholders with the original `uri`.
- Filter by sender, date range, and keyword.
- Toggle timestamps, sender names, reactions, media previews, and mojibake repair.
- Print or save a readable PDF report from the browser.
- Include a cover page with participants, date range, message count, media summary, source files, generation date/time, and timezone.
- Include a file integrity section with SHA-256 hashes.
- Map unrecognized JSON formats with a no-code field mapping panel.

## How To Use

1. Export your Messenger conversation from Facebook.
2. Keep the exported folder intact. Do not edit the JSON or media files.
3. Open the app locally.
4. Click **Messenger JSON files** and select one or more conversation JSON files from the export.
5. Click **Matching media folder** and select the folder that contains the referenced media files, often `media/`.
6. Review the rendered conversation.
7. Use sender, keyword, and date filters if needed.
8. Use display toggles to show or hide timestamps, sender names, reactions, media previews, or mojibake repair.
9. Check the conversation summary for missing media.
10. Click **Print or save PDF**, then use your browser print dialog to save as PDF.

The PDF should be treated as a rendered copy. Keep the original Messenger export files separately and unchanged.

The browser file picker may use the word "upload" when selecting files or folders. In this app, that means granting the local browser page access to the files you selected. The app does not send them to a server.

## Supported JSON Shapes

The parser supports both common Messenger export shapes:

- Classic export fields such as `title`, `sender_name`, `content`, `timestamp_ms`, `photos`, `videos`, `audio_files`, `gifs`, and `files`.
- End-to-end encrypted Messenger export fields such as `threadName`, `senderName`, `text`, `timestamp`, `isUnsent`, and generic `media` entries with `uri` values like `./media/file.jpg`.

## Custom JSON Mapping

If a selected JSON file is not recognized, the app shows a **Map JSON Fields** panel. This is for non-technical users who have a JSON export with different field names.

The panel lets you choose fields from dropdowns:

- Message list
- Conversation title
- Participants
- Sender
- Message text
- Timestamp
- Media list
- Media URI
- Reactions

The app shows a small preview with message count, participant count, media reference count, and sample rows. Once the required fields are selected, the mapped messages are rendered in the report like a built-in format.

Mapping profiles can be exported and imported as JSON. A mapping profile contains only field names such as `messages`, `senderName`, or `media.uri`; it should not contain private message text or media.

The mapping system is declarative. It does not run user-provided code or scripts.

## Development

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Static Build

The production build outputs a single self-contained file:

```text
dist/index.html
```

After running `npm run build`, serve the build with `npm run preview` or from any static file host. Do not publish or commit real Messenger exports or generated PDFs.

## Repository Safety

This repo is intended to be safe to publish publicly. It should contain only source code, tests, mock data, and documentation.

Do not commit:

- Real conversation JSON files
- Exported media folders
- Generated PDFs
- Notes containing private case details
- `.context` or other local workspace files
