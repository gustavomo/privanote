from fastapi import APIRouter


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    # Routes will be added in Plan 03
    return router
