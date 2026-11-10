"""Upstage Solar LLM 호출(OpenAI 호환 Chat Completions). 표준 라이브러리만 사용.

설정(backend/.env): UPSTAGE_API_KEY, UPSTAGE_MODEL(기본 solar-pro4), UPSTAGE_BASE_URL(기본 https://api.upstage.ai/v1)
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

API_KEY = os.getenv("UPSTAGE_API_KEY", "").strip()
MODEL = os.getenv("UPSTAGE_MODEL", "solar-pro4").strip()
BASE_URL = os.getenv("UPSTAGE_BASE_URL", "https://api.upstage.ai/v1").rstrip("/")


class LLMError(RuntimeError):
    pass


def configured() -> bool:
    return bool(API_KEY)


def chat_json(system: str, user: str, timeout: int = 90) -> dict:
    """JSON 객체로 답을 받는다. 실패하면 LLMError."""
    if not API_KEY:
        raise LLMError("UPSTAGE_API_KEY 없음: backend/.env에 넣으세요")
    body = {"model": MODEL, "temperature": 0.1, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(f"{BASE_URL}/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise LLMError(f"Upstage API HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise LLMError(f"Upstage API 연결 실패: {e.reason}") from e
    content = data["choices"][0]["message"]["content"] or ""
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        # 코드 블록으로 감싸 오는 경우 대비
        s, t = content.find("{"), content.rfind("}")
        if s >= 0 and t > s:
            return json.loads(content[s:t + 1])
        raise LLMError(f"LLM 응답이 JSON이 아님: {content[:200]}") from e
