# AUTHENTICATION DOCUMENTATION

## 1. Purpose

The current authentication system provides:

-   User registration.
-   Login using username or email.
-   Server-side session creation.
-   Session-cookie authentication.
-   Authentication checking through `/auth/me`.
-   Logout and session revocation.
-   Password reset token generation.
-   Password reset.
-   Session invalidation after password reset.
-   Protection of authenticated FastAPI endpoints through
    `get_current_user`.

The authentication implementation is split between the FastAPI backend
and the React frontend.

------------------------------------------------------------------------

## 2. Authentication Architecture

The current flow is:

``` text
React Login/Register UI
        |
        v
frontend/src/api/api.js
        |
        v
FastAPI /auth endpoints
        |
        +--------------------+
        |                    |
        v                    v
     User table          UserSession table
        |
        v
   PostgreSQL
```

For password reset:

``` text
Forgot Password
      |
      v
/forgot-password
      |
      v
PasswordResetToken
      |
      v
Reset URL / token
      |
      v
/reset-password
      |
      v
User.password_hash updated
      |
      v
Existing sessions revoked
```

------------------------------------------------------------------------

## 3. Main Authentication Files

  -------------------------------------------------------------------------
  File                                  Responsibility
  ------------------------------------- -----------------------------------
  `backend/auth.py`                     Authentication API endpoints

  `backend/security.py`                 Password hashing, authentication,
                                        session
                                        creation/validation/revocation,
                                        reset-token creation

  `backend/models.py`                   `User`, `UserSession`, and
                                        `PasswordResetToken` database
                                        models

  `backend/database.py`                 SQLAlchemy database session

  `main.py`                             Registers the authentication router
                                        and protects application endpoints

  `frontend/src/api/api.js`             Frontend authentication API calls

  `frontend/src/App.jsx`                Authentication state and
                                        authenticated/unauthenticated
                                        application flow

  `frontend/src/components/Login.jsx`   Login form

  `Register.jsx`                        Registration UI

  `ForgotPassword.jsx`                  Password-reset request UI

  `ResetPassword.jsx`                   New-password UI
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 4. Backend Security Configuration

`backend/security.py` defines the authentication security configuration.

### Password hashing

The implementation creates:

``` python
password_hasher = PasswordHash.recommended()
```

Password hashes are generated with:

``` text
hash_password()
```

and checked with:

``` text
verify_password()
```

The application therefore does not store the user's original password in
the `User` table.

------------------------------------------------------------------------

## 5. Session Configuration

The session cookie name is:

``` text
alarmops_session
```

The session lifetime is:

``` text
8 hours
```

because:

``` text
SESSION_EXPIRE_HOURS = 8
```

The cookie max age is calculated as:

``` text
8 × 60 × 60 seconds
```

The cookie's `secure` setting is controlled by:

``` text
AUTH_COOKIE_SECURE
```

from the environment.

If that environment variable is not set to `"true"`, the current code
uses:

``` text
secure = false
```

The cookie is configured with:

``` text
HttpOnly = true
SameSite = lax
Path = /
```

------------------------------------------------------------------------

# 6. User Database Model

The `User` model is stored in:

``` text
users
```

Important fields are:

``` text
id
full_name
username
email
password_hash
is_active
created_at
updated_at
```

The current model defines:

``` text
username UNIQUE
email UNIQUE
```

Therefore duplicate usernames and duplicate email addresses are
prevented at the database-model level as well as checked explicitly
during registration.

------------------------------------------------------------------------

# 7. User Session Model

Active login sessions are stored in:

``` text
user_sessions
```

Important fields are:

``` text
id
user_id
session_token_hash
created_at
expires_at
last_activity
revoked
```

The session belongs to a `User`.

The model defines:

``` text
session_token_hash UNIQUE
```

and indexes the session token hash.

The foreign key to the user uses:

``` text
ondelete = CASCADE
```

------------------------------------------------------------------------

# 8. Password Reset Token Model

Password-reset tokens are stored in:

``` text
password_reset_tokens
```

Important fields are:

``` text
id
user_id
token_hash
created_at
expires_at
used
```

The token hash is unique and indexed.

The token belongs to the corresponding user.

