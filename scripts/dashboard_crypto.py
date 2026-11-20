"""
dashboard_crypto.py
Password-encrypts the dashboard data so only ciphertext is ever committed.

AES-256-GCM with a key derived from the password via PBKDF2-SHA256.
script/dashboard.js decrypts it in the browser with the Web Crypto API,
so the parameters here must stay in sync with that file.
"""

import base64
import secrets

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 600_000


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def encrypt(plaintext: bytes, password: str) -> dict:
    salt = secrets.token_bytes(16)
    iv = secrets.token_bytes(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(
        password.encode("utf-8")
    )
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)  # includes the 16-byte auth tag
    return {
        "v": 1,
        "kdf": "PBKDF2-SHA256",
        "iterations": ITERATIONS,
        "salt": _b64(salt),
        "iv": _b64(iv),
        "data": _b64(ciphertext),
    }
