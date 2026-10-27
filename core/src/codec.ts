// Tessera — binary serialization for puzzle cells and tile cells.
// Byte layouts are defined in design.md §2.7.

import type { Puzzle, PuzzleId } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeU16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true /* little-endian */);
}

function readU16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

// ── Tile cell ─────────────────────────────────────────────────────────────────
// Layout: puzzle_id[8] | value[1]  →  9 bytes total

export const TILE_BYTE_LENGTH = 9;

/**
 * Encode a tile cell to its canonical 9-byte representation.
 *
 * @param puzzleId  8-byte puzzle identifier.
 * @param value     Digit value 1..n².
 */
export function encodeTile(puzzleId: PuzzleId, value: number): Uint8Array {
  const buf = new Uint8Array(TILE_BYTE_LENGTH);
  buf.set(puzzleId, 0);
  buf[8] = value;
  return buf;
}

export interface DecodedTile {
  puzzleId: PuzzleId;
  value: number;
}

/**
 * Decode a 9-byte tile cell.
 */
export function decodeTile(bytes: Uint8Array): DecodedTile {
  if (bytes.length !== TILE_BYTE_LENGTH) {
    throw new RangeError(
      `decodeTile: expected ${TILE_BYTE_LENGTH} bytes, got ${bytes.length}`,
    );
  }
  return {
    puzzleId: bytes.slice(0, 8),
    value: bytes[8] ?? 0,
  };
}

// ── Puzzle cell ───────────────────────────────────────────────────────────────
// Layout: puzzle_id[8] | n[1] | rowWeights[n] | colWeights[n] |
//         rowTargets[n×2 u16 LE] | colTargets[n×2 u16 LE]
// Total: 9 + 6n bytes

export function puzzleByteLength(n: number): number {
  return 9 + 6 * n;
}

/**
 * Encode a puzzle to its canonical byte representation.
 */
export function encodePuzzle(puzzle: Puzzle): Uint8Array {
  const { n, rowWeights, colWeights, rowTargets, colTargets, id } = puzzle;
  const buf = new Uint8Array(puzzleByteLength(n));
  const view = new DataView(buf.buffer);

  // puzzle_id [0..8)
  buf.set(id, 0);

  // n [8]
  buf[8] = n;

  // rowWeights [9..9+n)
  for (let i = 0; i < n; i++) buf[9 + i] = rowWeights[i] ?? 0;

  // colWeights [9+n..9+2n)
  for (let i = 0; i < n; i++) buf[9 + n + i] = colWeights[i] ?? 0;

  // rowTargets [9+2n..9+4n) as u16 LE
  for (let i = 0; i < n; i++) {
    writeU16LE(view, 9 + 2 * n + i * 2, rowTargets[i] ?? 0);
  }

  // colTargets [9+4n..9+6n) as u16 LE
  for (let i = 0; i < n; i++) {
    writeU16LE(view, 9 + 4 * n + i * 2, colTargets[i] ?? 0);
  }

  return buf;
}

/**
 * Decode a puzzle cell from its byte representation.
 * Givens are not stored in the serialized format; the returned puzzle has an
 * empty givens map.
 */
export function decodePuzzle(bytes: Uint8Array): Puzzle {
  if (bytes.length < 10) {
    throw new RangeError(`decodePuzzle: buffer too short (${bytes.length} bytes)`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = bytes.slice(0, 8);
  const n = bytes[8] ?? 0;

  const expected = puzzleByteLength(n);
  if (bytes.length !== expected) {
    throw new RangeError(
      `decodePuzzle: expected ${expected} bytes for n=${n}, got ${bytes.length}`,
    );
  }

  const rowWeights = Array.from({ length: n }, (_, i) => bytes[9 + i] ?? 0);
  const colWeights = Array.from({ length: n }, (_, i) => bytes[9 + n + i] ?? 0);
  const rowTargets = Array.from({ length: n }, (_, i) =>
    readU16LE(view, 9 + 2 * n + i * 2),
  );
  const colTargets = Array.from({ length: n }, (_, i) =>
    readU16LE(view, 9 + 4 * n + i * 2),
  );

  return {
    id,
    n,
    rowWeights,
    colWeights,
    rowTargets,
    colTargets,
    givens: new Map(),
  };
}