------------------------------------------------------------------------

# 9. Registration Endpoint

The endpoint is:

``` text
POST /auth/register
```

The request model is:

``` json
{
    "full_name": "Full Name",
    "username": "username",
    "email": "user@example.com",
    "password": "password"
}
```

The endpoint returns HTTP:

``` text
201
```

on successful registration.

------------------------------------------------------------------------

## 10. Registration Processing

The backend performs the following steps.

### Step 1 --- Normalize input

`full_name` is stripped.

`username` is:

``` text
strip()
lower()
```

`email` is also:

``` text
strip()
lower()
```

The password is not lowercased.

### Step 2 --- Validate full name

An empty full name results in:

``` text
400
Full name is required
```

### Step 3 --- Validate username length

The username must contain at least:

``` text
3 characters
```

Otherwise:

``` text
400
Username must contain at least 3 characters
```

### Step 4 --- Validate password length

The password must contain at least:

``` text
10 characters
```

Otherwise:

``` text
400
Password must contain at least 10 characters
```

### Step 5 --- Check duplicate username

The backend queries:

``` text
User.username
```

If the username already exists:

``` text
409
Username already exists
```

### Step 6 --- Check duplicate email

If the email already exists:

``` text
409
Email already exists
```

### Step 7 --- Hash password

The password is converted into a password hash:

``` text
hash_password(password)
```

### Step 8 --- Create user

The new `User` is created with:

``` text
is_active = True
```

### Step 9 --- Persist

The user is committed to PostgreSQL and refreshed.

------------------------------------------------------------------------

# 11. Registration Response

The successful response contains:

``` json
{
    "message": "User registered successfully",
    "user": {
        "id": 1,
        "fullName": "...",
        "username": "...",
        "email": "..."
    }
}
```

The password is not returned.

------------------------------------------------------------------------

# 12. Login Endpoint

The endpoint is:

``` text
POST /auth/login
```

Request:

``` json
{
    "identifier": "username-or-email",
    "password": "..."
}
```

The `identifier` can represent either:

``` text
username
```

or:

``` text
email
```

------------------------------------------------------------------------

# 13. Login Authentication Process

The login endpoint calls:

``` text
authenticate_user()
```

from:

``` text
backend/security.py
```

The identifier is normalized using:

``` text
strip()
lower()
```

The database lookup checks:

``` text
User.username
OR
User.email
```

against the normalized identifier.

------------------------------------------------------------------------

# 14. Password Verification

If a user is found, the backend verifies:

``` text
provided password
        |
        v
stored User.password_hash
```

using:

``` text
verify_password()
```

If verification fails, authentication fails.

------------------------------------------------------------------------

# 15. Dummy Password Hash

`security.py` defines:

``` text
DUMMY_PASSWORD_HASH
```

using:

``` text
dummy-password-for-timing-protection
```

If the identifier does not correspond to a user, the backend still
performs a password verification against this dummy hash before
returning failure.

The current implementation therefore avoids immediately returning
without performing the password-hash verification step when the user
does not exist.

------------------------------------------------------------------------

# 16. Inactive User Handling

If the user exists but:

``` text
is_active = False
```

authentication fails.

No session is created for an inactive user.

------------------------------------------------------------------------

# 17. Session Creation

After successful authentication:

``` text
create_session(db, user)
```

is called.

A raw session token is generated using:

``` text
secrets.token_urlsafe(32)
```

The raw token is not stored directly in the database.

Instead:

``` text
raw token
    |
    v
SHA-256
    |
    v
session_token_hash
```

is stored in `UserSession`.

------------------------------------------------------------------------

# 18. Session Database Record

A new `UserSession` is created with:

``` text
user_id
session_token_hash
created_at
expires_at
last_activity
revoked = False
```

The expiration time is:

``` text
current time + 8 hours
```

The session is committed to the database.

The raw session token is returned internally to the login endpoint.

------------------------------------------------------------------------

# 19. Session Cookie

The login endpoint sets:

``` text
alarmops_session
```

as a cookie.

The cookie contains the raw session token.

Its current properties are:

``` text
max_age = 8 hours
httponly = true
secure = environment controlled
samesite = lax
path = /
```

