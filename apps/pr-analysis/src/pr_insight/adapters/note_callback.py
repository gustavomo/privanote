"""Note callback adapter for posting analysis results (per D-47, D-21)."""

from __future__ import annotations

import httpx

from pr_insight.domain.ports import NoteCallbackPort


class NoteCallbackAdapter(NoteCallbackPort):
    """Posts analysis results to the Node.js backend callback URL.

    The response dict includes ``nodeId`` which the pipeline uses
    for auto-select in the main window (per D-21).
    """

    def __init__(self, callback_url: str) -> None:
        self._callback_url = callback_url

    async def send_analysis_result(self, result: dict) -> dict:
        """POST analysis result and return callback response.

        Returns:
            Response JSON, e.g. ``{"success": True, "nodeId": "abc-123"}``.

        Raises:
            RuntimeError: If the callback responds with a non-2xx status.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self._callback_url, json=result)
            if response.is_success:
                return response.json()
            raise RuntimeError(
                f"Note callback failed: {response.status_code}"
            )
