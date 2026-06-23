import { repairMojibake } from "./encoding";
import {
  arrayAtPath,
  asBoolean,
  asDisplayString,
  asTimestampMs,
  collectPathOptions,
  firstRecord,
  getByPath,
  isRecord,
  type JsonPathOption,
  type JsonPathKind,
} from "./jsonPath";
import type {
  AttachmentKind,
  MessageAttachment,
  NormalizedMessage,
  NormalizedReaction,
  ParsedExport,
  RawMedia,
} from "../types/messenger";

export const ROOT_ARRAY_PATH = "$";

export interface JsonMappingProfile {
  name: string;
  titlePath: string;
  participantsPath: string;
  participantNamePath: string;
  messagesPath: string;
  senderPath: string;
  textPath: string;
  timestampPath: string;
  typePath: string;
  isUnsentPath: string;
  mediaPath: string;
  mediaUriPath: string;
  reactionsPath: string;
  reactionActorPath: string;
  reactionValuePath: string;
}

export interface MappableJsonFile {
  sourceFile: string;
  raw: unknown;
  issue: string;
}

export interface MappingPreview {
  messageCount: number;
  participantCount: number;
  mediaReferenceCount: number;
  dateStart: number | null;
  dateEnd: number | null;
  sampleMessages: Array<{
    sender: string;
    timestamp: number | null;
    hasText: boolean;
    mediaCount: number;
  }>;
  errors: string[];
}

export interface MappingOptions {
  rootArrays: JsonPathOption[];
  rootStrings: JsonPathOption[];
  messageArrays: JsonPathOption[];
  messageBooleans: JsonPathOption[];
  messageNumbers: JsonPathOption[];
  messageStrings: JsonPathOption[];
  mediaStrings: JsonPathOption[];
  participantStrings: JsonPathOption[];
  reactionStrings: JsonPathOption[];
}

const builtInSenderPaths = new Set(["sender_name", "senderName"]);
const builtInTextPaths = new Set(["content", "text"]);
const builtInTimestampPaths = new Set(["timestamp_ms", "timestamp"]);
const mappingSampleLimit = 25;

export function createEmptyMappingProfile(): JsonMappingProfile {
  return {
    name: "Custom JSON mapping",
    titlePath: "",
    participantsPath: "",
    participantNamePath: "",
    messagesPath: "",
    senderPath: "",
    textPath: "",
    timestampPath: "",
    typePath: "",
    isUnsentPath: "",
    mediaPath: "",
    mediaUriPath: "",
    reactionsPath: "",
    reactionActorPath: "",
    reactionValuePath: "",
  };
}

export function suggestMappingProfile(raw: unknown): JsonMappingProfile {
  const rootArrays = getRootArrayOptions(raw);
  const rootStrings = collectPathOptions(raw, new Set(["string"]));
  const messagesPath = preferredPath(rootArrays, ["messages", "conversation.messages", "thread.messages"]) ?? rootArrays[0]?.path ?? "";
  const messages = arrayAtPath(raw, normalizeMappingPath(messagesPath));
  const messageSamples = firstRecords(messages);
  const messageStrings = collectPathOptionsFromRecords(messageSamples, new Set(["string"]));
  const messageNumbers = collectPathOptionsFromRecords(messageSamples, new Set(["number", "string"]));
  const messageBooleans = collectPathOptionsFromRecords(messageSamples, new Set(["boolean", "string"]));
  const messageArrays = collectPathOptionsFromRecords(messageSamples, new Set(["array"]));
  const mediaPath = preferredPath(messageArrays, ["media", "attachments", "assets", "photos", "files", "videos", "audio", "audio_files"]) ?? "";
  const mediaSamples = firstNestedRecords(messageSamples, mediaPath);
  const mediaStrings = collectPathOptionsFromRecords(mediaSamples, new Set(["string"]));
  const reactionsPath = preferredPath(messageArrays, ["reactions", "reactionList", "responses"]) ?? "";
  const reactionSamples = firstNestedRecords(messageSamples, reactionsPath);
  const reactionStrings = collectPathOptionsFromRecords(reactionSamples, new Set(["string"]));

  return {
    ...createEmptyMappingProfile(),
    titlePath: preferredPath(rootStrings, ["threadName", "title", "name", "conversationName"]) ?? "",
    participantsPath: preferredPath(rootArrays, ["participants", "users", "members"]) ?? "",
    participantNamePath: "name",
    messagesPath,
    senderPath: preferredPath(messageStrings, ["senderName", "sender_name", "sender", "from", "author.name", "user.name"]) ?? "",
    textPath: preferredPath(messageStrings, ["text", "content", "body", "message", "messageText"]) ?? "",
    timestampPath: preferredPath(messageNumbers, ["timestamp", "timestamp_ms", "createdAt", "created_at", "date", "time"]) ?? "",
    typePath: preferredPath(messageStrings, ["type", "messageType", "message_type"]) ?? "",
    isUnsentPath: preferredPath(messageBooleans, ["isUnsent", "is_unsent", "unsent"]) ?? "",
    mediaPath,
    mediaUriPath: preferredPath(mediaStrings, ["uri", "path", "url", "src", "href"]) ?? "",
    reactionsPath,
    reactionActorPath: preferredPath(reactionStrings, ["actor", "by", "senderName", "sender", "name", "user.name"]) ?? "",
    reactionValuePath: preferredPath(reactionStrings, ["reaction", "emoji", "value", "content"]) ?? "",
  };
}

