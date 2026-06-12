#!/usr/bin/env python3
import binascii
import collections
import os
import struct
import sys
import zlib
from collections import deque


PNG_SIG = b"\x89PNG\r\n\x1a\n"


def read_png(path):
    with open(path, "rb") as f:
        data = f.read()
    if not data.startswith(PNG_SIG):
        raise ValueError(f"{path}: not a PNG")
    pos = len(PNG_SIG)
    width = height = bit_depth = color_type = None
    idat = []
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _comp, _filter, interlace = struct.unpack(">IIBBBBB", payload)
            if bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
                raise ValueError(f"{path}: unsupported PNG format")
        elif kind == b"IDAT":
            idat.append(payload)
        elif kind == b"IEND":
            break
    if width is None:
        raise ValueError(f"{path}: missing IHDR")
    bpp = 4 if color_type == 6 else 3
    raw = zlib.decompress(b"".join(idat))
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    offset = 0
    for _y in range(height):
        ftype = raw[offset]
        offset += 1
        cur = bytearray(raw[offset : offset + stride])
        offset += stride
        for i in range(stride):
            left = cur[i - bpp] if i >= bpp else 0
            up = prev[i]
            up_left = prev[i - bpp] if i >= bpp else 0
            if ftype == 1:
                cur[i] = (cur[i] + left) & 255
            elif ftype == 2:
                cur[i] = (cur[i] + up) & 255
            elif ftype == 3:
                cur[i] = (cur[i] + ((left + up) >> 1)) & 255
            elif ftype == 4:
                p = left + up - up_left
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - up_left)
                pred = left if pa <= pb and pa <= pc else up if pb <= pc else up_left
                cur[i] = (cur[i] + pred) & 255
            elif ftype != 0:
                raise ValueError(f"{path}: unknown PNG filter {ftype}")
        rows.append(cur)
        prev = cur
    rgba = bytearray(width * height * 4)
    out = 0
    for row in rows:
        for x in range(width):
            src = x * bpp
            rgba[out : out + 3] = row[src : src + 3]
            rgba[out + 3] = row[src + 3] if bpp == 4 else 255
            out += 4
    return width, height, rgba


def write_png(path, width, height, rgba):
    def chunk(kind, payload):
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF)
        )

    scanlines = bytearray()
    stride = width * 4
    for y in range(height):
        scanlines.append(0)
        scanlines.extend(rgba[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(PNG_SIG)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(scanlines), 9)))
        f.write(chunk(b"IEND", b""))


def transparentize(width, height, rgba):
    def pixel(i):
        return rgba[i], rgba[i + 1], rgba[i + 2]

    border = []
    for x in range(width):
        border.append(pixel(x * 4))
        border.append(pixel(((height - 1) * width + x) * 4))
    for y in range(height):
        border.append(pixel((y * width) * 4))
        border.append(pixel((y * width + width - 1) * 4))

    def quant(c):
        return tuple((v // 8) * 8 for v in c)

    common = [c for c, _n in collections.Counter(map(quant, border)).most_common(12)]

    def near(a, b, limit=34):
        return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2])) <= limit

    def is_background(i):
        c = pixel(i)
        if c[0] > 226 and c[1] > 226 and c[2] > 226 and max(c) - min(c) < 34:
            return True
        return any(near(c, base) for base in common)

    seen = bytearray(width * height)
    q = deque()
    for x in range(width):
        q.append((x, 0))
        q.append((x, height - 1))
    for y in range(height):
        q.append((0, y))
        q.append((width - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        p = y * width + x
        if seen[p]:
            continue
        i = p * 4
        if not is_background(i):
            continue
        seen[p] = 1
        rgba[i + 3] = 0
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    for y in range(height):
        for x in range(width):
            p = y * width + x
            if seen[p]:
                continue
            i = p * 4
            if rgba[i + 3] == 255 and is_background(i):
                neighbors = (
                    (x > 0 and seen[p - 1])
                    or (x < width - 1 and seen[p + 1])
                    or (y > 0 and seen[p - width])
                    or (y < height - 1 and seen[p + width])
                )
                if neighbors:
                    rgba[i + 3] = 92
    return rgba


def main(argv):
    if len(argv) < 3 or len(argv[1:]) % 2 != 0:
        print("usage: png_alpha_flood.py SRC DST [SRC DST ...]", file=sys.stderr)
        return 2
    for src, dst in zip(argv[1::2], argv[2::2]):
        w, h, rgba = read_png(src)
        rgba = transparentize(w, h, rgba)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        write_png(dst, w, h, rgba)
        print(f"{dst}: {w}x{h}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
