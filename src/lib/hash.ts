import type { LocalFileRef } from "./fileRefs";

export type HashStatus = "pending" | "hashed" | "error";

export interface HashRecord {
  id: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  hash: string | null;
  status: HashStatus;
  error?: string;
}

export function pendingHashRecord(file: LocalFileRef): HashRecord {
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

export async function hashLocalFile(file: LocalFileRef): Promise<HashRecord> {
  try {
    return {
      ...pendingHashRecord(file),
      hash: await sha256Blob(file.file),
      status: "hashed",
    };
  } catch (error) {
    return {
      ...pendingHashRecord(file),
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Blob(new Blob([text], { type: "text/plain" }));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
