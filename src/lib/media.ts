import type { LocalFileRef } from "./fileRefs";
import type { MessageAttachment, NormalizedMessage } from "../types/messenger";

export interface MediaIndex {
  files: LocalFileRef[];
  bySuffix: Map<string, LocalFileRef[]>;
  byLowerSuffix: Map<string, LocalFileRef[]>;
}

export type MediaResolutionStatus = "found" | "missing" | "ambiguous";

export interface MediaResolution {
  attachment: MessageAttachment;
  status: MediaResolutionStatus;
  candidates: LocalFileRef[];
  primaryFile?: LocalFileRef;
  note?: string;
}

export interface MediaStats {
  totalAttachments: number;
  foundAttachments: number;
  missingAttachments: number;
  ambiguousAttachments: number;
  referencedFiles: number;
}

export function buildMediaIndex(files: LocalFileRef[]): MediaIndex {
  const bySuffix = new Map<string, LocalFileRef[]>();
  const byLowerSuffix = new Map<string, LocalFileRef[]>();

  for (const file of files) {
    const path = normalizeMediaPath(file.relativePath);
    const suffixes = suffixesForPath(path);

    for (const suffix of suffixes) {
      addToIndex(bySuffix, suffix, file);
      addToIndex(byLowerSuffix, suffix.toLocaleLowerCase(), file);
    }
  }

  return {
    files,
    bySuffix,
    byLowerSuffix,
  };
}

export function resolveAttachments(messages: NormalizedMessage[], index: MediaIndex): Map<string, MediaResolution> {
  const resolutions = new Map<string, MediaResolution>();

  for (const message of messages) {
    for (const attachment of message.attachments) {
      resolutions.set(attachment.id, resolveAttachment(attachment, index));
    }
  }

  return resolutions;
}

export function resolveAttachment(attachment: MessageAttachment, index: MediaIndex): MediaResolution {
  if (!attachment.uri) {
    return {
      attachment,
      status: "missing",
      candidates: [],
      note: "Attachment has no uri field.",
    };
  }

  const uri = normalizeMediaPath(attachment.uri, { stripUrlSuffix: true });
  const candidates = findCandidates(uri, index);

  if (candidates.length === 0) {
    return {
      attachment,
      status: "missing",
      candidates: [],
      note: "No selected media file matched this uri.",
    };
  }

  if (candidates.length === 1) {
    return {
      attachment,
      status: "found",
      candidates,
      primaryFile: candidates[0],
    };
  }

  const sortedCandidates = candidates.slice().sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    attachment,
    status: "ambiguous",
    candidates: sortedCandidates,
    primaryFile: sortedCandidates[0],
    note: "Multiple selected files matched this uri. The first match is previewed; all candidates are listed and hashed.",
  };
}

export function summarizeMedia(resolutions: Map<string, MediaResolution>): MediaStats {
  const referencedFiles = uniqueReferencedFiles(resolutions).length;
  let foundAttachments = 0;
  let missingAttachments = 0;
  let ambiguousAttachments = 0;

  for (const resolution of resolutions.values()) {
    if (resolution.status === "missing") {
      missingAttachments += 1;
    } else {
      foundAttachments += 1;
    }

    if (resolution.status === "ambiguous") {
      ambiguousAttachments += 1;
    }
  }

  return {
    totalAttachments: resolutions.size,
    foundAttachments,
    missingAttachments,
    ambiguousAttachments,
    referencedFiles,
  };
}

export function uniqueReferencedFiles(resolutions: Map<string, MediaResolution>): LocalFileRef[] {
  const byId = new Map<string, LocalFileRef>();

  for (const resolution of resolutions.values()) {
    for (const candidate of resolution.candidates) {
      byId.set(candidate.id, candidate);
    }
  }

  return Array.from(byId.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function normalizeMediaPath(input: string, options: { stripUrlSuffix?: boolean } = {}): string {
  const trimmed = input.trim().replace(/\\/g, "/").replace(/^file:\/\//, "");
  const withoutQuery = options.stripUrlSuffix ? trimmed.split("?")[0].split("#")[0] : trimmed;
  const withoutLeading = withoutQuery.replace(/^(\.\/)+/, "").replace(/^\/+/, "");

  return withoutLeading.split("/").map(decodePathSegment).join("/");
}

function findCandidates(uri: string, index: MediaIndex): LocalFileRef[] {
  const suffixes = suffixesForPath(uri);
  const seen = new Map<string, LocalFileRef>();

  for (const suffix of suffixes) {
    const exactMatches = index.bySuffix.get(suffix) ?? [];
    const caseInsensitiveMatches = index.byLowerSuffix.get(suffix.toLocaleLowerCase()) ?? [];

    for (const file of [...exactMatches, ...caseInsensitiveMatches]) {
      seen.set(file.id, file);
    }

    if (seen.size > 0) {
      break;
    }
  }

  return Array.from(seen.values());
}

function suffixesForPath(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const suffixes: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    suffixes.push(parts.slice(index).join("/"));
  }

  return suffixes;
}

function addToIndex(index: Map<string, LocalFileRef[]>, key: string, file: LocalFileRef): void {
  const existing = index.get(key) ?? [];
  existing.push(file);
  index.set(key, existing);
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
