import type { DisplayToggles } from "./Controls";
import type { HashRecord } from "../lib/hash";
import type { MediaResolution, MediaStats } from "../lib/media";
import type { MergedConversation, NormalizedMessage } from "../types/messenger";

interface EvidencePacketProps {
  conversation: MergedConversation | null;
  messages: NormalizedMessage[];
  sourceHashes: HashRecord[];
  mediaHashes: HashRecord[];
  mediaResolutions: Map<string, MediaResolution>;
  mediaStats: MediaStats;
  mediaUrls: Map<string, string>;
  toggles: DisplayToggles;
  generatedAt: Date;
  timezone: string;
}

export function EvidencePacket({
  conversation,
  messages,
  sourceHashes,
  mediaHashes,
  mediaResolutions,
  mediaStats,
  mediaUrls,
  toggles,
  generatedAt,
  timezone,
}: EvidencePacketProps) {
  if (!conversation) {
    return (
      <main className="document-shell" aria-label="Evidence packet preview">
        <div className="empty-state">
          <h2>Select Messenger JSON files to begin</h2>
          <p>
            Choose one or more Messenger conversation JSON files, including end-to-end encrypted export files, then select the matching media folder.
            The rendered packet will appear here and can be
            printed to PDF from the browser.
          </p>
        </div>
      </main>
    );
  }

  const repairCount = conversation.messages.filter((message) => message.contentRepair?.changed).length;
  const parseWarnings = conversation.warnings;

  return (
    <main className="document-shell" aria-label="Evidence packet preview">
      <div className="print-header" aria-hidden="true">
        {conversation.title} - Rendered Messenger evidence packet
      </div>
      <div className="print-footer" aria-hidden="true">
        Generated {formatDateTime(generatedAt)} {timezone}.
      </div>

      <article className="evidence-document">
        <CoverPage conversation={conversation} sourceHashes={sourceHashes} mediaStats={mediaStats} generatedAt={generatedAt} timezone={timezone} />

        {parseWarnings.length > 0 ? <ParseWarnings warnings={parseWarnings} /> : null}

        <section className="packet-section chat-section">
          <div className="section-heading">
            <h2>Rendered Conversation</h2>
            <p>
              Showing {messages.length} of {conversation.messages.length} messages. Message content is rendered from the selected Messenger export.
            </p>
          </div>

          {repairCount > 0 ? (
            <p className="document-note">
              {repairCount} message{repairCount === 1 ? "" : "s"} contain patterns that may be mojibake. Optional repair is{" "}
              {toggles.repairMojibake ? "shown for display" : "available but currently hidden"}; original JSON is preserved and hashed.
            </p>
          ) : null}

          <div className="message-list">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                resolutionMap={mediaResolutions}
                mediaUrls={mediaUrls}
                toggles={toggles}
              />
            ))}
          </div>
        </section>

        <IntegritySection
          conversation={conversation}
          sourceHashes={sourceHashes}
          mediaHashes={mediaHashes}
          mediaResolutions={mediaResolutions}
          mediaStats={mediaStats}
          generatedAt={generatedAt}
          timezone={timezone}
        />
      </article>
    </main>
  );
}

