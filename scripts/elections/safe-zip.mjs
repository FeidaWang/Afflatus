/* Reads one file out of a ZIP with a hard cap on the unpacked size, so a
   decompression bomb stops at the limit. Each VEC results ZIP holds one XML. */
import { crc32, inflateRawSync } from 'node:zlib';

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

export function readSingleFile(zip, { maxBytes }) {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== END_OF_DIRECTORY) end -= 1;
  if (end < 0) throw new Error('Not a ZIP archive');
  const count = zip.readUInt16LE(end + 10);
  if (count !== 1) throw new Error(`Expected one file in the ZIP, found ${count}`);
  const entry = zip.readUInt32LE(end + 16);
  if (entry + 46 > zip.length || zip.readUInt32LE(entry) !== DIRECTORY_ENTRY) throw new Error('Corrupt ZIP directory');
  const method = zip.readUInt16LE(entry + 10);
  const expectedCrc = zip.readUInt32LE(entry + 16);
  const packedSize = zip.readUInt32LE(entry + 20);
  const size = zip.readUInt32LE(entry + 24);
  const nameLength = zip.readUInt16LE(entry + 28);
  const local = zip.readUInt32LE(entry + 42);
  const name = zip.toString('utf8', entry + 46, entry + 46 + nameLength);
  if (size > maxBytes) throw new Error(`ZIP entry is ${size} bytes, over the ${maxBytes} limit`);
  if (local + 30 > zip.length || zip.readUInt32LE(local) !== LOCAL_HEADER) throw new Error('Corrupt ZIP header');
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const packed = zip.subarray(start, start + packedSize);
  let bytes;
  if (method === 0) bytes = packed;
  else if (method === 8) bytes = inflateRawSync(packed, { maxOutputLength: maxBytes });
  else throw new Error(`Unsupported ZIP method ${method}`);
  if (crc32(bytes) !== expectedCrc) throw new Error('ZIP checksum mismatch');
  return { name, bytes };
}
