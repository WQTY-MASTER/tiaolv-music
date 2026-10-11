import { inflateSync } from 'node:zlib';

const QRC_KEY = Buffer.from('!@#)(*$%123ZXC!@!@#)(NHL', 'ascii');
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

// Ported from WXRIW/QQMusicDecoder (MIT). QQ's cipher intentionally preserves
// historical DES implementation quirks, including two non-standard S-box entries.
const S_BOXES = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 15, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 10, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
];

const KEY_PERM_C = [56, 48, 40, 32, 24, 16, 8, 0, 57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35];
const KEY_PERM_D = [62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 60, 52, 44, 36, 28, 20, 12, 4, 27, 19, 11, 3];
const KEY_COMPRESSION = [13, 16, 10, 23, 0, 4, 2, 27, 14, 5, 20, 9, 22, 18, 11, 3, 25, 7, 15, 6, 26, 19, 12, 1, 40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47, 43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31];
const QRC_PERMUTATION = [15, 6, 19, 20, 28, 11, 27, 16, 0, 14, 22, 25, 4, 17, 30, 9, 1, 7, 23, 13, 31, 26, 2, 8, 18, 12, 29, 5, 21, 10, 3, 24];
const IP_LEFT = [57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
const IP_RIGHT = [56, 48, 40, 32, 24, 16, 8, 0, 58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6];

function bitNum(input: Uint8Array, bit: number, outputBit: number) {
  const byteIndex = Math.floor(bit / 32) * 4 + 3 - Math.floor((bit % 32) / 8);
  return (((input[byteIndex] >> (7 - (bit % 8))) & 1) << outputBit) >>> 0;
}

function bitNumIntr(value: number, bit: number, outputBit: number) {
  return ((((value >>> (31 - bit)) & 1) << outputBit) >>> 0);
}

function bitNumIntl(value: number, bit: number, outputBit: number) {
  return (((value << bit) & 0x80000000) >>> outputBit) >>> 0;
}

function sBoxBit(value: number) {
  return (value & 0x20) | ((value & 0x1f) >> 1) | ((value & 1) << 4);
}

function createQrcRoundKeys(key: Uint8Array, decrypt: boolean) {
  let left = 0;
  let right = 0;
  for (let index = 0, outputBit = 31; index < 28; index += 1, outputBit -= 1) {
    left = (left | bitNum(key, KEY_PERM_C[index], outputBit)) >>> 0;
    right = (right | bitNum(key, KEY_PERM_D[index], outputBit)) >>> 0;
  }

  const schedule = Array.from({ length: 16 }, () => new Uint8Array(6));
  for (let round = 0; round < 16; round += 1) {
    const shift = SHIFTS[round];
    left = (((left << shift) | (left >>> (28 - shift))) & 0xfffffff0) >>> 0;
    right = (((right << shift) | (right >>> (28 - shift))) & 0xfffffff0) >>> 0;
    const targetRound = decrypt ? 15 - round : round;
    for (let index = 0; index < 24; index += 1) {
      schedule[targetRound][Math.floor(index / 8)] |= bitNumIntr(left, KEY_COMPRESSION[index], 7 - (index % 8));
    }
    for (let index = 24; index < 48; index += 1) {
      schedule[targetRound][Math.floor(index / 8)] |= bitNumIntr(right, KEY_COMPRESSION[index] - 27, 7 - (index % 8));
    }
  }
  return schedule;
}

function qrcFeistel(state: number, key: Uint8Array) {
  const largeState = new Uint8Array(6);
  const first = (
    bitNumIntl(state, 31, 0) | ((state & 0xf0000000) >>> 1) | bitNumIntl(state, 4, 5)
    | bitNumIntl(state, 3, 6) | ((state & 0x0f000000) >>> 3) | bitNumIntl(state, 8, 11)
    | bitNumIntl(state, 7, 12) | ((state & 0x00f00000) >>> 5) | bitNumIntl(state, 12, 17)
    | bitNumIntl(state, 11, 18) | ((state & 0x000f0000) >>> 7) | bitNumIntl(state, 16, 23)
  ) >>> 0;
  const second = (
    bitNumIntl(state, 15, 0) | ((state & 0x0000f000) << 15) | bitNumIntl(state, 20, 5)
    | bitNumIntl(state, 19, 6) | ((state & 0x00000f00) << 13) | bitNumIntl(state, 24, 11)
    | bitNumIntl(state, 23, 12) | ((state & 0x000000f0) << 11) | bitNumIntl(state, 28, 17)
    | bitNumIntl(state, 27, 18) | ((state & 0x0000000f) << 9) | bitNumIntl(state, 0, 23)
  ) >>> 0;

  largeState[0] = (first >>> 24) & 0xff;
  largeState[1] = (first >>> 16) & 0xff;
  largeState[2] = (first >>> 8) & 0xff;
  largeState[3] = (second >>> 24) & 0xff;
  largeState[4] = (second >>> 16) & 0xff;
  largeState[5] = (second >>> 8) & 0xff;
  for (let index = 0; index < 6; index += 1) {
    largeState[index] ^= key[index];
  }

  const substituted = (
    (S_BOXES[0][sBoxBit(largeState[0] >>> 2)] << 28)
    | (S_BOXES[1][sBoxBit(((largeState[0] & 3) << 4) | (largeState[1] >>> 4))] << 24)
    | (S_BOXES[2][sBoxBit(((largeState[1] & 15) << 2) | (largeState[2] >>> 6))] << 20)
    | (S_BOXES[3][sBoxBit(largeState[2] & 63)] << 16)
    | (S_BOXES[4][sBoxBit(largeState[3] >>> 2)] << 12)
    | (S_BOXES[5][sBoxBit(((largeState[3] & 3) << 4) | (largeState[4] >>> 4))] << 8)
    | (S_BOXES[6][sBoxBit(((largeState[4] & 15) << 2) | (largeState[5] >>> 6))] << 4)
    | S_BOXES[7][sBoxBit(largeState[5] & 63)]
  ) >>> 0;

  return QRC_PERMUTATION.reduce(
    (result, bit, outputBit) => (result | bitNumIntl(substituted, bit, outputBit)) >>> 0,
    0
  );
}

function readInitialState(input: Uint8Array) {
  return [IP_LEFT, IP_RIGHT].map(positions => positions.reduce(
    (value, bit, index) => (value | bitNum(input, bit, 31 - index)) >>> 0,
    0
  ));
}

function writeInitialState(left: number, right: number) {
  const output = Buffer.alloc(8);
  for (const [state, positions] of [[left, IP_LEFT], [right, IP_RIGHT]] as Array<[number, number[]]>) {
    positions.forEach((bit, index) => {
      if (((state >>> (31 - index)) & 1) === 0) {
        return;
      }
      const byteIndex = Math.floor(bit / 32) * 4 + 3 - Math.floor((bit % 32) / 8);
      output[byteIndex] |= 1 << (7 - (bit % 8));
    });
  }
  return output;
}

function qrcCryptBlock(input: Uint8Array, schedule: Uint8Array[]) {
  let [left, right] = readInitialState(input);
  for (let round = 0; round < 15; round += 1) {
    const previousRight = right;
    right = (qrcFeistel(right, schedule[round]) ^ left) >>> 0;
    left = previousRight;
  }
  left = (qrcFeistel(right, schedule[15]) ^ left) >>> 0;
  return writeInitialState(left, right);
}

function decryptTripleDes(input: Uint8Array) {
  const schedules = [
    createQrcRoundKeys(QRC_KEY.subarray(16, 24), true),
    createQrcRoundKeys(QRC_KEY.subarray(8, 16), false),
    createQrcRoundKeys(QRC_KEY.subarray(0, 8), true)
  ];
  const output = Buffer.alloc(input.length);
  for (let offset = 0; offset < input.length; offset += 8) {
    let block = Buffer.from(input.subarray(offset, offset + 8));
    for (const schedule of schedules) {
      block = qrcCryptBlock(block, schedule);
    }
    block.copy(output, offset);
  }
  return output;
}

export function decryptQrcLyric(encrypted: unknown) {
  if (typeof encrypted !== 'string' || !/^[0-9a-f]+$/iu.test(encrypted) || encrypted.length % 16 !== 0) {
    return '';
  }
  try {
    return inflateSync(decryptTripleDes(Buffer.from(encrypted, 'hex'))).toString('utf8');
  } catch {
    return '';
  }
}

export function extractQrcContent(raw: string) {
  const match = raw.match(/LyricContent="([\s\S]*?)"\s*\/?>(?:\s*<\/Lyric_\d+>)?/u);
  const content = match?.[1] ?? raw;
  return content
    .replace(/&#10;/gu, '\n')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}
