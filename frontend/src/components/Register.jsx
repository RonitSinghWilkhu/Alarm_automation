import { useState } from "react";
import { LockKeyhole, User, Mail, Eye, EyeOff } from "lucide-react";
import { registerRequest } from "../api/api";
import ericssonLogo from "../assets/ericsson-logo.png";


function Register({ onNavigate }) {

    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [error, setError] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);


    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");

        if(!fullName.trim()) {
            setError("Please enter your full name");
            return;
        }

        if(!username.trim()) {
            setError("Please enter a username");
            return;
        }

        if(!email.trim()) {
            setError("Please enter your email");
            return;
        }

        if(!password) {
            setError("Please enter a password");
            return;
        }

        if(password.length < 10) {
            setError("Password must be at least 10 characters");
            return;
        }

        if(password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);

        try{
            await registerRequest(
                fullName.trim(),
                username.trim(),
                email.trim(),
                password
            );

            setRegistrationSuccess(true);
        } catch(error){
            console.error("Registration failed:" , error);

            setError(
                error.message ||
                "Could not create the account"
            );
        } finally {
            setIsLoading(false);
        }
    }


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

                        <h2>Create New Account</h2>

                        <p>
                            Create your EriAlarm account
                        </p>

                    </div>


                    {registrationSuccess ? (

                        <div className="login-success">

                            <h3>Account Created Successfully</h3>

                            <p>
                                Your account has been created.
                                You can now sign in.
                            </p>

                            <div className="login-auth-links">

                                <button
                                    type="button"
                                    className="login-link"
                                    onClick={() => onNavigate("login")}
                                >
                                    Continue to Login
                                </button>

                            </div>

                        </div>

                    ) : (

                        <form onSubmit={handleSubmit}>

                            <div className="login-field">

                                <label htmlFor="fullName">
                                    Full Name
                                </label>

                                <div className="login-input">

                                    <User size={17} />

                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(event) => {
                                            setFullName(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter your full name"
                                        autoComplete="name"
                                    />

                                </div>

                            </div>


                            <div className="login-field">

                                <label htmlFor="registerUsername">
                                    Username
                                </label>

                                <div className="login-input">

                                    <User size={17} />

                                    <input
                                        id="registerUsername"
                                        type="text"
                                        value={username}
                                        onChange={(event) => {
                                            setUsername(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter a username"
                                        autoComplete="username"
                                    />

                                </div>

                            </div>


                            <div className="login-field">

                                <label htmlFor="registerEmail">
                                    Email
                                </label>

                                <div className="login-input">

                                    <Mail size={17} />

                                    <input
                                        id="registerEmail"
                                        type="email"
                                        value={email}
                                        onChange={(event) => {
                                            setEmail(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                    />

                                </div>

                            </div>


                            <div className="login-field">

                                <label htmlFor="registerPassword">
                                    Password
                                </label>

                                <div className="login-input">

                                    <LockKeyhole size={17} />

                                    <input
                                        id="registerPassword"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError("");
                                        }}
                                        placeholder="Enter your password"
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

                                <label htmlFor="confirmPassword">
                                    Confirm Password
                                </label>

                                <div className="login-input">

                                    <LockKeyhole size={17} />

                                    <input
                                        id="confirmPassword"
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
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                    />

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() =>
                                            setShowConfirmPassword(prev => !prev)
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
                                {isLoading ? "Creating Account..." : "Create Account"}
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


export default Register;