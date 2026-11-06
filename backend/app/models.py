from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Task(Base):
    """Task 기준 데이터(템플릿). 화면에서 고치지 않고 CSV 가져오기로만 바꾼다."""
    __tablename__ = "npd_tasks"
    no: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    phase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    start_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    basis: Mapped[str] = mapped_column(String(10), default="완료")
    predecessors: Mapped[str | None] = mapped_column(String(200), nullable=True)  # "3,4"
    buffer_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Holiday(Base):
    __tablename__ = "npd_holidays"
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20), default="공휴일")  # 공휴일 | 공동연차
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Product(Base):
    __tablename__ = "npd_products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)  # 「제품A」처럼 바꿔 쓴 이름
    launch_date: Mapped[date] = mapped_column(Date)
    product_type: Mapped[str] = mapped_column(String(20), default="NEW")
    process: Mapped[str] = mapped_column(String(20), default="표준")


class Actual(Base):
    __tablename__ = "npd_actuals"
    __table_args__ = (UniqueConstraint("product_id", "task_no"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("npd_products.id", ondelete="CASCADE"))
    task_no: Mapped[int] = mapped_column(ForeignKey("npd_tasks.no"))
    actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)


class Setting(Base):
    __tablename__ = "npd_settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
