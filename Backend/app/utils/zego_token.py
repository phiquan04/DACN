"""Server-side generator for ZegoCloud's "token04" room-join token.

Ports ZEGOCLOUD's official Node.js reference implementation
(zego_server_assistant/token/nodejs/server/zegoServerAssistant.js) so the
AES server secret never has to ship to the frontend bundle — the previous
implementation called the SDK's client-side `generateKitTokenForTest`,
which embeds the secret in the browser.
"""
import base64
import json
import os
import random
import struct
import time

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def _make_random_iv() -> bytes:
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    return "".join(random.choice(alphabet) for _ in range(16)).encode("utf-8")


def _aes_algorithm_for(key: bytes):
    if len(key) not in (16, 24, 32):
        raise ValueError(f"Invalid ZEGO_SERVER_SECRET length: {len(key)} bytes (must be 16, 24 or 32)")
    return algorithms.AES(key)


def _aes_encrypt(plain_text: bytes, key: bytes, iv: bytes) -> bytes:
    cipher = Cipher(_aes_algorithm_for(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(plain_text) + padder.finalize()
    return encryptor.update(padded) + encryptor.finalize()


def generate_token04(app_id: int, user_id: str, secret: str, effective_time_in_seconds: int, payload: str = "") -> str:
    """Builds a ZegoCloud token04 string, matching the official algorithm byte-for-byte."""
    if len(secret) != 32:
        raise ValueError("ZEGO_SERVER_SECRET must be a 32-byte string")

    create_time = int(time.time())
    token_info = {
        "app_id": app_id,
        "user_id": user_id,
        "nonce": random.randint(-2147483648, 2147483647),
        "ctime": create_time,
        "expire": create_time + effective_time_in_seconds,
        "payload": payload,
    }
    plain_text = json.dumps(token_info).encode("utf-8")

    iv = _make_random_iv()
    encrypted = _aes_encrypt(plain_text, secret.encode("utf-8"), iv)

    buf = (
        struct.pack(">q", token_info["expire"])
        + struct.pack(">H", len(iv))
        + iv
        + struct.pack(">H", len(encrypted))
        + encrypted
    )

    return "04" + base64.b64encode(buf).decode("utf-8")


def get_zego_credentials() -> tuple[int, str]:
    """Reads and validates the Zego app credentials from the environment."""
    app_id_raw = os.getenv("ZEGO_APP_ID")
    secret = os.getenv("ZEGO_SERVER_SECRET")
    if not app_id_raw or not secret:
        raise RuntimeError("ZEGO_APP_ID / ZEGO_SERVER_SECRET is not configured on the server")
    return int(app_id_raw), secret
