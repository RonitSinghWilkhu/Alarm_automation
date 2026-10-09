from backend.database import engine,Base
from backend.models import(
    Ticket,
    TicketEvent,
    Team,
    User,
    PasswordResetToken,
    RefreshToken,
    AuthRateLimit
)
print("Creating db tables...")

Base.metadata.create_all(
    bind=engine
)

print("Database tables created successfully.")