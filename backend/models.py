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