export function buildMappingOptions(raw: unknown, mapping: JsonMappingProfile): MappingOptions {
  const rootArrays = getRootArrayOptions(raw);
  const rootStrings = collectPathOptions(raw, new Set(["string"]));
  const messages = arrayAtPath(raw, normalizeMappingPath(mapping.messagesPath));
  const messageSamples = firstRecords(messages);
  const messageArrays = collectPathOptionsFromRecords(messageSamples, new Set(["array"]));
  const messageBooleans = collectPathOptionsFromRecords(messageSamples, new Set(["boolean", "string"]));
  const messageNumbers = collectPathOptionsFromRecords(messageSamples, new Set(["number", "string"]));
  const messageStrings = collectPathOptionsFromRecords(messageSamples, new Set(["string", "number", "boolean"]));
  const mediaSamples = firstNestedRecords(messageSamples, mapping.mediaPath);
  const participantSample = firstRecord(arrayAtPath(raw, mapping.participantsPath)) ?? {};
  const reactionSamples = firstNestedRecords(messageSamples, mapping.reactionsPath);

  return {
    rootArrays,
    rootStrings,
    messageArrays,
    messageBooleans,
    messageNumbers,
    messageStrings,
    mediaStrings: collectPathOptionsFromRecords(mediaSamples, new Set(["string", "number"])),
    participantStrings: collectPathOptions(participantSample, new Set(["string", "number"])),
    reactionStrings: collectPathOptionsFromRecords(reactionSamples, new Set(["string", "number"])),
  };
}

export function createMappingPreview(raw: unknown, mapping: JsonMappingProfile): MappingPreview {
  const errors: string[] = [];
  const messagesPath = normalizeMappingPath(mapping.messagesPath);
  const messages = arrayAtPath(raw, messagesPath);

  if (!mapping.messagesPath) {
    errors.push("Choose the field that contains the message list.");
  } else if (!Array.isArray(getByPath(raw, messagesPath))) {
    errors.push("The selected message list field is not an array.");
  }

  if (!mapping.senderPath) {
    errors.push("Choose the sender field.");
  }

  if (!mapping.timestampPath) {
    errors.push("Choose the timestamp field.");
  }

  const dateRange = getTimestampRange(messages.map((message) => (isRecord(message) ? asTimestampMs(getByPath(message, mapping.timestampPath)) : null)));
  const mediaReferenceCount = messages.reduce<number>((total, message) => {
    if (!isRecord(message) || !mapping.mediaPath) {
      return total;
    }

    return total + arrayAtPath(message, mapping.mediaPath).length;
  }, 0);
  const participants = extractParticipants(raw, mapping);

  return {
    messageCount: messages.length,
    participantCount: participants.length,
    mediaReferenceCount,
    dateStart: dateRange.start,
    dateEnd: dateRange.end,
    sampleMessages: messages.slice(0, 3).map((message) => {
      if (!isRecord(message)) {
        return {
          sender: "Unknown sender",
          timestamp: null,
          hasText: false,
          mediaCount: 0,
        };
      }

      return {
        sender: asDisplayString(getByPath(message, mapping.senderPath)) ?? "Unknown sender",
        timestamp: asTimestampMs(getByPath(message, mapping.timestampPath)),
        hasText: Boolean(asDisplayString(getByPath(message, mapping.textPath))),
        mediaCount: mapping.mediaPath ? arrayAtPath(message, mapping.mediaPath).length : 0,
      };
    }),
    errors,
  };
}

