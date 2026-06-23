import { describe, expect, it } from "vitest";
import { createLocalFileRef } from "./fileRefs";
import { buildMediaIndex, resolveAttachment } from "./media";
import type { MessageAttachment } from "../types/messenger";

describe("media resolution", () => {
  it("matches Messenger uri values to selected folder paths by suffix", () => {
    const file = createLocalFileRef(new File(["x"], "photo.jpg"), "Selected Folder/messages/thread/photos/photo.jpg");
    const index = buildMediaIndex([file]);
    const attachment: MessageAttachment = {
      id: "a",
      kind: "photo",
      uri: "messages/thread/photos/photo.jpg",
      filename: "photo.jpg",
      messageId: "m",
      sourceFile: "message_1.json",
      sourceIndex: 0,
      raw: { uri: "messages/thread/photos/photo.jpg" },
    };

    const resolution = resolveAttachment(attachment, index);

    expect(resolution.status).toBe("found");
    expect(resolution.primaryFile?.relativePath).toBe("Selected Folder/messages/thread/photos/photo.jpg");
  });

  it("matches percent-encoded reserved characters in media filenames", () => {
    const file = createLocalFileRef(new File(["x"], "a#b&c.jpg"), "Selected Folder/messages/thread/photos/a#b&c.jpg");
    const index = buildMediaIndex([file]);
    const attachment: MessageAttachment = {
      id: "encoded",
      kind: "photo",
      uri: "messages/thread/photos/a%23b%26c.jpg",
      filename: "a#b&c.jpg",
      messageId: "m",
      sourceFile: "message_1.json",
      sourceIndex: 0,
      raw: { uri: "messages/thread/photos/a%23b%26c.jpg" },
    };

    const resolution = resolveAttachment(attachment, index);

    expect(resolution.status).toBe("found");
    expect(resolution.primaryFile?.relativePath).toBe("Selected Folder/messages/thread/photos/a#b&c.jpg");
  });
});
