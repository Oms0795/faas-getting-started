from fastapi import Request

from app.services.runtime import PlatformRuntime


def get_runtime(request: Request) -> PlatformRuntime:
    return request.app.state.runtime
