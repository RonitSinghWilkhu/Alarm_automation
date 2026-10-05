from backend.database import engine,Base
from backend.models import(
    Ticket,
    TicketEvent,
    Team,
    User,
    UserSession,
    PasswordResetToken,
    AuthRateLimit
)
print("Creating db tables...")

Base.metadata.create_all(
    bind=engine
)

print("Database tables created successfully.")