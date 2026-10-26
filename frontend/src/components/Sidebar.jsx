import { Bell, X, Menu , LayoutDashboard, Settings, Activity, ChartNoAxesCombined, Users} from "lucide-react";

function Sidebar({ backendOnline, collapsed, onToggle, notificationCount, activePage, onNavigate, userRole }) {
    return (
        <>
            <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} id="sidebar">
                <div className="sidebar-top">
                    <div className="brand">
                        <div className="brand-mark">
                            {/* Replaced inline SVG with Bell icon */}
                            <Bell size={20} />
                        </div>
                        <div className="brand-text">
                            <span className="brand-name">AlarmOps</span>
                            <span className="brand-sub">Alarm Automation for Operations</span>
                        </div>
                    </div>
                    <button 
                        className="sidebar-toggle" 
                        id="menutoggle" 
                        type="button" 
                        onClick={onToggle} 
                        aria-label="Close sidebar" 
                        title="Close sidebar"
                    >
                        {/* Replaced inline SVG with X icon */}
                        <X size={18} />
                    </button>
                </div>
                
                <nav className="side-nav">
                    <span className="nav-label">Overview</span>
                    <a
                        className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
                        href="#/dashboard"
                        onClick={() => onNavigate("dashboard")}
                    >
                        <LayoutDashboard size={18} />
                        <span>Dashboard</span>
                    </a>

                    <a
                        className={`nav-item ${activePage === "notifications" ? "active" : ""}`}
                        href="#/notifications"
                        onClick={() => onNavigate("notifications")}
                    >
                        <Bell size={18} />
                        <span>Team Notifications</span>

                        <span className="nav-badge">
                            {notificationCount}
                        </span>
                    </a>

                    {userRole === "admin" && (

                        <a
                            href="#/evaluation"
                            className={`nav-item ${activePage === 'evaluation' ? 'active' : ''}`}
                            onClick={() => onNavigate('evaluation')}
                        >
                            <Activity size={20} />
                            <span>RAG Evaluation</span>
                        </a>

                    )}

                    {userRole === "admin" && (
                        <a
                            href="http://localhost:3000/d/adkpk4d/alarm-automation-operations?from=-181712-12-08T10:20:31.427Z&to=%2B185764-08-05T10:20:31.427Z&timezone=browser&var-alarm_type=$__all"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nav-item"
                            onClick={() => onNavigate("grafana")}
                        >
                            <ChartNoAxesCombined size={20} />
                            <span>Grafana Monitoring</span>
                        </a>
                    )}

                    {userRole === "admin" && (
                        <a
                            href="#/users"
                            className={`nav-item ${activePage === "users" ? "active" : ""}`}
                            onClick={() => onNavigate("users")}
                        >
                            <Users size={18} />
                            <span>User Management</span>
                        </a>
                    )}

                    <a 
                        className={`nav-item ${activePage === "settings" ? "active" : ""}`}
                        href="#/settings"
                        onClick={() => onNavigate("settings")}
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </a>

                </nav>
                
                <div className="side-footer">
                    <div className={`conn-status ${backendOnline ? "online" : "offline"}`}>
                        <span className="conn-dot"></span>
                        <span>{backendOnline ? "Backend connected" : "Backend offline"}</span>
                    </div>
                </div>
            </aside>
            
            <button 
                className="sidebar-reopen" 
                id="sidebarReopen" 
                type="button" 
                onClick={onToggle} 
                aria-label="Open sidebar" 
                title="Open sidebar"
            >
                {/* Replaced inline SVG with Menu icon */}
                <Menu size={18} />
            </button>
        </>
    );
}

export default Sidebar;