function CoverPage({
  conversation,
  sourceHashes,
  mediaStats,
  generatedAt,
  timezone,
}: {
  conversation: MergedConversation;
  sourceHashes: HashRecord[];
  mediaStats: MediaStats;
  generatedAt: Date;
  timezone: string;
}) {
  return (
    <section className="cover-page">
      <p className="eyebrow">Local rendered packet</p>
      <h1>{conversation.title}</h1>

      <dl className="cover-grid">
        <div>
          <dt>Participants</dt>
          <dd>{conversation.participants.length ? conversation.participants.join(", ") : "Not listed in export"}</dd>
        </div>
        <div>
          <dt>Date range</dt>
          <dd>{formatDateRange(conversation.dateRange.start, conversation.dateRange.end)}</dd>
        </div>
        <div>
          <dt>Messages</dt>
          <dd>{conversation.messages.length}</dd>
        </div>
        <div>
          <dt>Media attachments</dt>
          <dd>
            {mediaStats.foundAttachments} found, {mediaStats.missingAttachments} missing
          </dd>
        </div>
        <div>
          <dt>Parse warnings</dt>
          <dd>{conversation.warnings.length}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{formatDateTime(generatedAt)}</dd>
        </div>
        <div>
          <dt>Timezone used</dt>
          <dd>{timezone}</dd>
        </div>
      </dl>

      <section className="cover-files">
        <h2>Export Files Used</h2>
        <ul>
          {sourceHashes.map((file) => (
            <li key={file.id}>
              <span>{file.path}</span>
              <code>{file.hash ?? file.status}</code>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function ParseWarnings({ warnings }: { warnings: string[] }) {
  const visibleWarnings = warnings.slice(0, 100);
  const hiddenCount = warnings.length - visibleWarnings.length;

  return (
    <section className="packet-section parse-warnings-section">
      <div className="section-heading">
        <h2>Parse Warnings</h2>
        <p>{warnings.length} warning{warnings.length === 1 ? "" : "s"} found while reading the selected JSON files.</p>
      </div>
      <ul className="parse-warning-list">
        {visibleWarnings.map((warning, index) => (
          <li key={`${warning}:${index}`}>{warning}</li>
        ))}
      </ul>
      {hiddenCount > 0 ? <p className="warning-text">{hiddenCount} additional warning{hiddenCount === 1 ? "" : "s"} not shown.</p> : null}
    </section>
  );
}

function MessageItem({
  message,
  resolutionMap,
  mediaUrls,
  toggles,
}: {
  message: NormalizedMessage;
  resolutionMap: Map<string, MediaResolution>;
  mediaUrls: Map<string, string>;
  toggles: DisplayToggles;
}) {
  const repairApplied = toggles.repairMojibake && message.contentRepair?.changed;
  const displayContent = repairApplied ? message.contentRepair?.repaired : message.content;

  return (
    <article className="message-item">
      <header className="message-meta">
        {toggles.showSenders ? <strong>{message.senderName}</strong> : null}
        {toggles.showTimestamps ? <time dateTime={message.timestampMs ? new Date(message.timestampMs).toISOString() : undefined}>{formatTimestamp(message.timestampMs)}</time> : null}
        <span>{message.sourceFile}</span>
      </header>

      <div className="message-bubble">
        {displayContent ? (
          <p className="message-text">{displayContent}</p>
        ) : (
          <p className="system-text">{systemSummary(message)}</p>
        )}

        {repairApplied ? <p className="repair-note">Mojibake repair applied for display. Original text remains in the JSON hash record.</p> : null}

        {message.share ? (
          <div className="share-block">
            <strong>Shared content</strong>
            {message.share.shareText ? <p>{message.share.shareText}</p> : null}
            {message.share.owner ? <p>Owner: {message.share.owner}</p> : null}
            {message.share.link ? <code>{message.share.link}</code> : null}
          </div>
        ) : null}

        {message.callDuration !== undefined ? <p className="system-text">Call duration: {formatDuration(message.callDuration)}</p> : null}

        {message.attachments.length > 0 ? (
          <div className="attachments">
            {message.attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                resolution={resolutionMap.get(attachment.id)}
                mediaUrls={mediaUrls}
                showPreview={toggles.showMediaPreviews}
              />
            ))}
          </div>
        ) : null}

        {toggles.showReactions && message.reactions.length > 0 ? (
          <ul className="reaction-list" aria-label="Reactions">
            {message.reactions.map((reaction, index) => (
              <li key={`${reaction.actor}:${reaction.reaction}:${index}`}>
                <span>{reaction.reaction}</span>
                <span>{reaction.actor}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function AttachmentPreview({
  resolution,
  mediaUrls,
  showPreview,
}: {
  resolution?: MediaResolution;
  mediaUrls: Map<string, string>;
  showPreview: boolean;
}) {
  if (!resolution) {
    return null;
  }

  const attachment = resolution.attachment;
  const file = resolution.primaryFile;
  const url = file ? mediaUrls.get(file.id) : undefined;

  if (resolution.status === "missing" || !file || !url) {
    return (
      <div className="attachment missing-media">
        <strong>{attachment.kind}</strong>
        <p>Missing media file</p>
        <code>{attachment.uri ?? "No uri field"}</code>
      </div>
    );
  }

  return (
    <div className={`attachment ${resolution.status === "ambiguous" ? "ambiguous-media" : ""}`}>
      <div className="attachment-header">
        <strong>{attachment.kind}</strong>
        <span>{file.relativePath}</span>
      </div>
      {showPreview ? <MediaElement kind={attachment.kind} url={url} filename={file.name} type={file.type} /> : null}
      <code>{attachment.uri ?? file.relativePath}</code>
      {resolution.status === "ambiguous" ? <p className="warning-text">{resolution.note}</p> : null}
    </div>
  );
}

function MediaElement({ kind, url, filename, type }: { kind: string; url: string; filename: string; type: string }) {
  if (kind === "photo" || kind === "gif" || type.startsWith("image/")) {
    return <img src={url} alt={filename} loading="lazy" />;
  }

  if (kind === "video" || type.startsWith("video/")) {
    return <video src={url} controls preload="metadata" />;
  }

  if (kind === "audio" || type.startsWith("audio/")) {
    return <audio src={url} controls preload="metadata" />;
  }

  return <p className="file-chip">{filename}</p>;
}

function IntegritySection({
  conversation,
  sourceHashes,
  mediaHashes,
  mediaResolutions,
  mediaStats,
  generatedAt,
  timezone,
}: {
  conversation: MergedConversation;
  sourceHashes: HashRecord[];
  mediaHashes: HashRecord[];
  mediaResolutions: Map<string, MediaResolution>;
  mediaStats: MediaStats;
  generatedAt: Date;
  timezone: string;
}) {
  const missing = Array.from(mediaResolutions.values()).filter((resolution) => resolution.status === "missing");
  const ambiguous = Array.from(mediaResolutions.values()).filter((resolution) => resolution.status === "ambiguous");

  return (
    <section className="packet-section integrity-section">
      <div className="section-heading">
        <h2>Evidence Integrity</h2>
        <p>
          Generated {formatDateTime(generatedAt)} using timezone {timezone}. Original files should remain preserved separately from this rendered
          copy.
        </p>
      </div>

      <dl className="integrity-summary">
        <div>
          <dt>Conversation</dt>
          <dd>{conversation.title}</dd>
        </div>
        <div>
          <dt>Referenced media files hashed</dt>
          <dd>{mediaStats.referencedFiles}</dd>
        </div>
        <div>
          <dt>Missing media references</dt>
          <dd>{mediaStats.missingAttachments}</dd>
        </div>
      </dl>

      <HashTable title="Selected JSON File Hashes" hashes={sourceHashes} />
      <HashTable title="Referenced Media File Hashes" hashes={mediaHashes} />

      <h3>Missing Media</h3>
      {missing.length === 0 ? (
        <p>No missing media references detected.</p>
      ) : (
        <table className="integrity-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Source</th>
              <th>Original uri</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((resolution) => (
              <tr key={resolution.attachment.id}>
                <td>{resolution.attachment.kind}</td>
                <td>
                  {resolution.attachment.sourceFile} #{resolution.attachment.sourceIndex + 1}
                </td>
                <td>
                  <code>{resolution.attachment.uri ?? "No uri field"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ambiguous.length > 0 ? (
        <>
          <h3>Ambiguous Media Matches</h3>
          <table className="integrity-table">
            <thead>
              <tr>
                <th>Original uri</th>
                <th>Matched selected files</th>
              </tr>
            </thead>
            <tbody>
              {ambiguous.map((resolution) => (
                <tr key={resolution.attachment.id}>
                  <td>
                    <code>{resolution.attachment.uri ?? "No uri field"}</code>
                  </td>
                  <td>{resolution.candidates.map((candidate) => candidate.relativePath).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

function HashTable({ title, hashes }: { title: string; hashes: HashRecord[] }) {
  return (
    <>
      <h3>{title}</h3>
      {hashes.length === 0 ? (
        <p>No files in this category.</p>
      ) : (
        <table className="integrity-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {hashes.map((hash) => (
              <tr key={hash.id}>
                <td>{hash.path}</td>
                <td>{formatBytes(hash.size)}</td>
                <td>
                  <code>{hash.hash ?? hash.status}</code>
                  {hash.error ? <p className="warning-text">{hash.error}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function systemSummary(message: NormalizedMessage): string {
  if (message.isUnsent) {
    return "Unsent message";
  }

  if (message.type) {
    return `System or call message: ${message.type}`;
  }

  if (message.attachments.length > 0) {
    return "Media attachment";
  }

  return "No text content";
}

function formatTimestamp(timestamp: number | null): string {
  return timestamp === null ? "No timestamp" : formatDateTime(new Date(timestamp));
}

function formatDateRange(start: number | null, end: number | null): string {
  if (start === null || end === null) {
    return "No timestamp range";
  }

  return `${formatDateTime(new Date(start))} to ${formatDateTime(new Date(end))}`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return `${seconds}`;
  }

  const wholeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
