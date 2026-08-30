"""Small dependency-free AES-256-GCM envelope used by LCARS Federation links.

The implementation exists so packaged bridges do not depend on a separately
installed Python crypto wheel. Android and browser clients use their platform
AES-GCM implementations. Keep this module limited to transport envelopes.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import struct

SBOX = (
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
)
RCON = (0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36)


def transport_key(token: str) -> bytes:
    """The stored token digest is also the symmetric transport key."""
    return hashlib.sha256(str(token).encode("utf-8")).digest()


def _rot_word(word):
    return word[1:] + word[:1]


def _sub_word(word):
    return bytes(SBOX[value] for value in word)


def _expand_key(key: bytes):
    if len(key) != 32:
        raise ValueError("Federation transport requires a 256-bit key")
    words = [key[index:index + 4] for index in range(0, 32, 4)]
    index = 8
    while len(words) < 60:
        temp = words[-1]
        if index % 8 == 0:
            temp = bytes([_sub_word(_rot_word(temp))[0] ^ RCON[index // 8], *_sub_word(_rot_word(temp))[1:]])
        elif index % 8 == 4:
            temp = _sub_word(temp)
        words.append(bytes(a ^ b for a, b in zip(words[index - 8], temp)))
        index += 1
    return [b"".join(words[index:index + 4]) for index in range(0, 60, 4)]


def _xtime(value):
    return ((value << 1) ^ (0x11B if value & 0x80 else 0)) & 0xFF


def _mix_column(column):
    total = column[0] ^ column[1] ^ column[2] ^ column[3]
    first = column[0]
    return [
        column[0] ^ total ^ _xtime(column[0] ^ column[1]),
        column[1] ^ total ^ _xtime(column[1] ^ column[2]),
        column[2] ^ total ^ _xtime(column[2] ^ column[3]),
        column[3] ^ total ^ _xtime(column[3] ^ first),
    ]


def _encrypt_block(key: bytes, block: bytes) -> bytes:
    if len(block) != 16:
        raise ValueError("AES blocks are 16 bytes")
    state = list(block)
    rounds = _expand_key(key)
    state = [value ^ rounds[0][index] for index, value in enumerate(state)]
    for round_index in range(1, 15):
        state = [SBOX[value] for value in state]
        state = [state[row + 4 * ((column + row) % 4)] for column in range(4) for row in range(4)]
        if round_index != 14:
            mixed = []
            for column in range(4):
                mixed.extend(_mix_column(state[column * 4:column * 4 + 4]))
            state = mixed
        state = [value ^ rounds[round_index][index] for index, value in enumerate(state)]
    return bytes(state)


def _multiply(left: int, right: int) -> int:
    value = 0
    for _ in range(128):
        if right & (1 << 127):
            value ^= left
        right = (right << 1) & ((1 << 128) - 1)
        left = (left >> 1) ^ (0xE1000000000000000000000000000000 if left & 1 else 0)
    return value


def _blocks(value: bytes):
    for index in range(0, len(value), 16):
        yield value[index:index + 16].ljust(16, b"\0")


def _ghash(key: bytes, aad: bytes, ciphertext: bytes) -> bytes:
    h = int.from_bytes(_encrypt_block(key, b"\0" * 16), "big")
    value = 0
    for block in [*_blocks(aad), *_blocks(ciphertext), struct.pack(">QQ", len(aad) * 8, len(ciphertext) * 8)]:
        value = _multiply(value ^ int.from_bytes(block, "big"), h)
    return value.to_bytes(16, "big")


def _counter(value: bytes) -> bytes:
    return value[:12] + ((int.from_bytes(value[12:], "big") + 1) & 0xFFFFFFFF).to_bytes(4, "big")


def encrypt(key: bytes, plaintext: bytes, aad: bytes = b"") -> tuple[bytes, bytes, bytes]:
    nonce = os.urandom(12)
    initial = nonce + b"\0\0\0\1"
    counter = initial
    output = bytearray()
    for block in _blocks(plaintext):
        counter = _counter(counter)
        stream = _encrypt_block(key, counter)
        length = min(16, len(plaintext) - len(output))
        output.extend(bytes(block[index] ^ stream[index] for index in range(length)))
    ciphertext = bytes(output)
    tag = bytes(a ^ b for a, b in zip(_encrypt_block(key, initial), _ghash(key, aad, ciphertext)))
    return nonce, ciphertext, tag


def decrypt(key: bytes, nonce: bytes, ciphertext: bytes, tag: bytes, aad: bytes = b"") -> bytes:
    if len(nonce) != 12 or len(tag) != 16:
        raise ValueError("Invalid Federation envelope")
    initial = nonce + b"\0\0\0\1"
    expected = bytes(a ^ b for a, b in zip(_encrypt_block(key, initial), _ghash(key, aad, ciphertext)))
    if not hmac.compare_digest(expected, tag):
        raise PermissionError("Federation envelope authentication failed")
    counter = initial
    output = bytearray()
    for block in _blocks(ciphertext):
        counter = _counter(counter)
        stream = _encrypt_block(key, counter)
        length = min(16, len(ciphertext) - len(output))
        output.extend(bytes(block[index] ^ stream[index] for index in range(length)))
    return bytes(output)


def seal_json(key: bytes, value, aad: str) -> dict:
    nonce, ciphertext, tag = encrypt(key, json.dumps(value, separators=(",", ":")).encode("utf-8"), aad.encode("utf-8"))
    return {
        "secure": 1,
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
    }


def open_json(key: bytes, value: dict, aad: str):
    if not isinstance(value, dict) or value.get("secure") != 1:
        raise ValueError("Encrypted Federation envelope required")
    try:
        plaintext = decrypt(
            key,
            base64.b64decode(value["nonce"], validate=True),
            base64.b64decode(value["ciphertext"], validate=True),
            base64.b64decode(value["tag"], validate=True),
            aad.encode("utf-8"),
        )
        return json.loads(plaintext)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid encrypted Federation envelope") from exc


def request_signature(key: bytes, timestamp: str, nonce: str, method: str, path: str, body: bytes) -> str:
    digest = hashlib.sha256(body).hexdigest()
    material = "\n".join((timestamp, nonce, method.upper(), path, digest)).encode("utf-8")
    return base64.b64encode(hmac.new(key, material, hashlib.sha256).digest()).decode("ascii")