The browser therefore sends the session cookie with subsequent requests
according to cookie rules.

------------------------------------------------------------------------

# 20. Login Response

The successful login response is:

``` json
{
    "message": "Login successful",
    "user": {
        "id": 1,
        "fullName": "...",
        "username": "...",
        "email": "..."
    }
}
```

The raw session token is not returned in the JSON response.

It is placed in the HTTP cookie.

------------------------------------------------------------------------

# 21. Current-User Authentication Dependency

Protected FastAPI endpoints use:

``` text
get_current_user()
```

from:

``` text
backend/security.py
```

The function receives:

``` text
Request
Database Session
```

and reads:

``` text
alarmops_session
```

from the request cookies.

------------------------------------------------------------------------

# 22. Session Validation

The current-user flow is:

``` text
Browser
   |
   v
alarmops_session cookie
   |
   v
get_current_user()
   |
   v
SHA-256(raw token)
   |
   v
session_token_hash
   |
   v
UserSession lookup
```

The session lookup requires:

``` text
session_token_hash matches
AND
revoked = False
```

------------------------------------------------------------------------

# 23. Missing Session

If no session cookie exists:

``` text
401
Not authenticated
```

is returned.

------------------------------------------------------------------------

# 24. Invalid Session

If the token hash does not correspond to a valid session:

``` text
401
Invalid sessions
```

is returned by the current implementation.

------------------------------------------------------------------------

# 25. Expired Session

If:

``` text
session.expires_at <= datetime.now()
```

the session is marked:

``` text
revoked = True
```

and committed.

The request then receives:

``` text
401
session expired
```

------------------------------------------------------------------------

# 26. User Validation During Session Check

After finding the session, the backend gets:

``` text
session.user
```

The user must exist and be active.

If the user is missing or inactive:

``` text
session.revoked = True
```

and:

``` text
401
User account is inactive
```

is returned.

------------------------------------------------------------------------

# 27. Last Activity

For a valid session, the backend updates:

``` text
session.last_activity
```

to:

``` text
datetime.now()
```

and commits the change.

The current implementation therefore records the latest authenticated
request activity in the `UserSession` record.

------------------------------------------------------------------------

# 28. `/auth/me`

The endpoint is:

``` text
GET /auth/me
```

It depends on:

``` text
get_current_user
```

Therefore it is itself protected by the session authentication
mechanism.

The endpoint returns:

``` json
{
    "id": 1,
    "fullName": "...",
    "username": "...",
    "email": "..."
}
```

It is used by the frontend to determine whether the current browser
session is authenticated.

------------------------------------------------------------------------

# 29. Frontend Authentication Check

`api.js` implements:

``` javascript
checkAuth()
```

which calls:

``` text
GET /auth/me
```

with:

``` text
credentials: include
```

The function returns:

``` text
response.ok
```

Therefore:

``` text
200
```

means authenticated, while an unsuccessful response means the frontend
should treat the user as unauthenticated.

------------------------------------------------------------------------

# 30. React Authentication State

`App.jsx` maintains:

``` text
isAuthenticated
authLoading
```

On application startup, it calls:

``` text
checkAuth()
```

The result sets:

``` text
isAuthenticated
```

The application waits until:

``` text
authLoading = false
```

before rendering the login/dashboard decision.

------------------------------------------------------------------------

# 31. Login Frontend Flow

`Login.jsx` maintains local state for:

``` text
username
password
showPassword
error
loginSuccess
isLoading
```

Before sending the request, it validates that:

``` text
username/email is not empty
password is not empty
```

If either is empty, a local validation error is shown.

------------------------------------------------------------------------

# 32. Frontend Login Request

The login component calls:

``` javascript
loginRequest(username.trim(), password)
```

from:

``` text
api.js
```

The API function sends:

``` text
POST /auth/login
```

with:

``` json
{
    "identifier": "...",
    "password": "..."
}
```

and:

``` text
credentials: include
```

------------------------------------------------------------------------

# 33. Successful Login UI Flow

After `loginRequest()` succeeds:

``` text
loginSuccess = true
```

The component briefly displays the success state.

After the current timeout:

``` text
1100 ms
```

it calls:

``` text
onLogin()
```

