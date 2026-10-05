import { useState } from "react";
import { LockKeyhole, Eye, EyeOff } from "lucide-react";
import { resetPasswordRequest } from "../api/api";
import ericssonLogo from "../assets/ericsson-logo.png";

function ResetPassword({ onNavigate }) {

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);


    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess(false);

        if(!password) {
            setError("Please enter a new password");
            return;
        }

        if(password.length < 10) {
            setError("Password must be at least 10 characters");
            return;
        }

        if(!confirmPassword) {
            setError("Please confirm your new password");
            return;
        }

        if(password !== confirmPassword){
            setError("Passwords do not match");
            return;
        }

        const hash = window.location.hash;

        const queryString = hash.includes("?")
            ? hash.split("?")[1]
            : "";

        const params = new URLSearchParams(queryString);

        const token = params.get("token");

        if(!token){
            setError("Invalid or missing reset token");
            return;
        }

        setIsLoading(true);

        try {
            await resetPasswordRequest(
                token,
                password
            );

            // Strip the token from the URL so it no longer lingers in the
            // address bar / browser history after being used.
            window.history.replaceState(
                null,
                "",
                `${window.location.pathname}${window.location.search}#/reset-password`
            );

            setSuccess(true);
        } catch(error) {
            console.error(
                "Password reset failed:",
                error
            );

            setError(
                error.message ||
                "Could not reset the password"
            );
        } finally {
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

                        <h2>Reset Password</h2>

                        <p>
                            Create a new password for your account
                        </p>

                    </div>


                    {success ? (

                        <div className="login-success">

                            <h3>Password Reset Successful</h3>

                            <p>
                                Your password has been updated.
                            </p>

                            <div className="login-auth-links">

                                <button
                                    type="button"
                                    className="login-link"
                                    onClick={() => onNavigate("login")}
                                >
                                    Back to Login
                                </button>

                            </div>

                        </div>

                    ) : (

                        <form onSubmit={handleSubmit}>

                            <div className="login-field">

                                <label htmlFor="newPassword">
                                    New Password
                                </label>

                                <div className="login-input">

                                    <LockKeyhole size={17} />

                                    <input
                                        id="newPassword"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter your new password"
                                        autoComplete="new-password"
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


                            <div className="login-field">

                                <label htmlFor="confirmNewPassword">
                                    Confirm New Password
                                </label>

                                <div className="login-input">

                                    <LockKeyhole size={17} />

                                    <input
                                        id="confirmNewPassword"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={confirmPassword}
                                        onChange={(event) => {
                                            setConfirmPassword(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Confirm your new password"
                                        autoComplete="new-password"
                                    />

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() =>
                                            setShowConfirmPassword(prev =>
                                                !prev
                                            )
                                        }
                                        aria-label={
                                            showConfirmPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showConfirmPassword
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
                                {isLoading ? "Resetting Password...." : "Reset Password"}
                            </button>


                            <div className="login-auth-links">

                                <button
                                    type="button"
                                    className="login-link"
                                    onClick={() => onNavigate("login")}
                                >
                                    Back to Login
                                </button>

                            </div>

                        </form>

                    )}


                    <p className="login-footer">
                        AlarmOps · Ericsson Operations
                    </p>

                </div>

            </section>

        </div>
    );
}

export default ResetPassword;