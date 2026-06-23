import { describe, expect, it } from "vitest";
import {
  buildMappingOptions,
  createMappingPreview,
  parseWithMapping,
  ROOT_ARRAY_PATH,
  shouldPreferCustomMapping,
  suggestMappingProfile,
} from "./customMapping";
import { parseMessengerJson } from "./parser";

describe("custom JSON mapping", () => {
  const raw = {
    conversation: {
      name: "Custom Thread",
      members: [{ display: "A" }, { display: "B" }],
      items: [
        {
          from: "A",
          body: "hello",
          createdAt: "2026-06-23T12:00:00.000Z",
          assets: [{ path: "./media/photo.jpg" }],
          responses: [{ by: "B", emoji: "👍" }],
        },
      ],
    },
  };

  it("suggests and applies a no-code mapping profile", () => {
    const suggested = suggestMappingProfile(raw);
    const mapping = {
      ...suggested,
      titlePath: "conversation.name",
      participantsPath: "conversation.members",
      participantNamePath: "display",
      messagesPath: "conversation.items",
      senderPath: "from",
      textPath: "body",
      timestampPath: "createdAt",
      mediaPath: "assets",
      mediaUriPath: "path",
      reactionsPath: "responses",
      reactionActorPath: "by",
      reactionValuePath: "emoji",
    };

    const preview = createMappingPreview(raw, mapping);
    const parsed = parseWithMapping("custom.json", raw, mapping);

    expect(preview.errors).toEqual([]);
    expect(preview.messageCount).toBe(1);
    expect(parsed.title).toBe("Custom Thread");
    expect(parsed.participants).toEqual(["A", "B"]);
    expect(parsed.messages[0].senderName).toBe("A");
    expect(parsed.messages[0].content).toBe("hello");
    expect(parsed.messages[0].timestampMs).toBe(Date.parse("2026-06-23T12:00:00.000Z"));
    expect(parsed.messages[0].attachments[0].kind).toBe("photo");
    expect(parsed.messages[0].attachments[0].uri).toBe("./media/photo.jpg");
    expect(parsed.messages[0].reactions[0]).toEqual({ actor: "B", reaction: "👍" });
  });

  it("maps top-level array exports as the message list", () => {
    const raw = [
      {
        sender: "A",
        message: "hello",
        timestamp: 1722685761,
      },
    ];
    const suggested = suggestMappingProfile(raw);
    const mapping = {
      ...suggested,
      messagesPath: ROOT_ARRAY_PATH,
      senderPath: "sender",
      textPath: "message",
      timestampPath: "timestamp",
    };

    const preview = createMappingPreview(raw, mapping);
    const options = buildMappingOptions(raw, mapping);
    const parsed = parseWithMapping("array-export.json", raw, mapping);

    expect(suggested.messagesPath).toBe(ROOT_ARRAY_PATH);
    expect(options.messageStrings.map((option) => option.path)).toEqual(expect.arrayContaining(["sender", "message"]));
    expect(options.messageNumbers.map((option) => option.path)).toContain("timestamp");
    expect(preview.errors).toEqual([]);
    expect(preview.messageCount).toBe(1);
    expect(parsed.messages[0].senderName).toBe("A");
    expect(parsed.messages[0].content).toBe("hello");
    expect(parsed.messages[0].timestampMs).toBe(1722685761000);
  });

  it("offers mapping paths that first appear after the first message", () => {
    const raw = {
      messages: [
        {
          from: "A",
          body: "hello",
          createdAt: "2026-06-23T12:00:00.000Z",
        },
        {
          from: "B",
          body: "photo",
          createdAt: "2026-06-23T12:01:00.000Z",
          assets: [{ path: "./media/photo.jpg" }],
          responses: [{ by: "A", emoji: "👍" }],
        },
      ],
    };
    const suggested = suggestMappingProfile(raw);
    const options = buildMappingOptions(raw, suggested);

    expect(suggested.mediaPath).toBe("assets");
    expect(suggested.mediaUriPath).toBe("path");
    expect(suggested.reactionsPath).toBe("responses");
    expect(suggested.reactionActorPath).toBe("by");
    expect(suggested.reactionValuePath).toBe("emoji");
    expect(options.messageArrays.map((option) => option.path)).toEqual(expect.arrayContaining(["assets", "responses"]));
    expect(options.mediaStrings.map((option) => option.path)).toContain("path");
    expect(options.reactionStrings.map((option) => option.path)).toEqual(expect.arrayContaining(["by", "emoji"]));
  });

  it("preserves numeric and boolean mapped message text", () => {
    const raw = {
      messages: [
        { sender: "A", timestamp: 1, value: 42 },
        { sender: "B", timestamp: 2, value: false },
      ],
    };
    const mapping = {
      ...suggestMappingProfile(raw),
      messagesPath: "messages",
      senderPath: "sender",
      timestampPath: "timestamp",
      textPath: "value",
    };

    const preview = createMappingPreview(raw, mapping);
    const parsed = parseWithMapping("custom.json", raw, mapping);

    expect(preview.sampleMessages.map((message) => message.hasText)).toEqual([true, true]);
    expect(parsed.messages.map((message) => message.content)).toEqual(["42", "false"]);
  });

  it("identifies weak auto-parses that should use custom mapping", () => {
    const parsed = parseMessengerJson(
      "custom.json",
      JSON.stringify({
        messages: [
          {
            from: "A",
            body: "hello",
            createdAt: "2026-06-23T12:00:00.000Z",
          },
        ],
      }),
    );

    const suggested = suggestMappingProfile(parsed.raw);

    expect(shouldPreferCustomMapping(parsed, suggested)).toBe(true);
  });

  it("requires sender and timestamp mappings before parsing mapped rows", () => {
    const raw = {
      messages: [{ from: "A", body: "hello", createdAt: "2026-06-23T12:00:00.000Z" }],
    };
    const baseMapping = {
      ...suggestMappingProfile(raw),
      messagesPath: "messages",
      senderPath: "",
      timestampPath: "",
    };

    expect(() => parseWithMapping("custom.json", raw, baseMapping)).toThrow("Mapping requires a sender field.");
    expect(() => parseWithMapping("custom.json", raw, { ...baseMapping, senderPath: "from" })).toThrow("Mapping requires a timestamp field.");
  });
});