The parent `App.jsx` then checks authentication again and changes the
application state to the dashboard.

------------------------------------------------------------------------

# 34. Failed Login UI Flow

If the API call fails:

``` text
error.message
```

is displayed.

The loading state is cleared.

The frontend therefore does not manually determine whether the username
or password was incorrect; it uses the backend's authentication
response.

------------------------------------------------------------------------

# 35. Logout Endpoint

The endpoint is:

``` text
POST /auth/logout
```

The endpoint reads the current:

``` text
alarmops_session
```

cookie.

If a token exists:

``` text
revoke_session()
```

is called.

------------------------------------------------------------------------

# 36. Session Revocation

`revoke_session()` hashes the raw session token:

``` text
raw token
    |
    v
SHA-256
    |
    v
token hash
```

It searches for the corresponding `UserSession`.

If found:

``` text
revoked = True
```

is set and committed.

------------------------------------------------------------------------

# 37. Cookie Deletion on Logout

After revoking the server-side session, the logout endpoint deletes:

``` text
alarmops_session
```

using:

``` text
response.delete_cookie()
```

with:

``` text
path = /
```

The response is:

``` json
{
    "message": "Logout successful"
}
```

------------------------------------------------------------------------

# 38. Frontend Logout Flow

`api.js` implements:

``` text
logoutRequest()
```

which sends:

``` text
POST /auth/logout
```

with:

``` text
credentials: include
```

`App.jsx` opens a confirmation modal before calling the logout API.

After logout, the frontend sets:

``` text
logoutModalOpen = false
activePage = dashboard
isAuthenticated = false
```

The login page is then rendered.

------------------------------------------------------------------------

# 39. Protected Ticket APIs

The main ticket endpoints use:

``` text
get_current_user
```

as a dependency.

This includes operations such as:

``` text
GET /tickets
PUT /tickets/{ticket_number}/priority
PUT /tickets/{ticket_number}/close
PUT /tickets/{ticket_number}/reopen
PUT /tickets/{ticket_number}/acknowledge
GET /notifications
GET /troubleshoot/{ticket_number}
```

Therefore the authentication check happens on the backend before these
operations are allowed.

------------------------------------------------------------------------

# 40. Frontend Handling of 401

For:

``` text
GET /tickets
GET /notifications
```

the current `api.js` explicitly checks for:

``` text
response.status === 401
```

and throws:

``` text
UNAUTHORIZED
```

`App.jsx` catches this and sets:

``` text
isAuthenticated = false
```

The application then returns to the login screen.

------------------------------------------------------------------------

# 41. Password Reset Configuration

The password-reset token lifetime is:

``` text
30 minutes
```

because:

``` text
RESET_TOKEN_EXPIRE_MINUTES = 30
```

Reset tokens are generated using:

``` text
secrets.token_urlsafe(32)
```

and stored only as SHA-256 hashes.

------------------------------------------------------------------------

# 42. Forgot-Password Endpoint

The endpoint is:

``` text
POST /auth/forgot-password
```

Request:

``` json
{
    "email": "user@example.com"
}
```

The email is normalized with:

``` text
strip()
lower()
```

------------------------------------------------------------------------

# 43. Forgot-Password User Lookup

The backend searches:

``` text
User.email
```

for the normalized email.

If the user does not exist, the endpoint still returns a generic
message:

``` text
If an account exists for this email, a reset link has been generated
```

The same generic response is returned when the user exists but is
inactive.

------------------------------------------------------------------------

# 44. Reset Token Creation

For an active matching user:

``` text
create_password_reset_token()
```

is called.

The function generates:

``` text
raw reset token
```

and calculates:

``` text
SHA-256(raw reset token)
```

The hash is stored in:

``` text
PasswordResetToken.token_hash
```

with:

``` text
created_at
expires_at
used = False
```

------------------------------------------------------------------------

# 45. Current Reset-Link Delivery

The current implementation does not send the reset link through an email
service.

Instead, `auth.py` builds:

``` text
http://localhost:5500/reset-password?token=<token>
```

and prints the reset link to the backend console.

The response also includes:

``` text
reset_url
```

for the matching active user.

This is the current implementation and should not be interpreted as an
email-delivery integration.

