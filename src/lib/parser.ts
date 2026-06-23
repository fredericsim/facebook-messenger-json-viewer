import { repairMojibake } from "./encoding";
import type {
  AttachmentKind,
  MessageAttachment,
  MessengerRawExport,
  MessengerRawMessage,
  NormalizedMessage,
  NormalizedReaction,
  NormalizedShare,
  ParsedExport,
  RawMedia,
  RawShare,
} from "../types/messenger";

const attachmentFields: Array<[keyof MessengerRawMessage, AttachmentKind]> = [
  ["photos", "photo"],
  ["videos", "video"],
  ["audio_files", "audio"],
  ["gifs", "gif"],
  ["files", "file"],
];

export class MessengerParseError extends Error {
  constructor(
    message: string,
    public readonly sourceFile: string,
    public readonly causeMessage?: string,
  ) {
    super(message);
    this.name = "MessengerParseError";
  }
}

export function parseMessengerJson(sourceFile: string, text: string): ParsedExport {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new MessengerParseError("Could not parse JSON.", sourceFile, error instanceof Error ? error.message : String(error));
  }

  if (!isRecord(raw)) {
    throw new MessengerParseError("Messenger export must be a JSON object.", sourceFile);
  }

  if (!Array.isArray(raw.messages)) {
    throw new MessengerParseError("Messenger export is missing a messages array.", sourceFile);
  }

  const exportObject = raw as MessengerRawExport;
  const rawMessages = raw.messages as MessengerRawMessage[];
  const title = firstNonEmptyString(exportObject.title, exportObject.threadName) ?? "Messenger Conversation";
  const participants = normalizeParticipants(exportObject.participants);
  const warnings: string[] = [];
  const messages = rawMessages.map((message, index) => normalizeMessage(message, sourceFile, index, warnings));

  if (messages.length === 0) {
    warnings.push(`${sourceFile} contains no messages.`);
  }

  return {
    sourceFile,
    title,
    participants,
    messages,
    warnings,
    raw: exportObject,
  };
}

function normalizeMessage(raw: MessengerRawMessage, sourceFile: string, sourceIndex: number, warnings: string[]): NormalizedMessage {
  const timestampMs = normalizeMessengerTimestamp(raw.timestamp_ms, raw.timestamp);
  const id = `${sourceFile}:${sourceIndex}:${timestampMs ?? "no-timestamp"}`;
  const content = firstString(raw.content, raw.text);

  if (timestampMs === null) {
    warnings.push(`${sourceFile} message ${sourceIndex + 1} is missing a timestamp.`);
  }

  return {
    id,
    sourceFile,
    sourceIndex,
    senderName: firstNonEmptyString(raw.sender_name, raw.senderName) ?? "Unknown sender",
    timestampMs,
    content,
    contentRepair: content === undefined ? undefined : repairMojibake(content),
    type: typeof raw.type === "string" ? raw.type : undefined,
    reactions: normalizeReactions(raw.reactions),
    share: normalizeShare(raw.share),
    attachments: normalizeAttachments(raw, id, sourceFile, sourceIndex),
    callDuration: firstFiniteNumber(raw.call_duration, raw.callDuration) ?? undefined,
    isUnsent: raw.is_unsent === true || raw.isUnsent === true,
    users: normalizeParticipants(raw.users),
    raw,
  };
}

function normalizeParticipants(participants: unknown): string[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  const names: string[] = [];
  const seen = new Set<string>();

  for (const participant of participants) {
    if (typeof participant === "string" && participant) {
      if (!seen.has(participant)) {
        seen.add(participant);
        names.push(participant);
      }
      continue;
    }

    if (!isRecord(participant) || typeof participant.name !== "string" || !participant.name) {
      continue;
    }

    if (!seen.has(participant.name)) {
      seen.add(participant.name);
      names.push(participant.name);
    }
  }

  return names;
}

