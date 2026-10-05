import { useState } from "react";
import { Mail } from "lucide-react";
import { forgotPasswordRequest } from "../api/api";
import ericssonLogo from "../assets/ericsson-logo.png";


function ForgotPassword({ onNavigate }) {

    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);


    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess(false);

        if(!email.trim()) {
            setError("Please enter your email");
            return;
        }

        setIsLoading(true);

        try{
            const data = await forgotPasswordRequest(
                email.trim()
            );

            if(data.reset_url) {
                window.location.href = data.reset_url;
                return;
            }

            setSuccess(true);
        } catch(error) {
            console.error(
                "Forgot password failed:", error
            );

            setError(error.message || "Could not process the password reset request.");
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

                        <h2>Forgot Password?</h2>

                        <p>
                            Enter your registered email address
                        </p>

                    </div>


                    {success ? (

                        <div className="login-success">

                            <h3>Reset Link Requested</h3>

                            <p>
                                If an account exists for this email,
                                password reset instructions will be provided.
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

                                <label htmlFor="forgotEmail">
                                    Email
                                </label>

                                <div className="login-input">

                                    <Mail size={17} />

                                    <input
                                        id="forgotEmail"
                                        type="email"
                                        value={email}
                                        onChange={(event) => {
                                            setEmail(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter your registered email"
                                        autoComplete="email"
                                    />

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
                                {isLoading ? "Sending..." : "Send Reset Link"}
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


export default ForgotPassword;