------------------------------------------------------------------------

# 46. Reset-Password Endpoint

The endpoint is:

``` text
POST /auth/reset-password
```

Request:

``` json
{
    "token": "...",
    "new_password": "..."
}
```

------------------------------------------------------------------------

# 47. Reset Password Validation

The new password must contain at least:

``` text
10 characters
```

Otherwise:

``` text
400
Password must contain at least 10 characters
```

------------------------------------------------------------------------

# 48. Reset Token Validation

The submitted raw token is hashed:

``` text
hash_reset_token(request.token)
```

The backend searches for a `PasswordResetToken` where:

``` text
token_hash matches
AND
used = False
```

If no token is found:

``` text
400
Invalid or already used reset token
```

------------------------------------------------------------------------

# 49. Reset Token Expiration

If:

``` text
expires_at <= datetime.now()
```

the reset is rejected with:

``` text
400
Reset token has expired
```

------------------------------------------------------------------------

# 50. User Validation During Reset

The reset token is associated with a user.

The user must:

``` text
exist
AND
be active
```

Otherwise:

``` text
400
User account is inactive
```

------------------------------------------------------------------------

# 51. Password Update

For a valid reset:

``` text
user.password_hash
```

is replaced with:

``` text
hash_password(request.new_password)
```

The reset token is then marked:

``` text
used = True
```

------------------------------------------------------------------------

# 52. Session Invalidation After Password Reset

The current implementation also revokes the user's active sessions.

It updates `UserSession` records for the user where:

``` text
revoked = False
```

to:

``` text
revoked = True
```

This means existing sessions are invalidated after a successful password
reset.

The changes are then committed.

------------------------------------------------------------------------

# 53. Password Reset Response

A successful reset returns:

``` json
{
    "message": "Password reset successful"
}
```

No session is created automatically by the password-reset endpoint.

The user must authenticate again using the new password.

------------------------------------------------------------------------

# 54. Frontend Password Reset Flow

The frontend API layer provides:

``` text
forgotPasswordRequest(email)
resetPasswordRequest(token, newPassword)
```

### Forgot password

``` text
ForgotPassword.jsx
      |
      v
forgotPasswordRequest()
      |
      v
POST /auth/forgot-password
```

### Reset password

``` text
ResetPassword.jsx
      |
      v
resetPasswordRequest()
      |
      v
POST /auth/reset-password
```

------------------------------------------------------------------------

# 55. Complete Login Flow

``` text
User enters username/email + password
              |
              v
          Login.jsx
              |
              v
        loginRequest()
              |
              v
      POST /auth/login
              |
              v
      authenticate_user()
              |
        +-----+-----+
        |           |
      invalid      valid
        |           |
        v           v
      401      create_session()
                    |
                    v
             UserSession row
                    |
                    v
          alarmops_session cookie
                    |
                    v
             Login response
                    |
                    v
              App.jsx
                    |
                    v
             checkAuth()
                    |
                    v
               Dashboard
```

------------------------------------------------------------------------

# 56. Complete Request Authentication Flow

For a protected endpoint:

``` text
React API request
      |
      v
credentials: include
      |
      v
Browser sends alarmops_session
      |
      v
FastAPI endpoint
      |
      v
get_current_user()
      |
      v
Hash cookie token
      |
      v
UserSession lookup
      |
      +---- invalid ----> 401
      |
      v
Check revoked
      |
      v
Check expiration
      |
      v
Check user active
      |
      v
Update last_activity
      |
      v
Return current User
      |
      v
Protected endpoint continues
```

------------------------------------------------------------------------

# 57. Complete Logout Flow

``` text
User clicks Logout
       |
       v
LogoutConfirmModal
       |
       v
logoutRequest()
       |
       v
POST /auth/logout
       |
       v
Read alarmops_session
       |
       v
Hash token
       |
       v
Find UserSession
       |
       v
revoked = True
       |
       v
Delete cookie
       |
       v
Frontend isAuthenticated = false
       |
       v
Login page
```

------------------------------------------------------------------------

# 58. Complete Password Reset Flow

