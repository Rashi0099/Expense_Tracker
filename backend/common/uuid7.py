import os
import time
import uuid


def uuid7() -> uuid.UUID:
    """
    Generate an RFC 9562 compliant UUIDv7.
    Embeds millisecond timestamp in first 48 bits, version 7 in bits 48-51,
    variant 2 (RFC 4122/9562) in bits 64-65, with cryptographically secure randomness.
    """
    timestamp_ms = int(time.time() * 1000)
    rand_a = int.from_bytes(os.urandom(2), byteorder="big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), byteorder="big") & 0x3FFFFFFFFFFFFFFF
    uuid_int = (
        (timestamp_ms << 80) | (0x7000 << 64) | (rand_a << 64) | (0x8000000000000000) | rand_b
    )
    return uuid.UUID(int=uuid_int)
