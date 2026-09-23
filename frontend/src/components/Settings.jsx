import { Settings as SettingsIcon, Moon, Sun, Server, RefreshCw, ArrowLeft, ChevronRight } from "lucide-react";
import React, {useState} from "react";

function Settings({ darkMode, onToggleTheme, refreshInterval, onRefreshIntervalChange, backendOnline, sidebarCollapsed, onToggleSidebarCollapsed, lastDataUpdate, refreshEnabled, onToggleRefresh }) {
    const [activeSection, setActiveSection] = useState(null);
    return (
        <div className="settings-page">

            {!activeSection && (
                <>
                    <div className="settings-header">
                        <div>
                            <h2>Settings</h2>
                            <p>Configure your dashboard, refresh, and appearance preferences.</p>
                        </div>
                    </div>

                    <div className="settings-menu">

                        <button
                            className="settings-menu-item"
                            type="button"
                            onClick={() => setActiveSection("appearance")}
                        >
                            <div className="settings-menu-left">

                                <div className="settings-menu-icon">
                                    <SettingsIcon size={18} />
                                </div>

                                <div>
                                    <span className="settings-menu-title">
                                        Appearance
                                    </span>

                                    <span className="settings-menu-description">
                                        Theme and dashboard layout preferences
                                    </span>
                                </div>

                            </div>

                            <ChevronRight size={18} />
                        </button>

                        <button
                            className="settings-menu-item"
                            type="button"
                            onClick={() => setActiveSection("backend")}
                        >
                            <div className="settings-menu-left">

                                <div className="settings-menu-icon">
                                    <Server size={18} />
                                </div>

                                <div>
                                    <span className="settings-menu-title">
                                        Backend
                                    </span>

                                    <span className="settings-menu-description">
                                        Backend status and data information
                                    </span>
                                </div>

                            </div>

                            <ChevronRight size={18} />
                        </button>


                        <button
                            className="settings-menu-item"
                            type="button"
                            onClick={() => setActiveSection("refresh")}
                        >
                            <div className="settings-menu-left">

                                <div className="settings-menu-icon">
                                    <RefreshCw size={18} />
                                </div>

                                <div>
                                    <span className="settings-menu-title">
                                        Data Refresh
                                    </span>

                                    <span className="settings-menu-description">
                                        Control automatic dashboard data refresh
                                    </span>
                                </div>

                            </div>

                            <ChevronRight size={18} />
                        </button>


                        <button
                            className="settings-menu-item"
                            type="button"
                            onClick={() => setActiveSection("system")}
                        >
                            <div className="settings-menu-left">

                                <div className="settings-menu-icon">
                                    <SettingsIcon size={18} />
                                </div>

                                <div>
                                    <span className="settings-menu-title">
                                        System Information
                                    </span>

                                    <span className="settings-menu-description">
                                        Application and system details
                                    </span>
                                </div>

                            </div>

                            <ChevronRight size={18} />
                        </button>

                    </div>
                </>
            )}


            {activeSection === "appearance" && (
                <>
                    <div className="settings-subbar">

                        <button
                            className="settings-back-button"
                            type="button"
                            onClick={() => setActiveSection(null)}
                        >
                            <ArrowLeft size={18} />
                        </button>

                        <span>Appearance</span>

                    </div>


                    <div className="settings-section">

                        <div className="settings-option">

                            <div className="settings-option-info">

                                <span className="settings-option-title">
                                    Start with sidebar collapsed
                                </span>

                                <span className="settings-option-description">
                                    Start the dashboard with the sidebar collapsed
                                    the next time you open it.
                                </span>

                            </div>


                            <label className="settings-checkbox">

                                <input
                                    type="checkbox"
                                    checked={sidebarCollapsed}
                                    onChange={onToggleSidebarCollapsed}
                                />

                                <span className="settings-checkmark"></span>

                            </label>

                        </div>


                        <div className="settings-option">

                            <div className="settings-option-info">

                                <span className="settings-option-title">
                                    Theme
                                </span>

                                <span className="settings-option-description">
                                    Switch between light and dark dashboard themes.
                                </span>

                            </div>


                            <button
                                className="settings-theme-button"
                                type="button"
                                onClick={onToggleTheme}
                            >
                                {darkMode ? (
                                    <>
                                        <Moon size={16} />
                                        Dark
                                    </>
                                ) : (
                                    <>
                                        <Sun size={16} />
                                        Light
                                    </>
                                )}
                            </button>

                        </div>


                        <div className="settings-option">

                            <div className="settings-option-info">

                                <span className="settings-option-title">
                                    Dashboard Density
                                </span>

                                <span className="settings-option-description">
                                    Control how much information is displayed on
                                    the dashboard.
                                </span>

                            </div>


                            <span className="settings-value">
                                Comfortable
                            </span>

                        </div>

                    </div>
                </>
            )}

                        {activeSection === "backend" && (
                            <>
                                <div className="settings-subbar">

                                    <button
                                        className="settings-back-button"
                                        type="button"
                                        onClick={() => setActiveSection(null)}
                                    >
                                        <ArrowLeft size={18} />
                                    </button>

                                    <span>Backend</span>

                                </div>


                                <div className="settings-section">

                                    <div className="settings-option">

                                        <div className="settings-option-info">

                                            <span className="settings-option-title">
                                                Backend Status
                                            </span>

                                            <span className="settings-option-description">
                                                Current connection status of the dashboard backend.
                                            </span>

                                        </div>


                                        <span
                                            className={`settings-status ${
                                                backendOnline ? "online" : "offline"
                                            }`}
                                        >
                                            {backendOnline ? "Connected" : "Offline"}
                                        </span>

                                    </div>


                                    <div className="settings-option">

                                        <div className="settings-option-info">

                                            <span className="settings-option-title">
                                                Last Data Update
                                            </span>

                                            <span className="settings-option-description">
                                                The last time dashboard data was successfully updated.
                                            </span>

                                        </div>


                                        <span className="settings-value">
                                            {lastDataUpdate || "No data available"}
                                        </span>

                                    </div>

                                </div>
                            </>
                        )}

            {activeSection === "refresh" && (
                <>
                    <div className="settings-subbar">

                        <button
                            className="settings-back-button"
                            type="button"
                            onClick={() => setActiveSection(null)}
                        >
                            <ArrowLeft size={18} />
                        </button>

                        <span>Data Refresh</span>

                    </div>


                    <div className="settings-section">

                        <div className="settings-option">

                            <div className="settings-option-info">

                                <span className="settings-option-title">
                                    Data Refresh
                                </span>

                                <span className="settings-option-description">
                                    Enable or disable automatic and manual dashboard
                                    data refresh.
                                </span>

                            </div>


                            <label className="settings-checkbox">

                                <input
                                    type="checkbox"
                                    checked={refreshEnabled}
                                    onChange={onToggleRefresh}
                                />

                                <span className="settings-checkmark"></span>

                            </label>

                        </div>


                        <div className="settings-option">

                            <div className="settings-option-info">

                                <span className="settings-option-title">
                                    Refresh Interval
                                </span>

                                <span className="settings-option-description">
                                    How frequently dashboard data is refreshed
                                    automatically.
                                </span>

                            </div>


                            <select
                                className="settings-select"
                                value={refreshInterval}
                                onChange={(event) =>
                                    onRefreshIntervalChange(
                                        Number(event.target.value)
                                    )
                                }
                                disabled={!refreshEnabled}
                            >
                                <option value={10}>10 seconds</option>
                                <option value={20}>20 seconds</option>
                                <option value={30}>30 seconds</option>
                                <option value={60}>1 minute</option>
                                <option value={120}>2 minutes</option>
                                <option value={300}>5 minutes</option>
                            </select>

                        </div>

                    </div>
                </>
            )}

            {activeSection === "system" && (
                <>
                    <div className="settings-subbar">
                        <button
                            className="settings-back-button"
                            type="button"
                            onClick={() => setActiveSection(null)}
                        >
                            <ArrowLeft size={18} />
                        </button>

                        <span>System Information</span>
                    </div>

                    <div className="settings-section">
                        <div className="settings-option">
                            <div className="settings-option-info">
                                <span className="settings-option-title">
                                    Application
                                </span>

                                <span className="settings-option-description">
                                    Dashboard application information
                                </span>
                            </div>

                            <span className="settings-value">
                                AlarmOps v1.0.0
                            </span>
                        </div>

                        <div className="settings-option">
                            <div className="settings-option-info">
                                <span className="settings-option-title">
                                    Frontend
                                </span>

                                <span className="settings-option-description">
                                    Frontend framework and build environment.
                                </span>
                            </div>

                            <span className="settings-value">
                                React+Vite
                            </span>
                        </div>

                        <div className="settings-option">
                            <div className="settings-option-info">
                                <span className="settings-option-title">
                                    Backend
                                </span>

                                <span className="settings-option-description">
                                    Backend API framework and service port.
                                </span>
                            </div>

                            <span className="settings-value">
                                FastAPI . Port 8001
                            </span>
                        </div>

                        <div className="settings-option">
                            <div className="settings-option-info">
                                <span className="settings-option-title">
                                    Data Pipeline
                                </span>

                                <span className="settings-option-description">
                                    Alarm processing and dashboard data generation.
                                </span>
                            </div>

                            <span className="settings-value">
                                Java
                            </span>
                        </div>

                        <div className="settings-option">
                            <div className="settings-option-info">
                                <span className="settings-option-title">
                                    Data source.
                                </span>
                                
                                <span className="settings-option-description">
                                    Primary alarm input file.
                                </span>
                            </div>

                            <span className="settings-value">
                                Alerts form the nodes
                            </span>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}

export default Settings;