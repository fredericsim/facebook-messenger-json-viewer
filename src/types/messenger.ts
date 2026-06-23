export interface RawParticipant {
  name?: string;
  [key: string]: unknown;
}

export interface RawReaction {
  reaction?: string;
  actor?: string;
  [key: string]: unknown;
}

export interface RawMedia {
  uri?: string;
  creation_timestamp?: number;
  media_metadata?: Record<string, unknown>;
  thumbnail?: RawMedia;
  [key: string]: unknown;
}

export interface RawShare {
  link?: string;
  share_text?: string;
  original_content_owner?: string;
  [key: string]: unknown;
}

export interface MessengerRawMessage {
  sender_name?: string;
  senderName?: string;
  timestamp_ms?: number;
  timestamp?: number;
  content?: string;
  text?: string;
  type?: string;
  reactions?: RawReaction[];
  photos?: RawMedia[];
  videos?: RawMedia[];
  audio_files?: RawMedia[];
  gifs?: RawMedia[];
  files?: RawMedia[];
  media?: RawMedia[];
  sticker?: RawMedia;
  share?: RawShare;
  call_duration?: number;
  callDuration?: number;
  is_unsent?: boolean;
  isUnsent?: boolean;
  users?: RawParticipant[];
  [key: string]: unknown;
}

export interface MessengerRawExport {
  title?: string;
  threadName?: string;
  participants?: RawParticipant[];
  messages?: MessengerRawMessage[];
  [key: string]: unknown;
}

export interface TextRepairResult {
  original: string;
  repaired: string;
  changed: boolean;
  suspicionScore: number;
}

export type AttachmentKind = "photo" | "video" | "audio" | "gif" | "file" | "sticker";

export interface NormalizedReaction {
  actor: string;
  reaction: string;
}

export interface NormalizedShare {
  link?: string;
  shareText?: string;
  owner?: string;
  raw: RawShare;
}

export interface MessageAttachment {
  id: string;
  kind: AttachmentKind;
  uri?: string;
  filename?: string;
  messageId: string;
  sourceFile: string;
  sourceIndex: number;
  raw: RawMedia;
}

export interface NormalizedMessage {
  id: string;
  sourceFile: string;
  sourceIndex: number;
  senderName: string;
  timestampMs: number | null;
  content?: string;
  contentRepair?: TextRepairResult;
  type?: string;
  reactions: NormalizedReaction[];
  share?: NormalizedShare;
  attachments: MessageAttachment[];
  callDuration?: number;
  isUnsent: boolean;
  users: string[];
  raw: MessengerRawMessage;
}

export interface ParsedExport {
  sourceFile: string;
  title: string;
  participants: string[];
  messages: NormalizedMessage[];
  warnings: string[];
  raw: MessengerRawExport;
}

export interface ParseIssue {
  sourceFile: string;
  message: string;
  cause?: string;
}

export interface DateRange {
  start: number | null;
  end: number | null;
}

export interface MergedConversation {
  title: string;
  participants: string[];
  messages: NormalizedMessage[];
  sourceFiles: string[];
  dateRange: DateRange;
  warnings: string[];
}
