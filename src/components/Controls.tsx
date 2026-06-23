import {
  AlertTriangle,
  Download,
  Eye,
  Hash,
  Printer,
  Search,
  Upload,
} from "lucide-react";
import { MappingWizard } from "./MappingWizard";
import type { MessageFilters } from "../lib/conversation";
import type { JsonMappingProfile, MappableJsonFile } from "../lib/customMapping";
import type { LocalFileRef } from "../lib/fileRefs";
import type { HashRecord } from "../lib/hash";
import type { MediaStats } from "../lib/media";
import type { MergedConversation, ParseIssue } from "../types/messenger";

export interface DisplayToggles {
  showTimestamps: boolean;
  showSenders: boolean;
  showReactions: boolean;
  showMediaPreviews: boolean;
  repairMojibake: boolean;
}

interface ControlsProps {
  jsonRefs: LocalFileRef[];
  mediaRefs: LocalFileRef[];
  conversation: MergedConversation | null;
  parseIssues: ParseIssue[];
  senders: string[];
  filters: MessageFilters;
  toggles: DisplayToggles;
  mediaStats: MediaStats;
  sourceHashes: HashRecord[];
  mediaHashes: HashRecord[];
  mappableJsonFiles: MappableJsonFile[];
  mapping: JsonMappingProfile;
  isParsing: boolean;
  onJsonFiles: (files: FileList | null) => void;
  onMediaFiles: (files: FileList | null) => void;
  onMappingChange: (mapping: JsonMappingProfile) => void;
  onExportMappingProfile: () => void;
  onImportMappingProfile: (files: FileList | null) => void;
  onFilters: (filters: MessageFilters) => void;
  onToggles: (toggles: DisplayToggles) => void;
  onPrint: () => void;
}