export function parseWithMapping(sourceFile: string, raw: unknown, mapping: JsonMappingProfile): ParsedExport {
  const messagesPath = normalizeMappingPath(mapping.messagesPath);
  const messagesRaw = arrayAtPath(raw, messagesPath);

  if (!mapping.messagesPath || !Array.isArray(getByPath(raw, messagesPath))) {
    throw new Error("Mapping requires a message list array.");
  }

  if (!mapping.senderPath) {
    throw new Error("Mapping requires a sender field.");
  }

  if (!mapping.timestampPath) {
    throw new Error("Mapping requires a timestamp field.");
  }

  const warnings: string[] = [];
  const title = asDisplayString(getByPath(raw, mapping.titlePath)) || sourceFile;
  const participants = extractParticipants(raw, mapping);
  const messages = messagesRaw.map((message, index) => normalizeMappedMessage(message, sourceFile, index, mapping, warnings));

  if (messages.length === 0) {
    warnings.push(`${sourceFile} contains no mapped messages.`);
  }

  return {
    sourceFile,
    title,
    participants,
    messages,
    warnings,
    raw: isRecord(raw) ? raw : { value: raw },
  };
}

export function mappingProfileFromJson(value: unknown): JsonMappingProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const empty = createEmptyMappingProfile();
  const profile: JsonMappingProfile = { ...empty };

  for (const key of Object.keys(empty) as Array<keyof JsonMappingProfile>) {
    const candidate = value[key];
    profile[key] = typeof candidate === "string" ? candidate : empty[key];
  }

  return profile;
}

export function shouldPreferCustomMapping(parsed: ParsedExport, suggestedMapping: JsonMappingProfile): boolean {
  if (parsed.messages.length === 0) {
    return false;
  }

  const missingRecognizedSender = parsed.messages.every((message) => message.senderName === "Unknown sender");
  const missingRecognizedTimestamp = parsed.messages.every((message) => message.timestampMs === null);
  const missingRecognizedText = parsed.messages.every((message) => message.content === undefined);

  return (
    (missingRecognizedSender && hasAlternativePath(suggestedMapping.senderPath, builtInSenderPaths)) ||
    (missingRecognizedTimestamp && hasAlternativePath(suggestedMapping.timestampPath, builtInTimestampPaths)) ||
    (missingRecognizedText && hasAlternativePath(suggestedMapping.textPath, builtInTextPaths))
  );
}

function normalizeMappedMessage(
  rawMessage: unknown,
  sourceFile: string,
  sourceIndex: number,
  mapping: JsonMappingProfile,
  warnings: string[],
): NormalizedMessage {
  const messageRecord = isRecord(rawMessage) ? rawMessage : { value: rawMessage };
  const timestampMs = asTimestampMs(getByPath(messageRecord, mapping.timestampPath));
  const id = `${sourceFile}:${sourceIndex}:${timestampMs ?? "no-timestamp"}`;
  const content = asDisplayString(getByPath(messageRecord, mapping.textPath));

  if (timestampMs === null) {
    warnings.push(`${sourceFile} message ${sourceIndex + 1} is missing a mapped timestamp.`);
  }

  return {
    id,
    sourceFile,
    sourceIndex,
    senderName: asDisplayString(getByPath(messageRecord, mapping.senderPath)) || "Unknown sender",
    timestampMs,
    content,
    contentRepair: content === undefined ? undefined : repairMojibake(content),
    type: asDisplayString(getByPath(messageRecord, mapping.typePath)),
    reactions: normalizeMappedReactions(messageRecord, mapping),
    attachments: normalizeMappedAttachments(messageRecord, id, sourceFile, sourceIndex, mapping),
    callDuration: undefined,
    isUnsent: asBoolean(getByPath(messageRecord, mapping.isUnsentPath)),
    users: [],
    raw: messageRecord,
  };
}

function hasAlternativePath(path: string, builtInPaths: Set<string>): boolean {
  return path.length > 0 && !builtInPaths.has(path);
}

function normalizeMappedReactions(messageRecord: Record<string, unknown>, mapping: JsonMappingProfile): NormalizedReaction[] {
  if (!mapping.reactionsPath || !mapping.reactionValuePath) {
    return [];
  }

  return arrayAtPath(messageRecord, mapping.reactionsPath).flatMap((reaction) => {
    const reactionRecord = isRecord(reaction) ? reaction : { value: reaction };
    const value = asDisplayString(getByPath(reactionRecord, mapping.reactionValuePath));

    if (!value) {
      return [];
    }

    return [
      {
        actor: asDisplayString(getByPath(reactionRecord, mapping.reactionActorPath)) || "Unknown actor",
        reaction: value,
      },
    ];
  });
}

