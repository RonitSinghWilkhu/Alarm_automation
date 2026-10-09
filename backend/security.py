import hashlib
import os
import secrets
from datetime import datetime,timedelta, timezone

import jwt
from fastapi import Depends,HTTPException,Request
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import(
    User,
    PasswordResetToken,
    AuthRateLimit,
    RefreshToken
)

password_hasher = PasswordHash.recommended()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES" , "30"))

JWT_REFRESH_TOKEN_EXPIRE_DAYS = int (os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

JWT_ISSUER = os.getenv(
    "JWT_ISSUER",
    "alarmops-api"
)

JWT_AUDIENCE = os.getenv(
    "JWT_AUDIENCE",
    "alarmops-client"
)

ACCESS_TOKEN_COOKIE_NAME = "alarmops_access_token"
REFRESH_TOKEN_COOKIE_NAME = "alarmops_refresh_token"

AUTH_COOKIE_SECURE = (
    os.getenv(
        "AUTH_COOKIE_SECURE",
        "true"
    ).lower() == "true"
)

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not configured.")

RESET_TOKEN_EXPIRE_MINUTES = 30

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_MINUTES = 15
LOGIN_LOCKOUT_MINUTES = 15

REGISTER_MAX_ATTEMPTS = 5
REGISTER_WINDOW_MINUTES = 15

FORGOT_PASSWORD_MAX_ATTEMPTS = 3
FORGOT_PASSWORD_WINDOW_MINUTES = 15

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

def hash_reset_token(token:str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def hash_refresh_token(token:str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

def store_refresh_token(
        db:Session,
        user:User,
        raw_token:str
) -> RefreshToken:
    payload = decode_token(raw_token,"refresh")
    now= datetime.now(timezone.utc)

    expires_at = datetime.fromtimestamp(
        payload["exp"],
        tz=timezone.utc
    ).replace(tzinfo=None)

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash= hash_refresh_token(raw_token),
        created_at=now.replace(tzinfo=None),
        expires_at = expires_at,
        revoked=False
    )

    db.add(refresh_record)
    db.commit()
    db.refresh(refresh_record)

    return refresh_record

def validate_refresh_token(
        db:Session,
        raw_token: str
) -> User:
    payload = decode_token(raw_token,"refresh")

    try:
        user_id = int(payload["sub"])

    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token subject"
        )

    token_hash = hash_refresh_token(raw_token)

    refresh_record = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked.is_(False)
        )
        .first()
    )

    if not refresh_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid or revoked refresh token"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if refresh_record.expires_at <= now:
        refresh_record.revoked = True
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Refresh token expired"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User not found or inactive"
        )

    return user

def revoke_refresh_token(
        db:Session,
        raw_token: str
) -> None:
    token_hash = hash_refresh_token(raw_token)

    refresh_record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )

    if refresh_record and not refresh_record.revoked:
        refresh_record.revoked = True
        db.commit()

def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "type": "access",
        "iat": now,
        "exp": now+timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": secrets.token_urlsafe(16)
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm = JWT_ALGORITHM
    )

def create_refresh_token(user: User) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days = JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": secrets.token_urlsafe(16)
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm = JWT_ALGORITHM
    )

def decode_token(
        token: str,
        expected_type: str
):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms = [JWT_ALGORITHM],
            issuer = JWT_ISSUER,
            audience = JWT_AUDIENCE
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token Expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=401,
            detail="Invalid token type"
        )

    if not payload.get("sub"):
        raise HTTPException(
            status_code=401,
            detail="Invalid token subject"
        )

    return payload

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

    access_token = request.cookies.get(
        ACCESS_TOKEN_COOKIE_NAME
    )

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    payload = decode_token(access_token,"access")

    try:
        user_id = int(payload["sub"])
    except (TypeError , ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid token subject"
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is inactive"
        )

    return user

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
