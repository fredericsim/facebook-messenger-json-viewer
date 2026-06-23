import { describe, expect, it } from "vitest";
import { sha256Text } from "./hash";

describe("sha256Text", () => {
  it("hashes text with SHA-256", async () => {
    await expect(sha256Text("abc")).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
