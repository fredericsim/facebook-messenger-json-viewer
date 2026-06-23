import { Download, SlidersHorizontal, Upload } from "lucide-react";
import {
  buildMappingOptions,
  createMappingPreview,
  ROOT_ARRAY_PATH,
  type JsonMappingProfile,
  type MappableJsonFile,
} from "../lib/customMapping";
import type { JsonPathOption } from "../lib/jsonPath";

interface MappingWizardProps {
  files: MappableJsonFile[];
  mapping: JsonMappingProfile;
  onMappingChange: (mapping: JsonMappingProfile) => void;
  onExportProfile: () => void;
  onImportProfile: (files: FileList | null) => void;
}

export function MappingWizard({ files, mapping, onMappingChange, onExportProfile, onImportProfile }: MappingWizardProps) {
  if (files.length === 0) {
    return null;
  }

  const firstFile = files[0];
  const options = buildMappingOptions(firstFile.raw, mapping);
  const preview = createMappingPreview(firstFile.raw, mapping);

  function setField<K extends keyof JsonMappingProfile>(key: K, value: JsonMappingProfile[K]) {
    onMappingChange({
      ...mapping,
      [key]: value,
    });
  }

  return (
    <section className="panel mapping-panel">
      <div className="panel-title">
        <SlidersHorizontal size={18} aria-hidden="true" />
        <h2>Map JSON Fields</h2>
      </div>

      <p className="hint">
        {files.length} selected JSON file{files.length === 1 ? "" : "s"} need custom mapping. Pick fields from the dropdowns; no code is needed.
      </p>

      <label className="field">
        <span>Profile name</span>
        <input type="text" value={mapping.name} onChange={(event) => setField("name", event.target.value)} />
      </label>

      <FieldSelect
        label="Message list"
        value={mapping.messagesPath}
        options={options.rootArrays}
        required
        onChange={(value) => setField("messagesPath", value)}
      />
      <FieldSelect label="Conversation title" value={mapping.titlePath} options={options.rootStrings} onChange={(value) => setField("titlePath", value)} />
      <FieldSelect
        label="Participants list"
        value={mapping.participantsPath}
        options={options.rootArrays}
        onChange={(value) => setField("participantsPath", value)}
      />
      <FieldSelect
        label="Participant name"
        value={mapping.participantNamePath}
        options={options.participantStrings}
        emptyLabel="Use participant value directly"
        onChange={(value) => setField("participantNamePath", value)}
      />

      <div className="mapping-divider" />

      <FieldSelect label="Sender" value={mapping.senderPath} options={options.messageStrings} required onChange={(value) => setField("senderPath", value)} />
      <FieldSelect label="Message text" value={mapping.textPath} options={options.messageStrings} onChange={(value) => setField("textPath", value)} />
      <FieldSelect
        label="Timestamp"
        value={mapping.timestampPath}
        options={options.messageNumbers}
        required
        onChange={(value) => setField("timestampPath", value)}
      />
      <FieldSelect label="Message type" value={mapping.typePath} options={options.messageStrings} onChange={(value) => setField("typePath", value)} />
      <FieldSelect label="Unsent flag" value={mapping.isUnsentPath} options={options.messageBooleans} onChange={(value) => setField("isUnsentPath", value)} />

      <div className="mapping-divider" />

      <FieldSelect label="Media list" value={mapping.mediaPath} options={options.messageArrays} onChange={(value) => setField("mediaPath", value)} />
      <FieldSelect label="Media URI" value={mapping.mediaUriPath} options={options.mediaStrings} onChange={(value) => setField("mediaUriPath", value)} />
      <FieldSelect
        label="Reactions list"
        value={mapping.reactionsPath}
        options={options.messageArrays}
        onChange={(value) => setField("reactionsPath", value)}
      />
      <FieldSelect
        label="Reaction actor"
        value={mapping.reactionActorPath}
        options={options.reactionStrings}
        onChange={(value) => setField("reactionActorPath", value)}
      />
      <FieldSelect
        label="Reaction value"
        value={mapping.reactionValuePath}
        options={options.reactionStrings}
        onChange={(value) => setField("reactionValuePath", value)}
      />

      <div className="mapping-preview">
        <h3>Preview</h3>
        {preview.errors.length > 0 ? (
          <ul className="mapping-errors">
            {preview.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <dl className="mapping-preview-grid">
            <div>
              <dt>Messages</dt>
              <dd>{preview.messageCount}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{preview.participantCount}</dd>
            </div>
            <div>
              <dt>Media refs</dt>
              <dd>{preview.mediaReferenceCount}</dd>
            </div>
          </dl>
        )}

        {preview.sampleMessages.length > 0 ? (
          <table className="mapping-sample-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Timestamp</th>
                <th>Text</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              {preview.sampleMessages.map((message, index) => (
                <tr key={`${message.sender}:${message.timestamp}:${index}`}>
                  <td>{message.sender}</td>
                  <td>{message.timestamp === null ? "Missing" : new Date(message.timestamp).toLocaleString()}</td>
                  <td>{message.hasText ? "Yes" : "No"}</td>
                  <td>{message.mediaCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="mapping-actions">
        <button type="button" className="secondary-button" onClick={onExportProfile}>
          <Download size={16} aria-hidden="true" />
          Export mapping profile
        </button>
        <label className="secondary-button import-profile-button">
          <Upload size={16} aria-hidden="true" />
          Import mapping profile
          <input type="file" accept=".json,application/json" onChange={(event) => onImportProfile(event.currentTarget.files)} />
        </label>
      </div>
    </section>
  );
}

function FieldSelect({
  label,
  value,
  options,
  emptyLabel = "Not mapped",
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  options: JsonPathOption[];
  emptyLabel?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const hasCurrent = !value || options.some((option) => option.path === value);

  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {!hasCurrent ? <option value={value}>{value} (current)</option> : null}
        {options.map((option) => (
          <option key={`${label}:${option.path}`} value={option.path}>
            {formatOptionPath(option.path)} - {option.sample}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatOptionPath(path: string): string {
  return path === ROOT_ARRAY_PATH ? "Root array" : path;
}
