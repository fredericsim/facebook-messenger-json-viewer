import { useEffect, useMemo, useState } from "react";
import { Controls, type DisplayToggles } from "./components/Controls";
import { EvidencePacket } from "./components/EvidencePacket";
import { filterMessages, getSenders, type MessageFilters, mergeParsedExports } from "./lib/conversation";
import {
  createEmptyMappingProfile,
  mappingProfileFromJson,
  parseWithMapping,
  shouldPreferCustomMapping,
  suggestMappingProfile,
  type JsonMappingProfile,
  type MappableJsonFile,
} from "./lib/customMapping";
import { dedupeFileRefs, type LocalFileRef, toLocalFileRefs } from "./lib/fileRefs";
import { hashLocalFile, type HashRecord } from "./lib/hash";
import { buildMediaIndex, resolveAttachments, summarizeMedia, uniqueReferencedFiles } from "./lib/media";
import { MessengerParseError, parseMessengerJson } from "./lib/parser";
import type { ParsedExport, ParseIssue } from "./types/messenger";
import "./styles.css";

const defaultFilters: MessageFilters = {
  sender: "",
  keyword: "",
  dateFrom: "",
  dateTo: "",
};

const defaultToggles: DisplayToggles = {
  showTimestamps: true,
  showSenders: true,
  showReactions: true,
  showMediaPreviews: true,
  repairMojibake: false,
};

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";

