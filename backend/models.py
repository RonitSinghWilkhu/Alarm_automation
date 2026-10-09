from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text
)
from sqlalchemy.orm import relationship
from backend.database import Base


class Team(Base):
    __tablename__ = "teams"
    id = Column(
        Integer,
        primary_key=True,
        index=True

    )
    name = Column(
        String(100),
        unique=True,
        nullable=False
    )

    tickets = relationship(
        "Ticket",
        back_populates="team"
    )


class Ticket(Base):

    __tablename__ = "tickets"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    ticket_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    node = Column(
        String(100),
        nullable=False
    )

    alarm_type = Column(
        String(100),
        nullable=False
    )

    occurrence_count = Column(
        Integer,
        default=0
    )

    users_impacted = Column(
        Integer,
        default=0
    )

    severity = Column(
        String(50)
    )

    threshold_breached = Column(
        Boolean,
        default=False
    )

    impact_level = Column(
        String(50)
    )

    priority = Column(
        String(10),
        nullable=False
    )

    assigned_team_id = Column(
        Integer,
        ForeignKey("teams.id")
    )

    status = Column(
        String(30),
        nullable=False,
        default="OPEN"
    )

    reason = Column(
        Text
    )

    created_at = Column(
        DateTime
    )

    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now
    )

    closed_at = Column(
        DateTime
    )

    reopened_at = Column(
        DateTime
    )

    team = relationship(
        "Team",
        back_populates="tickets"
    )

    events = relationship(
        "TicketEvent",
        back_populates="ticket",
        cascade="all, delete-orphan"
    )


class TicketEvent(Base):

    __tablename__ = "ticket_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    ticket_id = Column(
        Integer,
        ForeignKey("tickets.id"),
        nullable=False,
        index=True
    )

    event_type = Column(
        String(50),
        nullable=False
    )

    previous_priority = Column(
        String(10)
    )

    new_priority = Column(
        String(10)
    )

    priority = Column(
        String(10)
    )

    reason = Column(
        Text
    )

    status = Column(
        String(30)
    )

    timestamp = Column(
        DateTime,
        nullable=False,
        default=datetime.now
    )

    ticket = relationship(
        "Ticket",
        back_populates="events"
    )

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name = Column(
        String(120),
        nullable=False
    )

    username = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.now
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now
    )

    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    refresh_tokens = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index = True
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.now
    )

    expires_at = Column(
        DateTime,
        nullable=False,
        index=True
    )

    used = Column(
        Boolean,
        nullable=False,
        default=False
    )

    user = relationship(
        "User",
        back_populates="password_reset_tokens"
    )

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id= Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index = True
    )

    token_hash= Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.now
    )

    expires_at = Column(
        DateTime,
        nullable=False,
        index=True
    )

    revoked = Column(
        Boolean,
        nullable=False,
        default=False
    )

    user = relationship(
        "User",
        back_populates="refresh_tokens"
    )

class AuthRateLimit(Base):

    __tablename__ = "auth_rate_limits"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    rate_limit_key = Column(
        String(255),
        nullable=False,
        index=True
    )
    action = Column(
        String(30),
        nullable=False,
        index=True
    )

    attempt_count = Column(
        Integer,
        nullable=False,
        default=0
    )

    window_started_at = Column(
        DateTime,
        nullable=False,
        default=datetime.now
    )

    locked_until = Column(
        DateTime
    )