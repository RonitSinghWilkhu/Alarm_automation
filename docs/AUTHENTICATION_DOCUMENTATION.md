# Alarm Automation — Authentication Documentation

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Main Authentication Files](#3-main-authentication-files)
4. [JWT and Cookie Configuration](#4-jwt-and-cookie-configuration)
5. [Database Models](#5-database-models)
6. [Registration](#6-registration)
7. [Login and Token Issuance](#7-login-and-token-issuance)
8. [Access-Token Validation](#8-access-token-validation)
9. [Refresh-Token Flow](#9-refresh-token-flow)
10. [Logout and Revocation](#10-logout-and-revocation)
11. [Password Reset](#11-password-reset)
12. [Role-Based Access Control](#12-role-based-access-control)
13. [Frontend Authentication Handling](#13-frontend-authentication-handling)
14. [Rate Limiting](#14-rate-limiting)
15. [Security Properties and Limitations](#15-security-properties-and-limitations)
16. [Configuration Summary](#16-configuration-summary)
17. [Implementation Verification Notes](#17-implementation-verification-notes)
18. [Changelog](#18-changelog)

---

## 1. Purpose and Scope

This document describes the Alarm Automation application's authentication and authorization design as recorded in the supplied project documentation.

The documented system includes:

- User registration.
- Login using a username or email address.
- JWT access tokens and refresh tokens.
- HTTP-only cookies for token transport.
- Database-backed refresh-token tracking and revocation.
- Password-reset tokens.
- Role-based access control for `user` and `admin` roles.
- Rate limiting on authentication-related operations.
- Frontend handling of expired access tokens.

**Important:** This document is not a source-code audit. The current implementations of `backend/security.py`, `backend/auth.py`, `backend/models.py`, and `frontend/src/api/api.js` were not supplied with this authentication document. Implementation-specific claims should be checked against those files before this document is treated as a verified description of the running application.

---

## 2. Authentication Architecture

The application uses two JWT token types:

| Token | Purpose | Documented lifetime | Storage/transport |
|---|---|---:|---|
| Access token | Authenticates protected API requests | 30 minutes | HTTP-only cookie |
| Refresh token | Obtains a new access token | 7 days | HTTP-only cookie; SHA-256 hash stored in the database |

The access token is used for normal API authorization. The refresh token is separately checked against a database record, allowing the application to revoke refresh-token sessions.

### 2.1 Login flow

```text
React Login UI
      |
      v
POST /auth/login
      |
      v
FastAPI validates user credentials
      |
      +----> Generate access JWT
      |
      +----> Generate refresh JWT
      |
      v
Hash refresh token and store its record
      |
      v
Set access-token and refresh-token cookies
      |
      v
Return user information
```

### 2.2 Protected-request flow

```text
React API request
      |
      v
Browser sends cookies with the request
      |
      v
FastAPI get_current_user dependency
      |
      v
Read and validate access JWT
      |
      v
Load user from the database
      |
      v
Check that the user exists and is active
      |
      v
Protected endpoint executes
```

### 2.3 Access-token refresh flow

```text
Protected API request
      |
      v
Backend returns 401
      |
      v
Frontend attempts POST /auth/refresh
      |
      v
Browser sends refresh-token cookie
      |
      v
Backend validates JWT and database token record
      |
      v
Backend issues a new access token
      |
      v
Frontend retries the original request once
```

---

## 3. Main Authentication Files

| File | Documented responsibility |
|---|---|
| `backend/security.py` | JWT creation and validation, password hashing, authentication dependencies, and security-related helpers |
| `backend/auth.py` | FastAPI authentication routes under `/auth/*` and admin user-management routes |
| `backend/models.py` | User, refresh-token, password-reset-token, and rate-limit database models |
| `backend/database.py` | SQLAlchemy database session management |
| `backend/main.py` | Application setup, router registration, and application-level dependencies such as `require_Admin` |
| `frontend/src/api/api.js` | API request wrapper and automatic access-token refresh |
| `frontend/src/App.jsx` | Frontend authentication state and login/session handling |

The exact distribution of functions between these files must be confirmed against the current source code.

---

## 4. JWT and Cookie Configuration

### 4.1 JWT settings

The supplied documentation records the following configuration:

| Setting | Environment variable | Documented value/default | Purpose |
|---|---|---|---|
| Signing secret | `JWT_SECRET_KEY` | Required | Signs and verifies JWTs |
| Algorithm | `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| Access-token lifetime | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` minutes | Access-token expiry |
| Refresh-token lifetime | `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` days | Refresh-token expiry |
| Issuer | `JWT_ISSUER` | `alarmops-api` | Expected JWT `iss` claim |
| Audience | `JWT_AUDIENCE` | `alarmops-client` | Expected JWT `aud` claim |

The signing secret must be kept outside source control and configured securely in the deployment environment.

### 4.2 Cookie names

| Cookie | Documented constant | Purpose |
|---|---|---|
| `alarmops_access_token` | `ACCESS_TOKEN_COOKIE_NAME` | Carries the access JWT |
| `alarmops_refresh_token` | `REFRESH_TOKEN_COOKIE_NAME` | Carries the refresh JWT |

### 4.3 Cookie attributes

The supplied documentation records these attributes:

| Attribute | Documented setting | Meaning |
|---|---|---|
| `HttpOnly` | `true` | Prevents JavaScript from reading the cookie |
| `SameSite` | `Lax` | Restricts some cross-site cookie requests |
| `Secure` | Controlled by `AUTH_COOKIE_SECURE` | Sends the cookie only over HTTPS when enabled |
| `Path` | `/` | Makes the cookie available across application paths |

The earlier documentation states that `AUTH_COOKIE_SECURE` defaults to `true` and may be set to `false` for local HTTP development. Confirm the actual default in the current source code and environment configuration.

`HttpOnly` reduces direct cookie access from JavaScript, but it does not prevent cross-site request forgery by itself. `SameSite=Lax` is also not a substitute for reviewing the application's CSRF exposure and deployment configuration.

---

## 5. Database Models

The authentication documentation identifies the following database models.

### 5.1 `User`

Stores the application's user account and authorization information.

Documented fields:

- `id`
- `full_name`
- `username`
- `email`
- `password_hash`
- `is_active`
- `role`

The documentation states that:

- `username` is unique.
- `email` is unique.
- Passwords are stored as password hashes, not plaintext.
- `role` defaults to `"user"`.
- Supported roles are `"user"` and `"admin"`.

### 5.2 `RefreshToken`

Stores refresh-token metadata so refresh sessions can be checked and revoked.

Documented fields:

- `user_id` — foreign key referencing `users.id`.
- `token_hash` — SHA-256 hash of the raw refresh JWT.
- `created_at`
- `expires_at`
- `revoked`

The raw refresh JWT is not intended to be stored in this table.

### 5.3 `PasswordResetToken`

Stores password-reset token metadata.

Documented fields:

- `user_id`
- `token_hash` — SHA-256 hash of the reset token.
- `expires_at`
- `used`

### 5.4 `AuthRateLimit`

Stores authentication rate-limit state.

Documented fields:

- `rate_limit_key` — identifier used to group attempts, such as an IP address or account identifier.
- `action` — operation being limited, such as login or registration.
- `attempt_count`
- `window_started_at`
- `locked_until`

Confirm the exact model columns, indexes, constraints, and foreign-key behavior against `backend/models.py`.

---

## 6. Registration

**Endpoint:** `POST /auth/register`  
**Authentication:** Not required.

### 6.1 Request body

```json
{
  "full_name": "Example Operator",
  "username": "operator",
  "email": "operator@example.com",
  "password": "StrongPassword123!"
}
```

### 6.2 Documented processing

1. Apply registration rate limiting.
2. Normalize the supplied name, username, and email as implemented by the backend.
3. Validate required fields and configured length rules.
4. Check that the username and email are not already registered.
5. Hash the password.
6. Create the user with the default role `user` and an active account state.
7. Return the created user's public account information.

The supplied authentication document records these validation rules:

- Full name must not be empty.
- Username must contain at least 3 characters.
- Password must contain at least 10 characters.
- Username and email must be unique.

The original document says that the username and email are lowercased and the full name is stripped of surrounding whitespace. Confirm these normalization rules in the request handler before relying on them.

### 6.3 Response

The API documentation supplied separately records a successful registration response in this shape:

```json
{
  "message": "Registration successful",
  "user": {
    "id": 1,
    "fullName": "Example Operator",
    "username": "operator",
    "email": "operator@example.com",
    "role": "user"
  }
}
```

The separate API documentation records `200 OK` for this endpoint. The earlier authentication document recorded `201 Created`; that status-code conflict must be resolved against the actual route implementation. Do not treat `201` as verified.

---

## 7. Login and Token Issuance

**Endpoint:** `POST /auth/login`  
**Authentication:** Not required.

### 7.1 Request body

```json
{
  "identifier": "operator",
  "password": "StrongPassword123!"
}
```

The documented `identifier` field accepts either a username or an email address.

### 7.2 Documented processing

1. Apply login rate limiting.
2. Normalize the identifier as implemented by the backend.
3. Find the user by username or email.
4. Verify the supplied password against the stored password hash.
5. Reject authentication if the credentials are invalid or the account is inactive.
6. Generate an access JWT and a refresh JWT.
7. Hash the refresh JWT and store the hash in the `refresh_tokens` table.
8. Set the access and refresh JWTs as HTTP-only cookies.
9. Reset the relevant login rate-limit state after successful authentication, if implemented by the current handler.
10. Return the authenticated user's public information.

The earlier authentication document describes a dummy password hash check when a username/email is not found. This is a timing-attack mitigation claim and must be verified in `authenticate_user()` before being treated as a guaranteed implementation detail.

### 7.3 Documented access-token claims

The supplied documentation lists these access-token claims:

- `sub` — user identifier.
- `type` — token type, expected to be `access`.
- `iat` — issued-at time.
- `exp` — expiry time.
- `iss` — issuer.
- `aud` — audience.
- `jti` — unique token identifier.

The refresh token is also described as a JWT with a refresh token type and a longer expiry. Its complete claim set should be confirmed in the token-generation function.

### 7.4 Response

The API documentation records a successful login response in this shape:

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "fullName": "Example Operator",
    "username": "operator",
    "email": "operator@example.com",
    "role": "user"
  }
}
```

The tokens are transported through response cookies; they are not shown in the JSON response.

---

## 8. Access-Token Validation

Protected endpoints use the `get_current_user` dependency.

### 8.1 Documented validation sequence

1. Read the access-token cookie.
2. Reject the request if the cookie is missing.
3. Decode and validate the JWT.
4. Verify the JWT signature using the configured signing secret and algorithm.
5. Validate the issuer and audience claims.
6. Validate token expiry.
7. Verify that the token type is `access`.
8. Extract the subject (`sub`) identifying the user.
9. Load the corresponding user from the database.
10. Reject the request if the user does not exist or is inactive.
11. Return the authenticated `User` object to the endpoint.

### 8.2 Authentication failure

A missing, invalid, expired, or otherwise unacceptable access token results in an unauthorized response (`401`), according to the documented authentication behavior.

### 8.3 Admin authorization

Authentication and authorization are separate checks:

- Authentication establishes which user is making the request.
- Authorization checks whether that user has permission to perform the requested operation.

An authenticated non-admin user must not be allowed to access admin-only endpoints.

---

## 9. Refresh-Token Flow

**Endpoint:** `POST /auth/refresh`  
**Authentication:** Refresh-token cookie.

### 9.1 Documented processing

1. Read the `alarmops_refresh_token` cookie.
2. Reject the request if the cookie is missing.
3. Decode and validate the refresh JWT, including its signature and expiry.
4. Verify that the token is a refresh token, not an access token.
5. Hash the raw refresh token.
6. Find the matching record in the `refresh_tokens` table.
7. Reject the token if its record is missing or revoked.
8. Check the stored database expiry.
9. Load the associated user and ensure the account is active.
10. Generate a new access token.
11. Set the new access-token cookie.

### 9.2 Response

The separate API documentation records this response:

```json
{
  "message": "Token refreshed"
}
```

The earlier authentication document used `"Access token refreshed"`. Use the response string from the current route implementation as the final authority.

### 9.3 Refresh-token rotation

The supplied documents do not establish that refresh tokens are rotated on every refresh. They establish that a new access token is issued and that refresh tokens are stored in the database in hashed form.

Do not document refresh-token rotation as an implemented behavior unless the current `/auth/refresh` handler replaces or rotates the refresh-token record and sets a replacement refresh cookie.

### 9.4 Frontend retry behavior

The frontend API wrapper is documented as attempting a refresh after a `401` response and retrying the original request once after a successful refresh. It should not retry indefinitely.

---

## 10. Logout and Revocation

**Endpoint:** `POST /auth/logout`  
**Authentication:** Refresh-token cookie, according to the supplied API documentation.

### 10.1 Documented processing

1. Read the refresh-token cookie.
2. Hash the raw refresh token.
3. Find the corresponding refresh-token record.
4. Mark the record as revoked when a matching record exists.
5. Clear the access-token and refresh-token cookies in the response.
6. Return a logout confirmation.

### 10.2 Response

```json
{
  "message": "Logout successful"
}
```

Clearing cookies removes them from the browser. Revoking the refresh-token record prevents that refresh token from being used again.

The supplied documentation does not establish that logout immediately invalidates an already-issued access JWT. Unless access-token revocation or a denylist is implemented, an access JWT may remain cryptographically valid until it expires. Confirm the actual behavior in the backend.

---

## 11. Password Reset

The password-reset flow uses two endpoints.

### 11.1 Request a reset

**Endpoint:** `POST /auth/forgot-password`  
**Authentication:** Not required.

Request body:

```json
{
  "email": "operator@example.com"
}
```

Documented behavior:

1. Apply password-reset rate limiting.
2. Look up the account associated with the email address.
3. Generate a random reset token for an eligible account.
4. Hash the token using SHA-256.
5. Store the token hash with an expiry.
6. Make the reset URL available to the user through the currently documented delivery mechanism.

The supplied documentation states that the reset URL is printed to the backend console in development and that an external email service is not integrated.

The API response is documented as a generic message:

```json
{
  "message": "If the account exists, a password reset link has been generated."
}
```

A generic response helps avoid disclosing whether a particular email address is registered.

### 11.2 Complete a reset

**Endpoint:** `POST /auth/reset-password`  
**Authentication:** A valid reset token is required.

Request body:

```json
{
  "token": "<reset-token>",
  "new_password": "NewStrongPassword456!"
}
```

Documented processing:

1. Hash the supplied reset token.
2. Find the matching reset-token record.
3. Verify that the token exists, is unused, and has not expired.
4. Hash the new password.
5. Update the user's stored password hash.
6. Mark the reset token as used.
7. Invalidate existing refresh-token sessions if the current implementation performs this step.

The earlier authentication document states that all active refresh tokens for the user are revoked after a password reset. This is an important security behavior, but it must be confirmed in the current reset handler before being treated as verified.

### 11.3 Reset-token lifetime

The supplied documentation records a 30-minute password-reset-token lifetime. Confirm the actual expiry constant in the backend configuration.

---

## 12. Role-Based Access Control

The documented application supports two roles:

| Role | Documented access |
|---|---|
| `user` | Standard authenticated application operations |
| `admin` | Standard operations plus admin-only user management and RAG evaluation operations |

### 12.1 `get_current_user`

This dependency authenticates the request and returns the corresponding active user.

### 12.2 `require_Admin`

The supplied documentation describes `require_Admin` as a dependency that calls `get_current_user` and checks whether the user's role is `admin`.

Conceptual behavior:

```python
def require_Admin(current_user):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user
```

This is an explanatory example, not a verified copy of the project's exact function signature.

### 12.3 Admin-only endpoints

The API documentation identifies these admin-only endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/users` | List registered users |
| `PATCH` | `/auth/users/{user_id}/role` | Change a user's role |
| `POST` | `/api/evaluate/run` | Run RAG evaluation |
| `GET` | `/api/evaluate/history` | Retrieve RAG evaluation history |

### 12.4 Last-admin protection

The supplied documentation states that role updates prevent demoting the last active admin.

This protects against a configuration in which no administrator remains. The exact database query and concurrency behavior should be reviewed in the role-update handler.

---

## 13. Frontend Authentication Handling

The frontend API layer is located at:

`frontend/src/api/api.js`

The supplied documentation describes an `authenticatedFetch()` wrapper that:

1. Sends requests with `credentials: "include"` so the browser includes cookies.
2. Returns responses that are not `401`.
3. Attempts `POST /auth/refresh` after a `401`.
4. Retries the original request once if refresh succeeds.
5. Treats a failed refresh as an unauthenticated session.

### 13.1 Conceptual request flow

```text
Component calls API function
      |
      v
authenticatedFetch()
      |
      v
fetch(url, { credentials: "include" })
      |
      v
Is response status 401?
      |
      +---- No ----> Return response
      |
      +---- Yes ---> Attempt refresh
                         |
                         v
                  Did refresh succeed?
                         |
                +--------+--------+
                |                 |
               Yes                No
                |                 |
                v                 v
        Retry original       Return/raise
        request once         unauthorized state
```

### 13.2 Unauthorized handling

The earlier documentation states that the frontend uses the error string `UNAUTHORIZED` to signal that the session is no longer valid and that `App.jsx` returns the user to the login screen.

The exact point where this error is thrown must be checked in the current `api.js` implementation. A plain `401` response and a thrown `UNAUTHORIZED` error are not interchangeable; the wrapper must explicitly implement the conversion if the application relies on that sentinel.

### 13.3 Cookie handling

The frontend does not need to read the HTTP-only token values. The browser sends the cookies when requests use `credentials: "include"` and the cookie/CORS configuration permits them.

Do not store these authentication tokens in `localStorage` as a substitute for the documented HTTP-only cookie flow.

---

## 14. Rate Limiting

The supplied authentication documentation records these limits:

| Action | Maximum attempts | Window | Lockout |
|---|---:|---:|---:|
| `LOGIN` | 5 | 15 minutes | 15 minutes |
| `REGISTER` | 5 | 15 minutes | None documented |
| `FORGOT_PASSWORD` | 3 | 15 minutes | None documented |

The rate-limit state is documented as being tracked using a key and an action, with fields for attempt count, window start, and lockout expiry.

### 14.1 Response status

The API documentation uses `429 Too Many Requests` for rate-limit failures. The earlier authentication document also mentioned `409` for login throttling, creating a conflict.

This revised document uses `429` as the documented rate-limit status. Confirm the exact status raised by each route in the current source code. Do not assume every authentication route uses identical rate-limit behavior.

---

## 15. Security Properties and Limitations

### 15.1 Documented security measures

| Measure | Purpose |
|---|---|
| Password hashing | Avoids storing plaintext passwords |
| Argon2-compatible password hashing | Uses the password-hashing configuration described as `pwdlib` |
| JWT signature verification | Detects invalid or tampered tokens |
| Issuer and audience validation | Restricts acceptance to tokens with expected claims |
| Token-type validation | Separates access tokens from refresh tokens |
| Refresh-token hashing | Avoids storing raw refresh JWTs in the database |
| Refresh-token revocation | Allows refresh sessions to be invalidated |
| HTTP-only cookies | Prevents ordinary JavaScript access to cookie values |
| Account active-state check | Prevents inactive accounts from authenticating |
| Role checks | Restricts admin-only operations |
| Rate limiting | Reduces repeated authentication attempts |

### 15.2 Important limitations

- HTTP-only cookies reduce token exposure to JavaScript but do not eliminate the consequences of cross-site scripting.
- `SameSite=Lax` is not a complete CSRF defense for every deployment or request pattern.
- HTTPS should be enforced in production, with secure cookies enabled.
- Password-reset links printed to a backend console are a development mechanism, not production email delivery.
- Database-backed refresh-token revocation does not automatically prove immediate access-token revocation.
- JWT signing secrets must be strong, private, and consistently configured across backend instances.
- Rate limits should be tested behind the actual reverse proxy so client IP identification cannot be trivially spoofed.
- The authentication implementation should receive a security review before production use.

---

## 16. Configuration Summary

| Setting | Documented value |
|---|---|
| Access-token cookie | `alarmops_access_token` |
| Refresh-token cookie | `alarmops_refresh_token` |
| Access-token lifetime | 30 minutes |
| Refresh-token lifetime | 7 days |
| JWT algorithm | `HS256` |
| JWT issuer | `alarmops-api` |
| JWT audience | `alarmops-client` |
| Password-reset token lifetime | 30 minutes |
| Cookie `HttpOnly` | `true` |
| Cookie `SameSite` | `Lax` |
| Cookie `Secure` | Controlled by `AUTH_COOKIE_SECURE` |
| Minimum username length | 3 characters |
| Minimum password length | 10 characters |
| Default role | `user` |
| Login rate limit | 5 attempts per 15 minutes |
| Registration rate limit | 5 attempts per 15 minutes |
| Forgot-password rate limit | 3 attempts per 15 minutes |

Values in this table are those recorded in the supplied documentation. Verify them against the current source code and deployed environment before treating them as authoritative runtime configuration.

---

## 17. Implementation Verification Notes

The following points cannot be conclusively settled from the supplied authentication document alone. They should be checked in the current project source before this document is labelled fully synchronized with the implementation.

| Item | What must be checked |
|---|---|
| Registration status | Whether `POST /auth/register` returns `200` or `201` |
| Refresh response text | Exact message returned by `POST /auth/refresh` |
| Cookie secure default | Default value and environment parsing for `AUTH_COOKIE_SECURE` |
| Password normalization | Exact username, email, and full-name normalization |
| Password validation | Exact password policy and validation error responses |
| Dummy password verification | Whether unknown-user login performs dummy hash verification |
| Refresh-token rotation | Whether refresh replaces the refresh token or only issues a new access token |
| Logout semantics | Whether logout revokes only the refresh token or also invalidates access tokens |
| Password-reset invalidation | Whether all active refresh tokens are revoked after password reset |
| Rate-limit responses | Exact status codes and lockout behavior for each authentication route |
| Token claims | Exact claims included in access and refresh JWTs |
| Rate-limit key | Whether limits are keyed by IP, identifier, or a combination |
| Admin protection | Exact last-active-admin check and its transaction/concurrency behavior |
| Frontend unauthorized flow | Exact behavior after refresh failure and the location where `UNAUTHORIZED` is raised |

Do not remove this verification section until these points have been checked against the implementation.

---

## 18. Changelog

### Version 2.1 — November 03, 2026

**Corrected**
- Clarified that JWT access tokens coexist with database-backed refresh-token records.
- Removed the unsupported claim that refresh-token rotation definitely occurs.
- Distinguished cookie clearing from server-side token revocation.
- Clarified the difference between authentication (`get_current_user`) and authorization (`require_Admin`).
- Corrected the frontend refresh description so a request is retried at most once.
- Clarified that HTTP-only and `SameSite` cookie settings do not establish complete CSRF protection.
- Removed the contradictory claim that login rate limiting may return `409`; `429` is used as the documented rate-limit response, pending source verification.
- Recorded the registration status-code and refresh-response-message discrepancies rather than presenting conflicting values as facts.
- Added an implementation-verification checklist for details that cannot be confirmed from the supplied document.

**Retained**
- The documented dual-token architecture.
- The documented token lifetimes, JWT configuration, cookie names, database model descriptions, role names, rate-limit values, and password-reset flow.
- The documented authentication and admin endpoint paths.

---

## Disclaimer

This authentication documentation describes a personal/educational Alarm Automation prototype. It is not a security certification or production-readiness assessment. Production deployment requires source-code verification, secure secret management, HTTPS enforcement, review of cookie and CSRF behavior, appropriate email delivery for password resets, operational rate-limit testing, and an independent security review.