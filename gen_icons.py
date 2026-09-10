#!/usr/bin/env python3
# 生成电商作战室 PWA 图标（纯标准库，无第三方依赖）
# 输出：assets/icons/icon-192.png | icon-512.png | maskable-512.png | apple-touch-icon.png
import zlib, struct, math, os

C1 = (255, 122, 24)   # 渐变上  #FF7A18
C2 = (255, 61, 0)     # 渐变下  #FF3D00


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(v):
    return 0.0 if v < 0 else (1.0 if v > 1 else v)


def smooth(d, aa):
    return clamp01(0.5 - d / aa)


def sdf_round_rect(px, py, rx, ry, hw, hh, rr):
    qx = abs(px - rx) - hw + rr
    qy = abs(py - ry) - hh + rr
    ax = max(qx, 0.0)
    ay = max(qy, 0.0)
    outside = math.hypot(ax, ay)
    inside = min(max(qx, qy), 0.0)
    return outside + inside - rr


def build(size, transparent, mask):
    s = size / 512.0
    bx = by = 256 * s
    bhw = bhh = 256 * s
    bg_rr = 110 * s

    k = 0.62 if mask else 1.0
    bag_hw = 132 * k * s
    bag_hh = 112 * k * s
    bag_cx = 256 * s
    bag_cy = (300 if mask else 330) * s
    bag_rr = 32 * k * s
    handleR = 78 * k * s
    handleY = (250 if mask else 250) * s
    handle_w = 11 * s

    buf = bytearray()
    for y in range(size):
        t = y / (size - 1)
        r0 = lerp(C1[0], C2[0], t)
        g0 = lerp(C1[1], C2[1], t)
        b0 = lerp(C1[2], C2[2], t)
        for x in range(size):
            # 背景（圆角方块，透明角）
            if transparent:
                d_bg = sdf_round_rect(x, y, bx, by, bhw, bhh, bg_rr)
                bg_a = smooth(d_bg, 1.5)
            else:
                bg_a = 1.0

            # 购物袋袋身
            d_body = sdf_round_rect(x, y, bag_cx, bag_cy, bag_hw, bag_hh, bag_rr)
            body_a = smooth(d_body, 1.5)

            # 提手（上半圆）
            dx = x - bag_cx
            dy = y - handleY
            d_hand = abs(math.hypot(dx, dy) - handleR)
            hand_a = smooth(d_hand - handle_w, 1.5) if dy <= 0 else 0.0

            shape_a = body_a if body_a > hand_a else hand_a

            R = lerp(r0, 255, shape_a)
            G = lerp(g0, 255, shape_a)
            B = lerp(b0, 255, shape_a)
            A = bg_a
            buf += bytes((int(R), int(G), int(B), int(A * 255)))
    return bytes(buf)


def write_png(path, w, h, rgba):
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data +
                struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    raw = bytearray()
    for i in range(h):
        raw.append(0)
        raw += rgba[i * w * 4:(i + 1) * w * 4]
    idat = zlib.compress(bytes(raw), 9)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))


def main():
    out = os.path.join(os.path.dirname(__file__), 'assets', 'icons')
    os.makedirs(out, exist_ok=True)
    jobs = [
        ('icon-192.png', 192, True, False),
        ('icon-512.png', 512, True, False),
        ('maskable-512.png', 512, False, True),
        ('apple-touch-icon.png', 180, False, False),
    ]
    for name, size, transparent, mask in jobs:
        png = build(size, transparent, mask)
        write_png(os.path.join(out, name), size, size, png)
        print('wrote', name, size, 'x', size)


if __name__ == '__main__':
    main()