export function Controls({
  jsonRefs,
  mediaRefs,
  conversation,
  parseIssues,
  senders,
  filters,
  toggles,
  mediaStats,
  sourceHashes,
  mediaHashes,
  mappableJsonFiles,
  mapping,
  isParsing,
  onJsonFiles,
  onMediaFiles,
  onMappingChange,
  onExportMappingProfile,
  onImportMappingProfile,
  onFilters,
  onToggles,
  onPrint,
}: ControlsProps) {
  const hashesPending = [...sourceHashes, ...mediaHashes].some((hash) => hash.status === "pending");
  const printDisabled = !conversation || isParsing || hashesPending;
  const hugeConversation = (conversation?.messages.length ?? 0) > 10000;
  const hugeMediaSet = mediaRefs.length > 5000;

  return (
    <aside className="app-sidebar no-print" aria-label="Evidence viewer controls">
      <section className="panel">
        <div className="panel-title">
          <Upload size={18} aria-hidden="true" />
          <h2>Load Files</h2>
        </div>

        <label className="file-picker">
          <span>Messenger JSON files</span>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(event) => onJsonFiles(event.currentTarget.files)}
          />
        </label>
        <p className="hint">
          {jsonRefs.length} JSON file{jsonRefs.length === 1 ? "" : "s"} selected. Classic and end-to-end encrypted exports are supported.
        </p>

        <label className="file-picker">
          <span>Matching media folder</span>
          <input
            type="file"
            multiple
            ref={setFolderPickerAttributes}
            onChange={(event) => onMediaFiles(event.currentTarget.files)}
          />
        </label>
        <p className="hint">{mediaRefs.length} media file{mediaRefs.length === 1 ? "" : "s"} selected.</p>

      </section>

      <MappingWizard
        files={mappableJsonFiles}
        mapping={mapping}
        onMappingChange={onMappingChange}
        onExportProfile={onExportMappingProfile}
        onImportProfile={onImportMappingProfile}
      />

      <section className="panel">
        <div className="panel-title">
          <Search size={18} aria-hidden="true" />
          <h2>Search And Filter</h2>
        </div>

        <label className="field">
          <span>Sender</span>
          <select value={filters.sender} onChange={(event) => onFilters({ ...filters, sender: event.target.value })}>
            <option value="">All senders</option>
            {senders.map((sender) => (
              <option key={sender} value={sender}>
                {sender}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Keyword</span>
          <input
            type="search"
            value={filters.keyword}
            placeholder="Text, uri, sender, reaction"
            onChange={(event) => onFilters({ ...filters, keyword: event.target.value })}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>From</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => onFilters({ ...filters, dateFrom: event.target.value })} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={filters.dateTo} onChange={(event) => onFilters({ ...filters, dateTo: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <Eye size={18} aria-hidden="true" />
          <h2>Display</h2>
        </div>

        <Toggle
          label="Show timestamps"
          checked={toggles.showTimestamps}
          onChange={(checked) => onToggles({ ...toggles, showTimestamps: checked })}
        />
        <Toggle label="Show sender names" checked={toggles.showSenders} onChange={(checked) => onToggles({ ...toggles, showSenders: checked })} />
        <Toggle label="Show reactions" checked={toggles.showReactions} onChange={(checked) => onToggles({ ...toggles, showReactions: checked })} />
        <Toggle
          label="Show media previews"
          checked={toggles.showMediaPreviews}
          onChange={(checked) => onToggles({ ...toggles, showMediaPreviews: checked })}
        />
        <Toggle
          label="Repair likely mojibake for display"
          checked={toggles.repairMojibake}
          onChange={(checked) => onToggles({ ...toggles, repairMojibake: checked })}
        />
        <p className="hint">Repair changes display text only. Original JSON bytes are hashed and message values are not mutated.</p>
      </section>

      <section className="panel">
        <div className="panel-title">
          <Hash size={18} aria-hidden="true" />
          <h2>Packet Summary</h2>
        </div>
        <dl className="summary-list">
          <div>
            <dt>Messages</dt>
            <dd>{conversation?.messages.length ?? 0}</dd>
          </div>
          <div>
            <dt>Media found</dt>
            <dd>{mediaStats.foundAttachments}</dd>
          </div>
          <div>
            <dt>Media missing</dt>
            <dd>{mediaStats.missingAttachments}</dd>
          </div>
          <div>
            <dt>Files hashed</dt>
            <dd>{sourceHashes.filter((hash) => hash.status === "hashed").length + mediaHashes.filter((hash) => hash.status === "hashed").length}</dd>
          </div>
        </dl>
        {isParsing ? <AlertTone message="Parsing selected JSON files." /> : null}
        {hashesPending ? <AlertTone message="Hashing selected referenced files." /> : null}
        {mediaStats.missingAttachments > 0 ? <AlertTone message="Some referenced media files are missing from the selected folder." severity="warning" /> : null}
        {mediaStats.ambiguousAttachments > 0 ? <AlertTone message="Some media uri values matched more than one selected file." severity="warning" /> : null}
        {hugeConversation ? <AlertTone message="Huge conversation loaded. Search, preview, and print may take time." severity="warning" /> : null}
        {hugeMediaSet ? <AlertTone message="Large media folder selected. Initial matching and hashing may take time." severity="warning" /> : null}
        {parseIssues.map((issue) => (
          <AlertTone key={`${issue.sourceFile}:${issue.message}`} message={`${issue.sourceFile}: ${issue.message}`} severity="error" />
        ))}
      </section>

      <section className="panel">
        <div className="panel-title">
          <Download size={18} aria-hidden="true" />
          <h2>Export</h2>
        </div>
        <button type="button" className="primary-button" onClick={onPrint} disabled={printDisabled}>
          <Printer size={16} aria-hidden="true" />
          Print or save PDF
        </button>
      </section>
    </aside>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function setFolderPickerAttributes(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  input.setAttribute("webkitdirectory", "");
  input.setAttribute("directory", "");
}

function AlertTone({ message, severity = "info" }: { message: string; severity?: "info" | "warning" | "error" }) {
  return (
    <div className={`alert ${severity}`}>
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
