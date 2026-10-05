import hashlib
import os
import secrets
from datetime import datetime,timedelta
from fastapi import Depends,HTTPException,Request
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import(
    User,
    UserSession,
    PasswordResetToken,
    AuthRateLimit
)

password_hasher = PasswordHash.recommended()
SESSION_COOKIE_NAME = "alarmops_session"
SESSION_EXPIRE_HOURS = 8
SESSION_MAX_AGE = SESSION_EXPIRE_HOURS*60*60
SESSION_COOKIE_SECURE = (
    os.getenv(
        "AUTH_COOKIE_SECURE",
        "true"
    ).lower()=="true"
)
RESET_TOKEN_EXPIRE_MINUTES = 30

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_MINUTES = 15
LOGIN_LOCKOUT_MINUTES = 15

REGISTER_MAX_ATTEMPTS = 5
REGISTER_WINDOW_MINUTES = 15

FORGOT_PASSWORD_MAX_ATTEMPTS = 3
FORGOT_PASSWORD_WINDOW_MINUTES = 15

SESSION_IDLE_TIMEOUT_MINUTES = 60

DUMMY_PASSWORD_HASH = password_hasher.hash(
    "dummy-password-for-timing-protection"
)

def hash_password(password: str) -> str:
    return password_hasher.hash(
        password
    )

def verify_password(
        password: str,
        password_hash: str
) -> bool:
    return password_hasher.verify(
        password,
        password_hash
    )

def hash_session_token(
        token: str,
) -> str:

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

def hash_reset_token(token:str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_session(
        db: Session,
        user: User
) -> str:

    purge_expired_sessions(db)

    raw_token = secrets.token_urlsafe(32)

    token_hash = hash_session_token(raw_token)

    now = datetime.now()

    session = UserSession(
        user_id = user.id,
        session_token_hash = token_hash,
        created_at = now,
        expires_at = (
            now+
            timedelta(
                hours=SESSION_EXPIRE_HOURS
            )
        ),
        last_activity = now,
        revoked = False
    )

    db.add(session)
    db.commit()
    return raw_token

def check_rate_limit(
        db: Session,
        rate_limit_key: str,
        action: str,
        max_attempts: int,
        window_minutes: int,
        lockout_minutes: int = 0
):

    now = datetime.now()

    rate_limit = (
        db.query(AuthRateLimit)
        .filter(
            AuthRateLimit.rate_limit_key == rate_limit_key,
            AuthRateLimit.action == action
        )
        .first()
    )

    if not rate_limit:

        rate_limit = AuthRateLimit(
            rate_limit_key=rate_limit_key,
            action=action,
            attempt_count=0,
            window_started_at=now
        )

        db.add(rate_limit)
        db.commit()
        db.refresh(rate_limit)

    if rate_limit.locked_until:

        if rate_limit.locked_until > now:

            return False

        rate_limit.locked_until = None
        rate_limit.attempt_count = 0
        rate_limit.window_started_at = now

    elapsed_seconds = (
        now - rate_limit.window_started_at
    ).total_seconds()

    if elapsed_seconds >= window_minutes * 60:

        rate_limit.attempt_count = 0
        rate_limit.window_started_at = now
        rate_limit.locked_until = None

    if rate_limit.attempt_count >= max_attempts:

        if lockout_minutes > 0:

            rate_limit.locked_until = (
                now +
                timedelta(
                    minutes=lockout_minutes
                )
            )

            db.commit()

        return False

    return True

def record_rate_limit_attempt(
        db: Session,
        rate_limit_key: str,
        action: str
):

    rate_limit = (
        db.query(AuthRateLimit)
        .filter(
            AuthRateLimit.rate_limit_key == rate_limit_key,
            AuthRateLimit.action == action
        )
        .first()
    )

    if not rate_limit:
        return

    rate_limit.attempt_count += 1

    db.commit()

def reset_rate_limit(
        db: Session,
        rate_limit_key: str,
        action: str
):

    rate_limit = (
        db.query(AuthRateLimit)
        .filter(
            AuthRateLimit.rate_limit_key == rate_limit_key,
            AuthRateLimit.action == action
        )
        .first()
    )

    if not rate_limit:
        return

    rate_limit.attempt_count = 0
    rate_limit.window_started_at = datetime.now()
    rate_limit.locked_until = None

    db.commit()

def authenticate_user(
        db:Session,
        identifier: str,
        password: str
):

    normalized_identifier = (
        identifier.strip().lower()
    )

    user = (
        db.query(User)
        .filter(
            (
                User.username == normalized_identifier
            )
            |
            (
                User.email == normalized_identifier
            )
        )
        .first()
    )

    if not user:

        verify_password(
            password,
            DUMMY_PASSWORD_HASH
        )
        return None

    if not verify_password(
        password,
        user.password_hash
    ):
        return None

    if not user.is_active:
        return None

    return user

def get_current_user(
        request: Request,
        db: Session = Depends(get_db)
) -> User:

    raw_token = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if not raw_token:

        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    token_hash = hash_session_token(raw_token)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_token_hash == token_hash,
            UserSession.revoked == False
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid sessions"
        )

    now = datetime.now()

    if session.expires_at <= now:
        session.revoked=True
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="session expired"
        )

    if session.last_activity + timedelta(
        minutes=SESSION_IDLE_TIMEOUT_MINUTES
    ) <= now:
        session.revoked = True
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Session expired due to inactivity."
        )

    user= session.user

    if not user or not user.is_active:

        session.revoked = True
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="User account is inactive"
        )

    session.last_activity = now
    db.commit()

    return user

def revoke_session(
        db: Session,
        raw_token: str
):

    token_hash = hash_session_token(raw_token)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_token_hash == token_hash
        )
        .first()
    )

    if session:

        session.revoked = True
        db.commit()

def create_password_reset_token(
        db: Session,
        user: User
) -> str:

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_reset_token(raw_token)
    now=datetime.now()

    reset_token = PasswordResetToken(
        user_id = user.id,
        token_hash = token_hash,
        created_at = now,
        expires_at = (
            now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        ),
        used= False
    )

    db.add(reset_token)
    db.commit()
    return raw_token

def purge_expired_sessions(db: Session):
    now = datetime.now()
    idle_cutoff = now - timedelta(
        minutes=SESSION_IDLE_TIMEOUT_MINUTES
    )

    db.query(UserSession).filter(
        (
            UserSession.expires_at <= now
        )
        |
        (
            UserSession.last_activity <= idle_cutoff
        )
    ).delete(
        synchronize_session=False
    )

    db.commit()