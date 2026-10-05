from fastapi import(
    APIRouter,
    Depends,
    HTTPException,
    Response,
    Request
)
from datetime import datetime
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, PasswordResetToken, UserSession
from backend.security import(
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    SESSION_COOKIE_SECURE,

    LOGIN_MAX_ATTEMPTS,
    LOGIN_WINDOW_MINUTES,
    LOGIN_LOCKOUT_MINUTES,

    REGISTER_MAX_ATTEMPTS,
    REGISTER_WINDOW_MINUTES,

    FORGOT_PASSWORD_MAX_ATTEMPTS,
    FORGOT_PASSWORD_WINDOW_MINUTES,

    authenticate_user,
    check_rate_limit,
    create_session,
    record_rate_limit_attempt,
    reset_rate_limit,
    get_current_user,
    hash_password,
    revoke_session,
    verify_password,
    create_password_reset_token,
    hash_reset_token
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

class RegisterRequest(BaseModel):
    full_name: str
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post(
    "/register",
    status_code=201
)
def register(
    request: RegisterRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):

    client_ip = (
        http_request.client.host
        if http_request.client
        else "unknown"
    )

    allowed = check_rate_limit(
        db,
        client_ip,
        "REGISTER",
        REGISTER_MAX_ATTEMPTS,
        REGISTER_WINDOW_MINUTES
    )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many registration attempts. Please try again later."
        )

    record_rate_limit_attempt(
        db,
        client_ip,
        "REGISTER",
    )

    full_name = request.full_name.strip()
    username = request.username.strip().lower()
    email= request.email.strip().lower()
    password = request.password

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Full name is required"
        )

    if len(username) <3:
        raise HTTPException(
            status_code=400,
            detail="Username must contain at least 3 characters"
        )

    if len(password) <10:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 10 characters"
        )

    existing_username = (
        db.query(User)
        .filter(
            User.username == username
        )
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=409,
            detail="Username already exists"
        )

    existing_email = (
        db.query(User)
        .filter(
            User.email ==  email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email already exists"
        )

    user = User(
        full_name = full_name,
        username= username,
        email=email,
        password_hash = hash_password(password),
        is_active = True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "fullName": user.full_name,
            "username": user.username,
            "email": user.email
        }
    }

@router.post("/login")
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    rate_limit_key = (
        request.identifier.strip().lower()
    )

    allowed = check_rate_limit(
        db,
        rate_limit_key,
        "LOGIN",
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_MINUTES,
        LOGIN_LOCKOUT_MINUTES
    )

    if not allowed:
        raise HTTPException(
            status_code=409,
            detail="Too many login attempts. Please try again later."
        )

    user = authenticate_user(
        db,
        request.identifier,
        request.password
    )

    if not user:
        record_rate_limit_attempt(
            db,
            rate_limit_key,
            "LOGIN"
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid username/email or password"
        )

    reset_rate_limit(
        db,
        rate_limit_key,
        "LOGIN"
    )

    session_token = create_session(
        db,
        user
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/"
    )

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "fullName": user.full_name,
            "username": user.username,
            "email": user.email
        }
    }

@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):

    raw_token = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if raw_token:
        revoke_session(
            db,
            raw_token
        )

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path= "/"
    )

    return {
        "message": "Logout successful"
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(
        get_current_user
    )
):
    return {
        "id": current_user.id,
        "fullName": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email
    }

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    email = request.email.strip().lower()

    allowed = check_rate_limit(
        db,
        email,
        "FORGOT_PASSWORD",
        FORGOT_PASSWORD_MAX_ATTEMPTS,
        FORGOT_PASSWORD_WINDOW_MINUTES
    )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many password reset requests. Please try again later."
        )

    record_rate_limit_attempt(
        db,
        email,
        "FORGOT_PASSWORD"
    )

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return{
            "message": "If an account exists for this email, a rest link has been generated"
        }

    if not user.is_active:
        return {
            "message": "If an account exists for this email, a reset link has been generated"
        }

    reset_token = create_password_reset_token(
        db,
        user
    )

    reset_url = (
        "http://localhost:5173/#/reset-password"
        f"?token={reset_token}"
    )

    print()
    print("====================================")
    print("PASSWORD RESET LINK")
    print("====================================")
    print(reset_url)
    print("====================================")
    print()

    return {
        "message": "If an account exists for this email, a reset link has been generated.",
        "reset_url": reset_url
    }

@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):

    if len(request.new_password) <10 :
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 10 characters"
        )

    token_hash = hash_reset_token(request.token)

    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False
        )
        .first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or already used reset token"
        )

    if reset_token.expires_at <= datetime.now():
        raise HTTPException(
            status_code= 400,
            detail="Reset token has expired"
        )

    user = reset_token.user

    if not user or not user.is_active:
        raise HTTPException(
            status_code= 400,
            detail="User account is inactive"
        )

    user.password_hash = hash_password(
        request.new_password
    )

    reset_token.used = True

    db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.revoked == False
    ).update(
        {
            UserSession.revoked: True
        },
        synchronize_session=False
    )

    db.commit()

    return {
        "message": "Password reset successful"
    }