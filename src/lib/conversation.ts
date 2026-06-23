import type { DateRange, MergedConversation, NormalizedMessage, ParsedExport } from "../types/messenger";

export interface MessageFilters {
  sender: string;
  keyword: string;
  dateFrom: string;
  dateTo: string;
}

export function mergeParsedExports(exports: ParsedExport[]): MergedConversation | null {
  if (exports.length === 0) {
    return null;
  }

  const messages = exports.flatMap((exportFile) => exportFile.messages).slice().sort(compareMessagesChronologically);
  const title = chooseTitle(exports);
  const participants = unique(exports.flatMap((exportFile) => exportFile.participants));

  return {
    title,
    participants,
    messages,
    sourceFiles: exports.map((exportFile) => exportFile.sourceFile),
    dateRange: getDateRange(messages),
    warnings: exports.flatMap((exportFile) => exportFile.warnings),
  };
}

export function compareMessagesChronologically(left: NormalizedMessage, right: NormalizedMessage): number {
  const leftTime = left.timestampMs ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.timestampMs ?? Number.MAX_SAFE_INTEGER;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.sourceFile !== right.sourceFile) {
    return left.sourceFile.localeCompare(right.sourceFile);
  }

  return left.sourceIndex - right.sourceIndex;
}

export function getDateRange(messages: NormalizedMessage[]): DateRange {
  let start: number | null = null;
  let end: number | null = null;

  for (const message of messages) {
    if (message.timestampMs === null) {
      continue;
    }

    start = start === null ? message.timestampMs : Math.min(start, message.timestampMs);
    end = end === null ? message.timestampMs : Math.max(end, message.timestampMs);
  }

  if (start === null || end === null) {
    return { start: null, end: null };
  }

  return {
    start,
    end,
  };
}

export function filterMessages(messages: NormalizedMessage[], filters: MessageFilters): NormalizedMessage[] {
  const keyword = filters.keyword.trim().toLocaleLowerCase();
  const from = filters.dateFrom ? startOfLocalDay(filters.dateFrom) : null;
  const to = filters.dateTo ? endOfLocalDay(filters.dateTo) : null;

  return messages.filter((message) => {
    if (filters.sender && message.senderName !== filters.sender) {
      return false;
    }

    if (from !== null && (message.timestampMs === null || message.timestampMs < from)) {
      return false;
    }

    if (to !== null && (message.timestampMs === null || message.timestampMs > to)) {
      return false;
    }

    if (keyword && !messageSearchText(message).toLocaleLowerCase().includes(keyword)) {
      return false;
    }

    return true;
  });
}

export function getSenders(messages: NormalizedMessage[]): string[] {
  return unique(messages.map((message) => message.senderName)).sort((left, right) => left.localeCompare(right));
}

function chooseTitle(exports: ParsedExport[]): string {
  const titles = exports.map((exportFile) => exportFile.title).filter(Boolean);
  const nonDefault = titles.find((title) => title !== "Messenger Conversation");
  return nonDefault ?? titles[0] ?? "Messenger Conversation";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function messageSearchText(message: NormalizedMessage): string {
  return [
    message.senderName,
    message.content,
    message.type,
    message.share?.link,
    message.share?.shareText,
    message.share?.owner,
    ...message.attachments.map((attachment) => attachment.uri ?? ""),
    ...message.reactions.map((reaction) => `${reaction.actor} ${reaction.reaction}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function startOfLocalDay(value: string): number {
  const date = new Date(`${value}T00:00:00`);
  return date.getTime();
}

function endOfLocalDay(value: string): number {
  const date = new Date(`${value}T23:59:59.999`);
  return date.getTime();
}
