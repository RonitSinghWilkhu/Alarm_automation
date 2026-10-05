import { useState } from "react";
import { LockKeyhole, User, Eye, EyeOff } from "lucide-react";
import ericssonLogo from "../assets/ericsson-logo.png";
import { loginRequest } from "../api/api";

function Login({ onLogin, onNavigate }) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if(!username.trim()) {
            setError("Please enter your username or email");
            return;
        }

        if(!password.trim()) {
            setError("Please enter your password");
            return;
        }

        setError("");
        setIsLoading(true);

        try {
            await loginRequest(username.trim(), password);

            setLoginSuccess(true);
            setIsLoading(false);

            onLogin();
        } catch(error) {
            console.error("Login failed:", error);
            setError(
                error.message ||
                "Could not connect to the authentication server."
            );
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">

            <section className="login-brand">

                <img
                    src={ericssonLogo}
                    alt="Ericsson logo"
                    className="ericsson-logo"
                />

                <div className="login-brand-content">

                    <h1>Eri-Alarm</h1>

                    <p className="login-tagline">
                        Telecom Alarm &amp; Incident Automation
                    </p>

                    <p className="login-description">
                        Centralized monitoring, ticket management and
                        operational intelligence for telecom operations.
                    </p>

                </div>

                <span className="login-security">
                    Authorized personnel only
                </span>

            </section>


            <section className="login-form-section">

                <div className="login-card">

                    <div className="login-header">

                        <h2>Welcome Back</h2>

                        <p>
                            Sign in to continue to EriAlarm
                        </p>

                    </div>

                    {loginSuccess ? (
                        <div className="login-success">
                            
                            <div className="login-success-icon">

                                <svg
                                    viewBox="0 0 52 52"
                                    aria-hidden="true"
                                >
                                    <circle
                                        className="login-success-circle"
                                        cx="26"
                                        cy="26"
                                        r="24"
                                    />

                                    <path
                                        className="login-success-check"
                                        d="M14 27 L22 35 L39 18"
                                    />
                                </svg>
                            </div>

                            <h3>Login Successful</h3>

                            <p>
                                Redirecting to EriAlarm....
                            </p>
                        </div>
                    ) : (

                        <>

                            <form onSubmit={handleSubmit}>

                                <div className="login-field">

                                    <label htmlFor="username">
                                        Username / Email
                                    </label>

                                    <div className="login-input">

                                        <User size={17} />

                                        <input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={(event) => {
                                                setUsername(event.target.value);
                                                setError("");
                                            }}
                                            placeholder="Enter your username or email"
                                            autoComplete="username"
                                        />

                                    </div>

                                </div>


                                <div className="login-field">

                                    <label htmlFor="password">
                                        Password
                                    </label>

                                    <div className="login-input">

                                        <LockKeyhole size={17} />

                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(event) => {
                                                setPassword(event.target.value);
                                                setError("");
                                            }}
                                            placeholder="Enter your password"
                                            autoComplete="current-password"
                                        />

                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() =>
                                                setShowPassword(prev => !prev)
                                            }
                                            aria-label={
                                                showPassword
                                                    ? "Hide password"
                                                    : "Show password"
                                            }
                                        >
                                            {showPassword
                                                ? <EyeOff size={17} />
                                                : <Eye size={17} />
                                            }
                                        </button>

                                    </div>

                                </div>


                                {error && (
                                    <p className="login-error">
                                        {error}
                                    </p>
                                )}


                                <button
                                    type="submit"
                                    className="login-button"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Signing in..." : "Login"}
                                </button>

                                <div className="login-auth-links">
                                    <button
                                        type="button"
                                        className="login-link"
                                        onClick={() => onNavigate("forgot-password")}
                                    >
                                        Forgot Password?
                                    </button>

                                    <button
                                        type="button"
                                        className="login-link"
                                        onClick={() => onNavigate("register")}
                                    >
                                        Create New Account
                                    </button>
                                </div>

                            </form>


                            <p className="login-footer">
                                AlarmOps · Ericsson Operations
                            </p>
                        </>
                    )}
                </div>

            </section>

        </div>
    );
}

export default Login;