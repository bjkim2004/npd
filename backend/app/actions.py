"""Action Item: Slack 채널 대화(또는 붙여 넣은 텍스트)에서 LLM으로 할 일을 뽑아 DB에 저장·조회.

Slack 읽기는 봇 토큰이 필요하다(웹훅은 보내기 전용).
- SLACK_BOT_TOKEN : xoxb-, 권한 channels:history(비공개 채널이면 groups:history), users:read(이름 표시)
- SLACK_CHANNEL   : 기본 C0C093UBJ49. 봇을 채널에 초대해야 함
가져온 마지막 메시지 시각을 npd_action_sync에 남겨 다음에는 그 뒤 메시지만 읽는다.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, Integer, String, Text, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from . import auth, llm
from .db import Base, get_db
from .models import Product

BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "").strip()
CHANNEL = os.getenv("SLACK_CHANNEL", "C0C093UBJ49").strip()
STATUSES = ["할 일", "진행 중", "완료"]


class ActionItem(Base):
    __tablename__ = "npd_action_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due: Mapped[date | None] = mapped_column(Date, nullable=True)
    product: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="할 일")
    source: Mapped[str] = mapped_column(String(20), default="slack")  # slack | text
    source_ts: Mapped[str | None] = mapped_column(String(40), nullable=True)  # Slack 메시지 ts
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # 근거 메시지 원문
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActionSync(Base):
    __tablename__ = "npd_action_sync"
    channel: Mapped[str] = mapped_column(String(50), primary_key=True)
    last_ts: Mapped[str] = mapped_column(String(40))


# ---------- Slack 읽기 ----------
def _slack(method: str, **params) -> dict:
    url = f"https://slack.com/api/{method}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {BOT_TOKEN}"})
    with urllib.request.urlopen(req, timeout=15) as r:
        res = json.load(r)
    if not res.get("ok"):
        err = res.get("error")
        hint = {"not_in_channel": "봇을 채널에 초대하세요(/invite @봇이름)",
                "missing_scope": f"봇 권한 부족: {res.get('needed', 'channels:history')} 추가 후 앱 재설치",
                "channel_not_found": "SLACK_CHANNEL 확인(비공개 채널이면 봇 초대 필요)",
                "invalid_auth": "SLACK_BOT_TOKEN 확인"}.get(err, "")
        raise HTTPException(502, f"Slack {method} 오류: {err}" + (f" — {hint}" if hint else ""))
    return res


def fetch_slack(oldest: float) -> list[dict]:
    """oldest(유닉스 초) 이후 사람이 쓴 메시지를 오래된 순으로. [{ts, user, text}]"""
    msgs, cursor = [], None
    while True:
        params = {"channel": CHANNEL, "oldest": f"{oldest:.6f}", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        res = _slack("conversations.history", **params)
        msgs += res.get("messages", [])
        cursor = (res.get("response_metadata") or {}).get("next_cursor")
        if not cursor or len(msgs) >= 1000:
            break
    names: dict[str, str] = {}

    def name(uid: str | None) -> str:
        if not uid:
            return "알 수 없음"
        if uid not in names:
            try:
                u = _slack("users.info", user=uid)["user"]
                names[uid] = u.get("profile", {}).get("display_name") or u.get("real_name") or uid
            except HTTPException:
                names[uid] = uid  # users:read 없으면 ID로
        return names[uid]

    out = []
    for m in sorted(msgs, key=lambda m: float(m["ts"])):
        if m.get("bot_id") or m.get("subtype") in {"bot_message", "channel_join", "channel_leave"}:
            continue  # 지연 알림 등 봇 메시지·입퇴장 제외
        if (m.get("text") or "").strip():
            out.append({"ts": m["ts"], "user": name(m.get("user")), "text": m["text"]})
    return out


# ---------- LLM 추출 ----------
SYSTEM = """너는 신제품 개발(NPD) 프로젝트 회의록·메신저 대화에서 Action Item을 뽑는 비서다.
규칙:
- 누군가 해야 할 구체적인 일(요청, 약속, 결정에 따른 후속 작업)만 뽑는다. 잡담·단순 공유·이미 끝난 일은 뺀다.
- title: 동사로 끝나는 짧은 한국어 문장(예: "금형 견적 받기"). detail: 필요한 맥락 한두 문장, 없으면 null.
- owner: 담당자 이름(대화에 나온 그대로). 불분명하면 null. 추측하지 않는다.
- due: 기한을 YYYY-MM-DD로. 기한이 없으면 null.
  "금요일까지", "이번주", "다음주 화요일", "내일" 같은 상대 표현은 오늘이 아니라 그 말을 한 메시지의 날짜를 기준으로 하고,
  날짜는 직접 계산하지 말고 주어진 달력에서 찾는다. 한 주는 월요일~일요일이다.
  예) 메시지가 수요일 11/4이면 "이번주 금요일"=11/6, "다음주 화요일"=11/10, "내일"=11/5.
  메시지 날짜를 알 수 없을 때만 오늘 기준.
