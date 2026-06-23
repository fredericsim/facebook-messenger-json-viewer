import type { TextRepairResult } from "../types/messenger";

const unicodeToWindows1252Byte = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const suspiciousPattern = /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]?|â[\u0080-\uffff]{1,3}|ðŸ[\u0080-\uffff]{1,4}|[ÐÑ][\u0080-\u00bf])/g;

export function scoreMojibake(input: string): number {
  const matches = input.match(suspiciousPattern);
  const replacementCharacters = input.match(/\ufffd/g);
  return (matches?.length ?? 0) + (replacementCharacters?.length ?? 0) * 2;
}

export function repairMojibake(input: string): TextRepairResult {
  const suspicionScore = scoreMojibake(input);

  if (suspicionScore === 0) {
    return {
      original: input,
      repaired: input,
      changed: false,
      suspicionScore,
    };
  }

  const repairedWhole = decodeWindows1252AsUtf8(input);
  const candidate = repairedWhole ?? input.replace(suspiciousPattern, (fragment) => decodeWindows1252AsUtf8(fragment) ?? fragment);
  const candidateScore = scoreMojibake(candidate);
  const changed = candidate !== input && candidateScore < suspicionScore && !candidate.includes("\ufffd");

  return {
    original: input,
    repaired: changed ? candidate : input,
    changed,
    suspicionScore,
  };
}

function decodeWindows1252AsUtf8(input: string): string | null {
  const bytes = encodeAsWindows1252Bytes(input);

  if (!bytes) {
    return null;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function encodeAsWindows1252Bytes(input: string): Uint8Array | null {
  const bytes: number[] = [];

  for (const character of input) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      continue;
    }

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mappedByte = unicodeToWindows1252Byte.get(codePoint);
    if (mappedByte !== undefined) {
      bytes.push(mappedByte);
      continue;
    }

    return null;
  }

  return new Uint8Array(bytes);
}
