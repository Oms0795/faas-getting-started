from hmac import compare_digest
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from app.services.runtime import PlatformRuntime

AdminKeyHeader = Annotated[str | None, Header(alias="X-Nexus-Admin-Key")]


def get_runtime(request: Request) -> PlatformRuntime:
    return request.app.state.runtime


def require_admin_api_key(
    request: Request,
    provided_key: AdminKeyHeader = None,
) -> None:
    settings = get_runtime(request).settings
    configured_key = settings.admin_api_key
    expected_key = configured_key.get_secret_value() if configured_key is not None else ""
    if not expected_key or not provided_key or not compare_digest(provided_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid X-Nexus-Admin-Key header is required",
        )
