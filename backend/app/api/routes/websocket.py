from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.runtime import PlatformRuntime

router = APIRouter()


@router.websocket("/ws/market")
async def market_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    runtime: PlatformRuntime = websocket.app.state.runtime
    queue = runtime.subscribe()
    try:
        await websocket.send_json(
            {
                "type": "snapshot",
                "status": runtime.status().model_dump(mode="json"),
                "quotes": [quote.model_dump(mode="json") for quote in runtime.latest_quotes()],
            }
        )
        while True:
            await websocket.send_json(await queue.get())
    except WebSocketDisconnect:
        pass
    finally:
        runtime.unsubscribe(queue)