function normalizeReactions(reactions: unknown): NormalizedReaction[] {
  if (!Array.isArray(reactions)) {
    return [];
  }

  return reactions.flatMap((reaction) => {
    if (!isRecord(reaction)) {
      return [];
    }

    const actor = typeof reaction.actor === "string" && reaction.actor ? reaction.actor : "Unknown actor";
    const value = typeof reaction.reaction === "string" ? reaction.reaction : "";

    return value ? [{ actor, reaction: value }] : [];
  });
}

function normalizeShare(share: unknown): NormalizedShare | undefined {
  if (!isRecord(share)) {
    return undefined;
  }

  const rawShare = share as RawShare;
  const normalized: NormalizedShare = {
    raw: rawShare,
  };

  if (typeof rawShare.link === "string" && rawShare.link) {
    normalized.link = rawShare.link;
  }

  if (typeof rawShare.share_text === "string" && rawShare.share_text) {
    normalized.shareText = rawShare.share_text;
  }

  if (typeof rawShare.original_content_owner === "string" && rawShare.original_content_owner) {
    normalized.owner = rawShare.original_content_owner;
  }

  return normalized.link || normalized.shareText || normalized.owner ? normalized : undefined;
}

function normalizeAttachments(raw: MessengerRawMessage, messageId: string, sourceFile: string, sourceIndex: number): MessageAttachment[] {
  const attachments: MessageAttachment[] = [];

  for (const [field, kind] of attachmentFields) {
    const rawValue = raw[field];
    if (!Array.isArray(rawValue)) {
      continue;
    }

    rawValue.forEach((item, attachmentIndex) => {
      if (isRecord(item)) {
        attachments.push(createAttachment(kind, item as RawMedia, messageId, sourceFile, sourceIndex, attachmentIndex));
      }
    });
  }

  if (Array.isArray(raw.media)) {
    const baseAttachmentIndex = attachments.length;
    raw.media.forEach((item, attachmentIndex) => {
      if (isRecord(item)) {
        const media = item as RawMedia;
        attachments.push(createAttachment(inferAttachmentKind(media.uri), media, messageId, sourceFile, sourceIndex, baseAttachmentIndex + attachmentIndex));
      }
    });
  }

  if (isRecord(raw.sticker)) {
    attachments.push(createAttachment("sticker", raw.sticker, messageId, sourceFile, sourceIndex, attachments.length));
  }

  return attachments;
}

function createAttachment(
  kind: AttachmentKind,
  raw: RawMedia,
  messageId: string,
  sourceFile: string,
  sourceIndex: number,
  attachmentIndex: number,
): MessageAttachment {
  const uri = typeof raw.uri === "string" ? raw.uri : undefined;

  return {
    id: `${messageId}:${kind}:${attachmentIndex}:${uri ?? "no-uri"}`,
    kind,
    uri,
    filename: uri ? filenameFromUri(uri) : undefined,
    messageId,
    sourceFile,
    sourceIndex,
    raw,
  };
}

function filenameFromUri(uri: string): string {
  const path = uri.replace(/\\/g, "/");
  const last = path.split("/").filter(Boolean).pop();

  if (!last) {
    return uri;
  }

  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function inferAttachmentKind(uri: unknown): AttachmentKind {
  if (typeof uri !== "string") {
    return "file";
  }

  const path = uri.split("?")[0].split("#")[0].toLocaleLowerCase();

  if (/\.(jpe?g|png|webp|bmp|heic|heif|tiff?)$/.test(path)) {
    return "photo";
  }

  if (/\.gif$/.test(path)) {
    return "gif";
  }

  if (/\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/.test(path)) {
    return "video";
  }

  if (/\.(mp3|m4a|aac|wav|ogg|opus|amr)$/.test(path)) {
    return "audio";
  }

  return "file";
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string");
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function firstFiniteNumber(...values: unknown[]): number | null {
  const value = values.find((candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate));
  return value ?? null;
}

function normalizeMessengerTimestamp(timestampMs: unknown, timestamp: unknown): number | null {
  if (typeof timestampMs === "number" && Number.isFinite(timestampMs)) {
    return timestampMs;
  }

  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp > 0 && timestamp < 10_000_000_000 ? Math.round(timestamp * 1000) : timestamp;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