- product: 아래 제품 목록 중 관련 제품 이름, 없으면 null.
- refs: 근거가 된 메시지 번호 배열(예: [3]).
- 같은 일이 여러 번 언급되면 하나로 합친다.
JSON 객체 하나로만 답한다: {"items":[{"title":"","detail":null,"owner":null,"due":null,"product":null,"refs":[1]}]}
Action Item이 없으면 {"items":[]}."""


WD = "월화수목금토일"


def _calendar(dates: list[date]) -> str:
    """LLM이 요일 계산을 틀리지 않도록 관련 주(월~일)의 날짜표를 준다."""
    start = min(dates) - timedelta(days=min(dates).weekday())
    end = max(dates) + timedelta(days=21)
    rows = []
    d = start
    while d <= end:
        week = [d + timedelta(days=i) for i in range(7)]
        rows.append(f"{week[0].isoformat()} 주: " + ", ".join(f"{WD[x.weekday()]} {x.month}/{x.day}" for x in week))
        d += timedelta(days=7)
    return "\n".join(rows)


_LINE_DATE = re.compile(r"^\s*\[?\s*(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})")


def _line_date(line: str) -> date | None:
    """붙여 넣은 줄 앞의 날짜(예: [11/04 09:12], 2026-11-04)를 읽는다. 연도가 없으면 올해."""
    m = _LINE_DATE.match(line)
    if not m:
        return None
    try:
        return date(int(m.group(1) or date.today().year), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _parse_date(v) -> date | None:
    try:
        return date.fromisoformat(str(v)[:10]) if v else None
    except ValueError:
        return None


def extract(db: Session, messages: list[dict], source: str, user: auth.User) -> list[ActionItem]:
    """messages = [{ts|None, user, text, date|None}] → 새 ActionItem 저장 후 반환"""
    if not messages:
        return []
    products = [p.name for p in db.scalars(select(Product))]

    def when(m) -> str:
        d = m.get("date")
        return f"(메시지 날짜 {d.isoformat()} {WD[d.weekday()]}요일)" if d else ""

    lines = [f"[{i}] " + " ".join(x for x in (when(m), f"{m['user']}:" if m["user"] else "") if x) + f" {m['text']}"
             for i, m in enumerate(messages, 1)]
    dates = [m["date"] for m in messages if m.get("date")] + [date.today()]
    prompt = (f"오늘: {date.today().isoformat()} ({WD[date.today().weekday()]}요일)\n"
              f"제품 목록: {', '.join(products) or '없음'}\n\n달력:\n{_calendar(dates)}\n\n대화:\n" + "\n".join(lines))
    try:
        data = llm.chat_json(SYSTEM, prompt[:60000])
    except llm.LLMError as e:
        raise HTTPException(502, str(e)) from e

    # 중복 판정: 같은 근거 메시지 + 같은 담당자면 같은 일로 본다(LLM이 제목을 조금씩 다르게 써도 걸러짐)
    existing = {(a.source_ts, a.owner) for a in db.scalars(select(ActionItem)) if a.source_ts}
    existing_titles = {a.title for a in db.scalars(select(ActionItem))}
    created = []
    for it in data.get("items") or []:
        title = str(it.get("title") or "").strip()[:300]
        if not title:
            continue
        refs = [r for r in (it.get("refs") or []) if isinstance(r, int) and 1 <= r <= len(messages)]
        src = [messages[r - 1] for r in refs]
        if src and src[0].get("ts"):
            ts = src[0]["ts"]
        elif src:  # 붙여 넣은 텍스트: 근거 줄 내용으로 키를 만든다
            ts = "text:" + hashlib.sha1(src[0]["text"].encode()).hexdigest()[:16]
        else:
            ts = None
        owner = (str(it.get("owner")).strip() or None) if it.get("owner") else None
        if (ts and (ts, owner) in existing) or (not ts and title in existing_titles):
            continue
        if ts:
            existing.add((ts, owner))
        product = it.get("product") if it.get("product") in products else None
        a = ActionItem(title=title, detail=(it.get("detail") or None), owner=owner,
                       due=_parse_date(it.get("due")), product=product, source=source, source_ts=ts,
                       source_text="\n".join((f"{m['user']}: " if m["user"] else "") + m["text"] for m in src)[:4000] or None,
                       created_by=user.name)
        db.add(a)
        created.append(a)
    db.commit()
    return created


# ---------- API ----------
router = APIRouter(prefix="/api/actions", tags=["actions"], dependencies=[Depends(auth.current_user)])


def out(a: ActionItem) -> dict:
    link = (f"https://slack.com/archives/{CHANNEL}/p{a.source_ts.replace('.', '')}"
            if a.source == "slack" and a.source_ts and not a.source_ts.startswith("text:") else None)
    return {"id": a.id, "title": a.title, "detail": a.detail, "owner": a.owner,
            "due": a.due.isoformat() if a.due else None, "product": a.product, "status": a.status,
            "source": a.source, "source_text": a.source_text, "source_link": link,
            "created_by": a.created_by, "created_at": a.created_at.isoformat() if a.created_at else None}


@router.get("")
def list_actions(db: Session = Depends(get_db)):
    q = select(ActionItem).order_by(ActionItem.due.is_(None), ActionItem.due, ActionItem.id.desc())
    return [out(a) for a in db.scalars(q)]


@router.get("/sources")
def sources(db: Session = Depends(get_db)):
    sync = db.get(ActionSync, CHANNEL)
    return {"llm": llm.configured(), "model": llm.MODEL, "slack": bool(BOT_TOKEN), "channel": CHANNEL,
            "last_synced": datetime.fromtimestamp(float(sync.last_ts)).isoformat(timespec="minutes") if sync else None}


class SlackIn(BaseModel):
    days: int = Field(default=7, ge=1, le=90)  # 처음 가져올 때 며칠 전부터
    full: bool = False  # True면 마지막 동기화 무시하고 days 전부터 다시


@router.post("/extract/slack")
def extract_slack(body: SlackIn, db: Session = Depends(get_db), user: auth.User = Depends(auth.current_user)):
    if not BOT_TOKEN:
        raise HTTPException(400, "Slack 봇 토큰 없음: backend/.env에 SLACK_BOT_TOKEN(xoxb-, channels:history 권한)을 넣고 "
                                 "봇을 채널에 초대하세요. 웹훅으로는 메시지를 읽을 수 없습니다.")
    sync = db.get(ActionSync, CHANNEL)
    oldest = time.time() - body.days * 86400
    if sync and not body.full:
        oldest = float(sync.last_ts)
    raw = fetch_slack(oldest)
    msgs = [{**m, "date": datetime.fromtimestamp(float(m["ts"])).date()} for m in raw]
    created = extract(db, msgs, "slack", user)
    if raw:
        if sync is None:
            db.add(ActionSync(channel=CHANNEL, last_ts=raw[-1]["ts"]))
        elif float(raw[-1]["ts"]) > float(sync.last_ts):
            sync.last_ts = raw[-1]["ts"]
        db.commit()
    return {"messages": len(raw), "created": [out(a) for a in created]}


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=50000)


@router.post("/extract/text")
def extract_text(body: TextIn, db: Session = Depends(get_db), user: auth.User = Depends(auth.current_user)):
    """Slack 대화를 복사해 붙여 넣은 텍스트(또는 회의록)에서 추출"""
    lines = [ln.strip() for ln in body.text.splitlines() if ln.strip()]
    msgs = [{"ts": None, "user": "", "text": ln, "date": _line_date(ln)} for ln in lines]
    created = extract(db, msgs, "text", user)
    return {"messages": len(msgs), "created": [out(a) for a in created]}


class ActionPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    owner: str | None = None
    due: date | None = None
    status: str | None = None
    product: str | None = None


@router.patch("/{aid}")
def patch_action(aid: int, body: ActionPatch, db: Session = Depends(get_db)):
    a = db.get(ActionItem, aid)
    if a is None:
        raise HTTPException(404, "Action Item 없음")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(400, f"상태는 {', '.join(STATUSES)} 중 하나")
    for k, v in data.items():
        setattr(a, k, v.strip() if isinstance(v, str) else v)
    db.commit()
    return out(a)


@router.delete("/{aid}")
def delete_action(aid: int, db: Session = Depends(get_db)):
    a = db.get(ActionItem, aid)
    if a is None:
        raise HTTPException(404, "Action Item 없음")
    db.delete(a)
    db.commit()
    return {"deleted": aid}