``` text
User enters email
       |
       v
POST /auth/forgot-password
       |
       v
Find active user
       |
       v
Generate random reset token
       |
       v
Store SHA-256 token hash
       |
       v
Generate reset URL
       |
       v
Print reset URL to backend console
       |
       v
User opens reset URL
       |
       v
ResetPassword.jsx
       |
       v
POST /auth/reset-password
       |
       v
Hash submitted token
       |
       v
Find unused token
       |
       v
Check expiration
       |
       v
Hash new password
       |
       v
Mark reset token used
       |
       v
Revoke existing user sessions
       |
       v
Commit
```

------------------------------------------------------------------------

# 59. Authentication Data Relationships

The database relationship is:

``` text
User
 |
 +----< UserSession
 |
 +----< PasswordResetToken
```

One user can therefore have multiple session records and multiple
password-reset token records.

The current `User` relationships use:

``` text
cascade = all, delete-orphan
```

for both collections.

------------------------------------------------------------------------

# 60. Security Properties Present in the Current Implementation

The current implementation includes:

-   Password hashing rather than plaintext password storage.
-   Username/email normalization.
-   Username and email uniqueness checks.
-   Minimum username length.
-   Minimum password length.
-   Random session-token generation.
-   Session-token hashing before database storage.
-   HTTP-only session cookie.
-   Session expiration.
-   Session revocation.
-   Active-user validation.
-   Reset-token hashing.
-   Reset-token expiration.
-   Single-use reset tokens through the `used` field.
-   Session revocation after password reset.
-   Dummy password verification when a user lookup fails.
-   Backend-side authentication dependencies for protected endpoints.

------------------------------------------------------------------------

# 61. Current Authentication Configuration

  Setting                         Current value
  ------------------------------- ------------------------------------
  Session cookie                  `alarmops_session`
  Session lifetime                8 hours
  Cookie `HttpOnly`               Enabled
  Cookie `SameSite`               `lax`
  Cookie `Secure`                 Controlled by `AUTH_COOKIE_SECURE`
  Password reset token lifetime   30 minutes
  Session token storage           SHA-256 hash
  Reset token storage             SHA-256 hash
  Minimum username length         3
  Minimum password length         10
  User default active state       `True`

------------------------------------------------------------------------

# 62. Important Current-Implementation Notes

### Authentication is session-based

The application does not use a JWT-based authentication flow in the
inspected implementation.

The backend creates a server-side `UserSession` and gives the browser a
session cookie.

### The raw session token is not stored in `UserSession`

The database stores:

``` text
session_token_hash
```

rather than the raw cookie token.

### Password reset does not use an email provider

The current implementation prints the reset URL to the backend console.

### Password reset revokes existing sessions

After a successful password reset, all currently non-revoked sessions
for that user are marked revoked.

### `/auth/me` is the frontend's authentication check

The React application uses the protected `/auth/me` endpoint to
determine whether the browser's current session is valid.

------------------------------------------------------------------------

# 63. Authentication Responsibility Split

## React frontend

Responsible for:

``` text
Login form
Registration form
Forgot-password form
Reset-password form
Loading/error UI
Calling authentication APIs
Maintaining isAuthenticated
Showing authenticated or unauthenticated UI
```

## FastAPI backend

Responsible for:

``` text
Input validation
User lookup
Password verification
Password hashing
Session creation
Session validation
Session expiration
Session revocation
Password reset token creation
Password reset validation
Password update
```

## PostgreSQL

Stores:

``` text
Users
Sessions
Password-reset tokens
```

------------------------------------------------------------------------

# 64. Summary

The current authentication architecture is:

``` text
                    React
                      |
              +-------+-------+
              |               |
          Login UI       Reset UI
              |               |
              +-------+-------+
                      |
                    api.js
                      |
                      v
                   FastAPI
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
        User     UserSession   PasswordResetToken
          |           |           |
          +-----------+-----------+
                      |
                  PostgreSQL
```

The normal authenticated request flow is:

``` text
Login
  ↓
Create UserSession
  ↓
Set alarmops_session cookie
  ↓
Browser sends cookie
  ↓
get_current_user()
  ↓
Validate hashed session token
  ↓
Protected endpoint
```

The current system therefore uses a **database-backed, cookie-based
session authentication mechanism**, with password hashing and hashed
session/reset tokens.
