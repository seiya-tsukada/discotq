"""MP4 / MOV（ISO BMFF・QuickTime）のヘッダーを読み、長さ・解像度・faststart を調べる。

外部コマンド（ffprobe など）に依存しないよう、必要な box だけを自前で読む。
* 長さ        : moov > mvhd の duration / timescale
* 解像度      : moov > trak > tkhd の width / height（映像トラック）。
                回転行列が 90 / 270 度なら縦横を入れ替える（スマホの縦撮り）
* faststart   : トップレベルで moov が mdat より前にあるか
"""

from __future__ import annotations

import struct
from dataclasses import dataclass



class Mp4Error(ValueError):
    pass


@dataclass(frozen=True)
class Mp4Info:
    duration_sec: float
    width: int | None
    height: int | None
    faststart: bool


def _iter_boxes(data: bytes, start: int, end: int) -> list[tuple[bytes, int, int]]:
    """(type, payload_start, box_end) の一覧を返す。"""
    boxes = []
    pos = start
    while pos + 8 <= end:
        size, box_type = struct.unpack(">I4s", data[pos : pos + 8])
        header = 8
        if size == 1:
            if pos + 16 > end:
                raise Mp4Error("box ヘッダーが途中で切れています")
            size = struct.unpack(">Q", data[pos + 8 : pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header or pos + size > end:
            raise Mp4Error(f"box '{box_type.decode('latin-1')}' のサイズが不正です")
        boxes.append((box_type, pos + header, pos + size))
        pos += size
    return boxes


def _parse_mvhd(data: bytes, start: int) -> float:
    version = data[start]
    if version == 1:
        timescale, duration = struct.unpack(">IQ", data[start + 20 : start + 32])
    else:
        timescale, duration = struct.unpack(">II", data[start + 12 : start + 20])
    if timescale == 0:
        raise Mp4Error("mvhd の timescale が 0 です")
    return float(duration) / float(timescale)


def _parse_tkhd(data: bytes, start: int) -> tuple[int, int, bool]:
    """(width, height, rotated_90) を返す。"""
    version = data[start]
    # version 0: 4(ver/flags)+4+4+4+4+4(duration) / version 1: 4+8+8+4+4+8
    offset = start + (36 if version == 1 else 24)
    offset += 8 + 2 + 2 + 2 + 2  # reserved, layer, alternate_group, volume, reserved
    a, b, _u, c, d = struct.unpack(">iiiii", data[offset : offset + 20])
    offset += 36  # matrix (9 x 4 bytes)
    width_fixed, height_fixed = struct.unpack(">II", data[offset : offset + 8])
    rotated = a == 0 and d == 0 and b != 0 and c != 0
    return width_fixed >> 16, height_fixed >> 16, rotated


def parse_mp4(data: bytes) -> Mp4Info:
    top = _iter_boxes(data, 0, len(data))
    types = [t for t, _, _ in top]
    if b"moov" not in types:
        raise Mp4Error("moov box がありません（MP4 / MOV ではないか、壊れています）")
    moov_index = types.index(b"moov")
    mdat_index = types.index(b"mdat") if b"mdat" in types else len(types)
    faststart = moov_index < mdat_index

    _, moov_start, moov_end = top[moov_index]
    duration: float | None = None
    width = height = None
    for box_type, start, end in _iter_boxes(data, moov_start, moov_end):
        if box_type == b"mvhd":
            duration = _parse_mvhd(data, start)
        elif box_type == b"trak" and width is None:
            for t, s, _e in _iter_boxes(data, start, end):
                if t == b"tkhd":
                    w, h, rotated = _parse_tkhd(data, s)
                    if w and h:  # 音声トラックは 0x0
                        width, height = (h, w) if rotated else (w, h)
    if duration is None:
        raise Mp4Error("mvhd box がありません")
    return Mp4Info(duration_sec=duration, width=width, height=height, faststart=faststart)