export default function App() {
  const [jsonRefs, setJsonRefs] = useState<LocalFileRef[]>([]);
  const [mediaRefs, setMediaRefs] = useState<LocalFileRef[]>([]);
  const [autoParsedExports, setAutoParsedExports] = useState<ParsedExport[]>([]);
  const [mappableJsonFiles, setMappableJsonFiles] = useState<MappableJsonFile[]>([]);
  const [mapping, setMapping] = useState<JsonMappingProfile>(() => createEmptyMappingProfile());
  const [parseIssues, setParseIssues] = useState<ParseIssue[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [sourceHashes, setSourceHashes] = useState<HashRecord[]>([]);
  const [mediaHashes, setMediaHashes] = useState<HashRecord[]>([]);
  const [filters, setFilters] = useState<MessageFilters>(defaultFilters);
  const [toggles, setToggles] = useState<DisplayToggles>(defaultToggles);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function parseFiles() {
      if (jsonRefs.length === 0) {
        setAutoParsedExports([]);
        setMappableJsonFiles([]);
        setMapping(createEmptyMappingProfile());
        setParseIssues([]);
        setIsParsing(false);
        return;
      }

      setIsParsing(true);
      const parsed: ParsedExport[] = [];
      const mappable: MappableJsonFile[] = [];
      const issues: ParseIssue[] = [];

      for (const fileRef of jsonRefs) {
        let text = "";

        try {
          text = await fileRef.file.text();
          const parsedExport = parseMessengerJson(fileRef.name, text);
          const suggestedMapping = suggestMappingProfile(parsedExport.raw);

          if (shouldPreferCustomMapping(parsedExport, suggestedMapping)) {
            mappable.push({
              sourceFile: fileRef.name,
              raw: parsedExport.raw,
              issue: "Auto parser could not confidently identify this file's message fields.",
            });
          } else {
            parsed.push(parsedExport);
          }
        } catch (error) {
          if (error instanceof MessengerParseError) {
            try {
              mappable.push({
                sourceFile: fileRef.name,
                raw: JSON.parse(text),
                issue: error.message,
              });
            } catch {
              issues.push({
                sourceFile: error.sourceFile,
                message: error.message,
                cause: error.causeMessage,
              });
            }
          } else {
            issues.push({
              sourceFile: fileRef.name,
              message: "Unexpected parser error.",
              cause: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (!cancelled) {
        setAutoParsedExports(parsed);
        setMappableJsonFiles(mappable);
        setMapping(mappable[0] ? suggestMappingProfile(mappable[0].raw) : createEmptyMappingProfile());
        setParseIssues(issues);
        setGeneratedAt(new Date());
        setIsParsing(false);
      }
    }

    void parseFiles();

    return () => {
      cancelled = true;
    };
  }, [jsonRefs]);

  useEffect(() => {
    let cancelled = false;

    async function hashFiles() {
      setSourceHashes(jsonRefs.map((file) => ({ ...emptyHash(file), status: "pending" })));
      const hashes = await hashFilesSequentially(jsonRefs, () => cancelled);

      if (!cancelled && hashes) {
        setSourceHashes(hashes);
      }
    }

    void hashFiles();

    return () => {
      cancelled = true;
    };
  }, [jsonRefs]);

  const mappedParseResult = useMemo(() => {
    const mapped: ParsedExport[] = [];
    const issues: ParseIssue[] = [];

    if (mappableJsonFiles.length === 0 || !mapping.messagesPath) {
      return { mapped, issues };
    }

    for (const file of mappableJsonFiles) {
      try {
        mapped.push(parseWithMapping(file.sourceFile, file.raw, mapping));
      } catch (error) {
        issues.push({
          sourceFile: file.sourceFile,
          message: "Custom mapping could not parse this file.",
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { mapped, issues };
  }, [mappableJsonFiles, mapping]);
  const parsedExports = useMemo(() => [...autoParsedExports, ...mappedParseResult.mapped], [autoParsedExports, mappedParseResult.mapped]);
  const displayedParseIssues = useMemo(() => [...parseIssues, ...mappedParseResult.issues], [parseIssues, mappedParseResult.issues]);
  const conversation = useMemo(() => mergeParsedExports(parsedExports), [parsedExports]);
  const mediaIndex = useMemo(() => buildMediaIndex(mediaRefs), [mediaRefs]);
  const mediaResolutions = useMemo(() => resolveAttachments(conversation?.messages ?? [], mediaIndex), [conversation, mediaIndex]);
  const mediaStats = useMemo(() => summarizeMedia(mediaResolutions), [mediaResolutions]);
  const referencedMediaFiles = useMemo(() => uniqueReferencedFiles(mediaResolutions), [mediaResolutions]);
  const senders = useMemo(() => getSenders(conversation?.messages ?? []), [conversation]);
  const filteredMessages = useMemo(() => filterMessages(conversation?.messages ?? [], filters), [conversation, filters]);

  useEffect(() => {
    let cancelled = false;

    async function hashMediaFiles() {
      setMediaHashes(referencedMediaFiles.map((file) => ({ ...emptyHash(file), status: "pending" })));
      const hashes = await hashFilesSequentially(referencedMediaFiles, () => cancelled);

      if (!cancelled && hashes) {
        setMediaHashes(hashes);
      }
    }

    void hashMediaFiles();

    return () => {
      cancelled = true;
    };
  }, [referencedMediaFiles]);

  useEffect(() => {
    const urls = new Map<string, string>();

    for (const fileRef of referencedMediaFiles) {
      urls.set(fileRef.id, URL.createObjectURL(fileRef.file));
    }

    setMediaUrls(urls);

    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [referencedMediaFiles]);

  function handleJsonFiles(files: FileList | null) {
    setJsonRefs(files ? dedupeFileRefs(toLocalFileRefs(files, false)) : []);
    setFilters(defaultFilters);
  }

  function handleMediaFiles(files: FileList | null) {
    setMediaRefs(files ? dedupeFileRefs(toLocalFileRefs(files, true)) : []);
    setGeneratedAt(new Date());
  }

  function printPacket() {
    setGeneratedAt(new Date());
    window.setTimeout(() => window.print(), 50);
  }

  function exportMappingProfile() {
    downloadBlob(
      `${safeFilename(mapping.name || "custom-json-mapping")}.json`,
      new Blob([JSON.stringify(mapping, null, 2)], { type: "application/json" }),
    );
  }

  async function importMappingProfile(files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    try {
      const profile = mappingProfileFromJson(JSON.parse(await file.text()));

      if (!profile) {
        throw new Error("Mapping profile JSON must be an object.");
      }

      setMapping(profile);
    } catch (error) {
      setParseIssues((current) => [
        ...current,
        {
          sourceFile: file.name,
          message: "Could not import mapping profile.",
          cause: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-topbar no-print">
        <div>
          <h1>Messenger Evidence Viewer</h1>
          <p>Private local-only JSON viewer, media resolver, PDF printer, and SHA-256 integrity view.</p>
        </div>
      </header>

      <Controls
        jsonRefs={jsonRefs}
        mediaRefs={mediaRefs}
        conversation={conversation}
        parseIssues={displayedParseIssues}
        senders={senders}
        filters={filters}
        toggles={toggles}
        mediaStats={mediaStats}
        sourceHashes={sourceHashes}
        mediaHashes={mediaHashes}
        mappableJsonFiles={mappableJsonFiles}
        mapping={mapping}
        isParsing={isParsing}
        onJsonFiles={handleJsonFiles}
        onMediaFiles={handleMediaFiles}
        onMappingChange={setMapping}
        onExportMappingProfile={exportMappingProfile}
        onImportMappingProfile={importMappingProfile}
        onFilters={setFilters}
        onToggles={setToggles}
        onPrint={printPacket}
      />

      <EvidencePacket
        conversation={conversation}
        messages={filteredMessages}
        sourceHashes={sourceHashes}
        mediaHashes={mediaHashes}
        mediaResolutions={mediaResolutions}
        mediaStats={mediaStats}
        mediaUrls={mediaUrls}
        toggles={toggles}
        generatedAt={generatedAt}
        timezone={timezone}
      />
    </div>
  );
}

function emptyHash(file: LocalFileRef): HashRecord {
  return {
    id: file.id,
    name: file.name,
    path: file.relativePath,
    size: file.size,
    lastModified: file.lastModified,
    hash: null,
    status: "pending",
  };
}

async function hashFilesSequentially(files: LocalFileRef[], isCancelled: () => boolean): Promise<HashRecord[] | null> {
  const hashes: HashRecord[] = [];

  for (const file of files) {
    if (isCancelled()) {
      return null;
    }

    hashes.push(await hashLocalFile(file));
  }

  return isCancelled() ? null : hashes;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string): string {
  const cleaned = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "custom-json-mapping";
}
