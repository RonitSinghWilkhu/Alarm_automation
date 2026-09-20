import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sun, Moon, ChevronDown, Search } from "lucide-react";
// import { title } from "node:process";
// import { settings } from "node:cluster";

const PAGE_HEADINGS = {
    dashboard: { title: "Alarm Automation Dashboard", subtitle: "Telecom alarm & ticket management" },
    notifications: { title: "Team Notifications", subtitle: "Alerts dispatched to assigned response teams" },
    settings: { title: "Settings", subtitle: "Manage your AlarmOps dashboard preferences" },
};

function Topbar({ searchTerm, onSearchChange, darkMode, onToggleTheme, onRefresh, onLogout, activePage }) {
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    const pageTitles = {
        dashboard: {
            title: "Alarm Automation Dashboard",
            subtitle: "Telecom alert and ticket management"
        },

        notifications: {
            title: "Notifications",
            subtitle: "Alerts and notifications for operations"
        },

        settings:{
            title: "Settings",
            subtitle: "Manage your AlarmOps preferences"
        }
    };
    const currentPage = pageTitles[activePage] || pageTitles.dashboard;

    useEffect(() => {
        function handleOutsideClick(event) {
            if (
                userMenuRef.current &&
                !userMenuRef.current.contains(event.target)
            ) {
                setUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    return (
        <header className="topbar">
            <div className="page-heading">
                <h1>{currentPage.title}</h1>
                <p>{currentPage.subtitle}</p>
            </div>
            
            <div className="search-box">
                <Search size={16} />
                <input 
                    type="text" 
                    placeholder="Search ticket, node, alarm…" 
                    value={searchTerm} 
                    onChange={event => onSearchChange(event.target.value)} 
                    autoComplete="off" 
                />
            </div>
            
            <button 
                className="icon-btn" 
                id="refreshBtn" 
                type="button" 
                onClick={onRefresh} 
                title="Refresh data" 
                aria-label="Refresh"
            >
                <RefreshCw size={18} />
            </button>
            
            <button 
                className="icon-btn theme-btn" 
                id="darkModeToggle" 
                type="button" 
                onClick={onToggleTheme} 
                title="Toggle theme" 
                aria-label="Toggle theme"
            >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <div
                className={`user-menu ${userMenuOpen ? "open" : ""}`}
                ref={userMenuRef}
            >
                <button 
                    className="user-chip" 
                    id="userMenuBtn" 
                    type="button" 
                    onClick={() => setUserMenuOpen(prev => !prev)} 
                    aria-label="Open user menu" 
                    aria-expanded={userMenuOpen}
                >
                    <div className="avatar">UR</div>
                    <div className="user-meta">
                        <span className="user-name">Ericsson User</span>
                        <span className="user-role">User role</span>
                    </div>
                    {/* The CSS automatically rotates this when parent has .open class */}
                    <ChevronDown size={16} className="user-chevron" />
                </button>
                
                <div
                    className={`user-dropdown ${userMenuOpen ? "" : "hidden"}`}
                    id="userDropdown"
                >
                    <div className="dropdown-user-info">
                        <div className="dropdown-avatar">UR</div>
                        <div>
                            <strong>Ericsson User</strong>
                            <span>User role</span>
                        </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" type="button" onClick={() => {window.location.hash = "#/settings";}}>
                        <span>Settings</span>
                    </button>
                    
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout-item" id="logout-item" type="button" onClick={onLogout}>
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Topbar;