"""Bounded reads for uploaded files.

`UploadFile.file.read()` with no argument pulls the whole body into memory,
however large the client made it. These helpers stop at a cap instead.
"""
from typing import BinaryIO

from fastapi import HTTPException, UploadFile

_CHUNK_BYTES = 1024 * 1024


def copy_upload_limited(upload: UploadFile, destination: BinaryIO, max_bytes: int) -> int:
    """Stream `upload` into `destination`, 413-ing as soon as it exceeds
    `max_bytes`. Returns the number of bytes written."""
    written = 0
    while True:
        chunk = upload.file.read(_CHUNK_BYTES)
        if not chunk:
            return written
        written += len(chunk)
        if written > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Tệp quá lớn (tối đa {max_bytes // (1024 * 1024)}MB).",
            )
        destination.write(chunk)
