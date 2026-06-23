import { describe, expect, it } from "vitest";
import { mergeParsedExports } from "./conversation";
import { parseMessengerJson } from "./parser";

describe("parseMessengerJson", () => {
  it("normalizes messages, attachments, reactions, and mojibake metadata without mutating content", () => {
    const parsed = parseMessengerJson(
      "message_1.json",
      JSON.stringify({
        title: "Test Thread",
        participants: [{ name: "A" }, { name: "B" }],
        messages: [
          {
            sender_name: "A",
            timestamp_ms: 2000,
            content: "I\u00e2\u20ac\u2122ll send it.",
            photos: [{ uri: "messages/thread/photos/a.jpg" }],
            reactions: [{ reaction: "ok", actor: "B" }],
            type: "Generic",
          },
        ],
      }),
    );

    expect(parsed.title).toBe("Test Thread");
    expect(parsed.participants).toEqual(["A", "B"]);
    expect(parsed.messages[0].content).toBe("I\u00e2\u20ac\u2122ll send it.");
    expect(parsed.messages[0].contentRepair?.changed).toBe(true);
    expect(parsed.messages[0].contentRepair?.repaired).toBe("I\u2019ll send it.");
    expect(parsed.messages[0].attachments[0].kind).toBe("photo");
    expect(parsed.messages[0].reactions[0]).toEqual({ actor: "B", reaction: "ok" });
  });

  it("supports threadName and camelCase message exports with generic media", () => {
    const parsed = parseMessengerJson(
      "conversation_85.json",
      JSON.stringify({
        threadName: "Real Export Shape",
        participants: ["Sender One", "Sender Two"],
        messages: [
          {
            senderName: "Sender One",
            timestamp: 1722685761609,
            text: "Exact message text",
            media: [{ uri: "./media/photo.jpg" }, { uri: "./media/clip.mp4" }, { uri: "./media/audio.m4a" }],
            reactions: [{ reaction: "👍", actor: "Sender Two" }],
            isUnsent: false,
            type: "media",
          },
        ],
      }),
    );

    expect(parsed.title).toBe("Real Export Shape");
    expect(parsed.participants).toEqual(["Sender One", "Sender Two"]);
    expect(parsed.messages[0].senderName).toBe("Sender One");
    expect(parsed.messages[0].timestampMs).toBe(1722685761609);
    expect(parsed.messages[0].content).toBe("Exact message text");
    expect(parsed.messages[0].attachments.map((attachment) => attachment.kind)).toEqual(["photo", "video", "audio"]);
    expect(parsed.messages[0].attachments.map((attachment) => attachment.uri)).toEqual([
      "./media/photo.jpg",
      "./media/clip.mp4",
      "./media/audio.m4a",
    ]);
  });

  it("converts E2EE timestamp seconds to milliseconds", () => {
    const parsed = parseMessengerJson(
      "conversation.json",
      JSON.stringify({
        threadName: "Thread",
        messages: [
          {
            senderName: "A",
            timestamp: 1722685761,
            text: "seconds timestamp",
          },
        ],
      }),
    );

    expect(parsed.messages[0].timestampMs).toBe(1722685761000);
  });

  it("keeps timestamp_ms values as milliseconds", () => {
    const parsed = parseMessengerJson(
      "message_1.json",
      JSON.stringify({
        title: "Thread",
        messages: [
          {
            sender_name: "A",
            timestamp_ms: 1722685761000,
            content: "millisecond timestamp",
          },
        ],
      }),
    );

    expect(parsed.messages[0].timestampMs).toBe(1722685761000);
  });
});

describe("mergeParsedExports", () => {
  it("merges and sorts selected files chronologically", () => {
    const first = parseMessengerJson(
      "message_2.json",
      JSON.stringify({
        title: "Thread",
        messages: [{ sender_name: "B", timestamp_ms: 3000, content: "third" }],
      }),
    );
    const second = parseMessengerJson(
      "message_1.json",
      JSON.stringify({
        title: "Thread",
        messages: [{ sender_name: "A", timestamp_ms: 1000, content: "first" }],
      }),
    );

    const merged = mergeParsedExports([first, second]);

    expect(merged?.messages.map((message) => message.content)).toEqual(["first", "third"]);
    expect(merged?.dateRange).toEqual({ start: 1000, end: 3000 });
  });

  it("preserves parser warnings in the merged conversation", () => {
    const parsed = parseMessengerJson(
      "message_1.json",
      JSON.stringify({
        title: "Thread",
        messages: [{ sender_name: "A", content: "missing timestamp" }],
      }),
    );

    const merged = mergeParsedExports([parsed]);

    expect(merged?.warnings).toEqual(["message_1.json message 1 is missing a timestamp."]);
  });

  it("calculates date ranges for large conversations without spreading timestamps", () => {
    const parsed = parseMessengerJson(
      "large.json",
      JSON.stringify({
        title: "Large Thread",
        messages: Array.from({ length: 150000 }, (_, index) => ({
          sender_name: "A",
          timestamp_ms: index + 1,
          content: `${index + 1}`,
        })),
      }),
    );

    const merged = mergeParsedExports([parsed]);

    expect(merged?.dateRange).toEqual({ start: 1, end: 150000 });
  });
});