function normalizeMappedAttachments(
  messageRecord: Record<string, unknown>,
  messageId: string,
  sourceFile: string,
  sourceIndex: number,
  mapping: JsonMappingProfile,
): MessageAttachment[] {
  if (!mapping.mediaPath || !mapping.mediaUriPath) {
    return [];
  }

  return arrayAtPath(messageRecord, mapping.mediaPath).flatMap((media, index) => {
    const mediaRecord = isRecord(media) ? media : { value: media };
    const uri = asDisplayString(getByPath(mediaRecord, mapping.mediaUriPath));

    if (!uri) {
      return [];
    }

    const raw: RawMedia = {
      ...mediaRecord,
      uri,
    };

    return [
      {
        id: `${messageId}:${index}:${uri}`,
        kind: inferAttachmentKind(uri),
        uri,
        filename: filenameFromUri(uri),
        messageId,
        sourceFile,
        sourceIndex,
        raw,
      },
    ];
  });
}

function extractParticipants(raw: unknown, mapping: JsonMappingProfile): string[] {
  if (!mapping.participantsPath) {
    return [];
  }

  const participants = arrayAtPath(raw, mapping.participantsPath);
  const names: string[] = [];
  const seen = new Set<string>();

  for (const participant of participants) {
    const name = isRecord(participant)
      ? asDisplayString(getByPath(participant, mapping.participantNamePath)) || asDisplayString(participant.name)
      : asDisplayString(participant);

    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

function firstRecords(values: unknown[], limit = mappingSampleLimit): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  for (const value of values) {
    if (isRecord(value)) {
      records.push(value);
    }

    if (records.length >= limit) {
      break;
    }
  }

  return records;
}

function firstNestedRecords(records: Record<string, unknown>[], arrayPath: string, limit = mappingSampleLimit): Record<string, unknown>[] {
  if (!arrayPath) {
    return [];
  }

  const nested: Record<string, unknown>[] = [];

  for (const record of records) {
    for (const value of arrayAtPath(record, arrayPath)) {
      if (isRecord(value)) {
        nested.push(value);
      }

      if (nested.length >= limit) {
        return nested;
      }
    }
  }

  return nested;
}

function collectPathOptionsFromRecords(records: Record<string, unknown>[], includeKinds: Set<JsonPathKind>): JsonPathOption[] {
  const byPath = new Map<string, JsonPathOption>();

  for (const record of records) {
    for (const option of collectPathOptions(record, includeKinds)) {
      if (!byPath.has(option.path)) {
        byPath.set(option.path, option);
      }
    }
  }

  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function preferredPath(options: JsonPathOption[], names: string[]): string | undefined {
  const byLowerPath = new Map(options.map((option) => [option.path.toLocaleLowerCase(), option.path]));

  for (const name of names) {
    const exact = byLowerPath.get(name.toLocaleLowerCase());

    if (exact) {
      return exact;
    }
  }

  for (const name of names) {
    const lowerName = name.toLocaleLowerCase();
    const fuzzy = options.find((option) => option.path.toLocaleLowerCase().endsWith(lowerName));

    if (fuzzy) {
      return fuzzy.path;
    }
  }

  return undefined;
}

function getRootArrayOptions(raw: unknown): JsonPathOption[] {
  const options = collectPathOptions(raw, new Set(["array"]));

  if (Array.isArray(raw)) {
    return [
      {
        path: ROOT_ARRAY_PATH,
        kind: "array",
        sample: `root array(${raw.length})`,
      },
      ...options,
    ];
  }

  return options;
}

function normalizeMappingPath(path: string): string {
  return path === ROOT_ARRAY_PATH ? "" : path;
}

function inferAttachmentKind(uri: string): AttachmentKind {
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

function getTimestampRange(timestamps: Array<number | null>): { start: number | null; end: number | null } {
  let start: number | null = null;
  let end: number | null = null;

  for (const timestamp of timestamps) {
    if (timestamp === null) {
      continue;
    }

    start = start === null ? timestamp : Math.min(start, timestamp);
    end = end === null ? timestamp : Math.max(end, timestamp);
  }

  return { start, end };
}
