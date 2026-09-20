import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Login from "./components/Login";
import SummaryCards from "./components/SummaryCards";
import TicketTable from "./components/TicketTable";
import Notifications from "./components/Notifications";
import Settings from "./components/Settings";
import TicketDetailsModal from "./modals/TicketDetailsModal";
import UpgradeModal from "./modals/UpgradeModal";
import LogoutConfirmModal from "./modals/LogoutConfirmModal";
import CloseTicketModal from "./modals/CloseTicketModal";
import TroubleshootModal from "./modals/TroubleshootModal";
import MessageModal from "./modals/MessageModal";
import ToastHost from "./components/ToastHost";
import{
    fetchTickets as getTickets,
    fetchNotifications as getNotifications,
    closeTicket as closeTicketAPI,
    upgradeTicket as upgradeTicketAPI,
    troubleshootTicket as troubleshootTicketAPI,
    acknowledgeTicket as acknowledgeTicketAPI
} from "./api/api";
import { getTicketSlaStatus } from "./utils/priorityHistory";

// const API_BASE = "http://127.0.0.1:8001";

function App() {
    // authentication
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
      return localStorage.getItem("alarmops-auth") === "true";
    });
    // --- State ---
    const [tickets, setTickets] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [backendOnline, setBackendOnline] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [columnFilters, setColumnFilters] = useState({
        node: "ALL", alarmType: "ALL", severity: "ALL",
        impactLevel: "ALL", priority: "ALL", assignedTeam: "ALL", status: "ALL"
    });

    const [darkMode, setDarkMode] = useState(false);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem("alarm-sidebar-collapsed");

        return saved === null
            ? true
            : saved === "true";
    });

    const [refreshInterval, setRefreshInterval] = useState(()=> {
      return Number(localStorage.getItem("alarmops-refresh-rate")) || 20;
    });

    const [refreshEnabled, setRefreshEnabled] = useState(() => {
        const saved = localStorage.getItem("alarmops-refresh-enabled");

        return saved === null
            ? true
            : saved === "true";
    });

    const [lastDataUpdate, setLastDataUpdate] = useState(null);

    const getPageFromHash = () => {
        const hash = window.location.hash.replace(/^#\/?/, "");
        return ["dashboard", "notifications", "settings"].includes(hash)
            ? hash
            : "dashboard";
    };
    const [activePage, setActivePage] = useState(getPageFromHash);
    const [toasts, setToasts] = useState([]);

    // Modal State
    const [activeModal, setActiveModal] = useState(null); // 'details', 'upgrade', 'close', 'troubleshoot', 'message'
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [troubleshootData, setTroubleshootData] = useState({ recommendation: "", historicalIncidents: [] });
    const [messageData, setMessageData] = useState({ title: "", message: "" });

    // --- Helpers ---
    const addToast = useCallback((type, title, message) => {
        const id = Date.now();
        const duration = 3800;
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const closeAllModals = useCallback(() => {
        setActiveModal(null);
        setSelectedTicket(null);
    }, []);

    // --- API Calls ---
    const fetchTickets = useCallback(async () => {
        try {
            const data = await getTickets();
            setTickets(data);
            setLastDataUpdate(
                new Date().toLocaleString()
            );
            setBackendOnline(true);
            if (!backendOnline) {
                addToast("success", "Backend Reconnected", "Connection to the backend has been restored.");
            }
        } catch (error) {
            console.error("Error loading tickets:", error);
            setBackendOnline(false);
            if (backendOnline) {
                setMessageData({ title: "Connection Error", message: "Could not connect to the backend API. Please ensure the service is running on port 8001." });
                setActiveModal("message");
            }
        } finally {
            setLoading(false);
        }
    }, [backendOnline, addToast]);

    const fetchNotifications = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
        }
    }, []);

    // --- Effects ---
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
        localStorage.setItem("alarmops-theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    useEffect(() => {
        if(!isAuthenticated){
          return
        }

        //initial data load
        fetchTickets();
        fetchNotifications();

        //automatic refresh disabled
        if (!refreshEnabled) {
          return;
        }
        
        const ticketInterval = setInterval(
          fetchTickets,
          refreshInterval *1000 
        );

        const notifInterval = setInterval(
          fetchNotifications,
          refreshInterval *1000
        );
        
        return () => {
            clearInterval(ticketInterval);
            clearInterval(notifInterval);
        };
    }, [isAuthenticated, fetchTickets, fetchNotifications, refreshInterval, refreshEnabled]);

    useEffect(() => {
      const handleHashChange = () => {
        setActivePage(getPageFromHash());
      };

      window.addEventListener("hashchange", handleHashChange);

      return () => {
        window.removeEventListener("hashchange", handleHashChange);
      };
    }, []);

    // --- Handlers ---
    const handleColumnFilterChange = (field, value) => {
        setColumnFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleRefresh = () => {

        setLoading(true);

        Promise.all([fetchTickets(), fetchNotifications()]).finally(() => setLoading(false));
    };

    const handleLogin = () => {
      localStorage.setItem(
        "alarmops-auth",
        "true"
      );
      window.location.hash = "#/dashboard";
      setActivePage("dashboard");
      setIsAuthenticated(true);
    };

    const handleLogout = () => {
      localStorage.removeItem(
        "alarmops-auth"
      );
      setLogoutModalOpen(false);
      setActivePage("dashboard");
      setIsAuthenticated(false);
    };

    const cancelLogout = () => {
      setLogoutModalOpen(false);
      setActivePage("dashboard");
    };

    // Modal Actions
    const openDetails = (ticket) => { setSelectedTicket(ticket); setActiveModal("details"); };
    const openUpgrade = (ticket) => { setSelectedTicket(ticket); setActiveModal("upgrade"); };
    const openClose = (ticket) => { setSelectedTicket(ticket); setActiveModal("close"); };
    
    const openTroubleshoot = async (ticket) => {
        setSelectedTicket(ticket);
        setTroubleshootData({ recommendation: "Loading...", historicalIncidents: [] });
        setActiveModal("troubleshoot");
        
        try {
          const data= await troubleshootTicketAPI(
            ticket.ticketNumber
          );
          setTroubleshootData({
              recommendation:
                  data.recommendation ||
                  "No recommendation available",

              historicalIncidents:
                  data.historicalIncidents || []
          });
        } catch (error) {
            setTroubleshootData(prev => ({ ...prev, recommendation: "Could not load troubleshooting recommendation." }));
        }
    };

    const confirmUpgrade = async (newPriority) => {
        if (!selectedTicket) return;
        try {
          const result = await upgradeTicketAPI(
            selectedTicket.ticketNumber,
            newPriority
          );
            // Optimistic update
            setTickets(prev => prev.map(t => t.ticketNumber === selectedTicket.ticketNumber ? { ...t, priority: newPriority } : t));
            closeAllModals();
            fetchNotifications();
            addToast("success", "Ticket Upgraded", `${selectedTicket.ticketNumber} upgraded to ${newPriority}.`);
        } catch (error) {
            setMessageData({ title: "Connection Error", message: "Could not connect to backend API." });
            setActiveModal("message");
        }
    };

    const confirmAchnowledge = async (ticketNumber) => {
        try{
            await acknowledgeTicketAPI(ticketNumber);

            await fetchNotifications();
            addToast("success", "Notification Acknowledged", `${ticketNumber} has been acknowledged.`);
        } catch(error){
            setMessageData({title: "Connection Error", message: "Could not connect to backend API."});
            setActiveModal("message");
        }
    };

    const confirmClose = async () => {
        if (!selectedTicket) return;
        try {
          const data = await closeTicketAPI(
            selectedTicket.ticketNumber
          );

            setTickets(prev => prev.map(t => t.ticketNumber === selectedTicket.ticketNumber ? { ...t, status: "CLOSED" } : t));
            closeAllModals();
            fetchNotifications();
            addToast("success", "Ticket Closed", `${selectedTicket.ticketNumber} has been closed successfully.`);
        } catch (error) {
            setMessageData({ title: "Connection Error", message: "Could not connect to the backend API." });
            setActiveModal("message");
        }
    };

    const confirmAcknowledge = async (ticketNumber) => {
      try{
        await acknowledgeTicketAPI(ticketNumber);
        await fetchNotifications();
        addToast("success", "Notification Acknowledged", `${ticketNumber} has been acknowledged.`);
      } catch (error){
        setMessageData({title: "Connection Error", message: "Could not connect to backend API."});
        setActiveModal("message");
      }
    };

    // --- Filtering Logic ---
    const filteredTickets = tickets.filter(ticket => {
        // Column filters
        const matchesColumns = Object.entries(columnFilters).every(([key, value]) => {
            if (value === "ALL") return true;
            return String(ticket[key]) === String(value);
        });
        
        // Search
        const term = searchTerm.toLowerCase();
        const matchesSearch = term === "" || [
            ticket.ticketNumber, ticket.node, ticket.alarmType, 
            ticket.assignedTeam, ticket.severity, ticket.priority, 
            ticket.impactLevel, ticket.status
        ].join(" ").toLowerCase().includes(term);

        return matchesColumns && matchesSearch;
    });

    const sidebarNotificationCount = tickets.filter(
        ticket =>
          ticket.status?.toUpperCase() === "OPEN" &&
          notifications.some(
              notification =>
                  notification.ticketNumber === ticket.ticketNumber
          ) &&
          getTicketSlaStatus(ticket, notifications) === "WITHIN_SLA"
    ).length;

    if(!isAuthenticated){
      return(
        <Login
            onLogin={handleLogin}
        />
      );
    }

    return (
        <div className="app-shell">
            <Sidebar 
                backendOnline={backendOnline} 
                collapsed={sidebarCollapsed} 
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
                notificationCount={sidebarNotificationCount} 
                activePage={activePage}
                onNavigate={setActivePage}
            />
            
            <div className={`main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
                <Topbar 
                    searchTerm={searchTerm} 
                    onSearchChange={setSearchTerm} 
                    darkMode={darkMode} 
                    onToggleTheme={() => setDarkMode(!darkMode)} 
                    onRefresh={handleRefresh} 
                    onLogout={() => setLogoutModalOpen(true)}
                    activePage={activePage}
                />
                
                <main className="content">
                    {activePage === "dashboard" && (
                      <>
                          <SummaryCards tickets={tickets} loading={loading} />

                          <TicketTable
                              tickets={filteredTickets}
                              allTickets={tickets}
                              notifications={notifications}
                              loading={loading}
                              columnFilters={columnFilters}
                              onColumnFilterChange={handleColumnFilterChange}
                              onDetails={openDetails}
                              onUpgrade={openUpgrade}
                              onTroubleshoot={openTroubleshoot}
                              onClose={openClose}
                          />
                      </>
                    )}

                    {activePage === "notifications" && (
                      <Notifications
                          notifications={notifications}
                          tickets={tickets}
                          onAcknowledge={confirmAchnowledge}
                      />
                    )}

                    {activePage === "settings" && (
                      <Settings
                          darkMode={darkMode}
                          onToggleTheme={() => setDarkMode(prev => !prev)}
                          refreshEnabled={refreshEnabled}
                          onToggleRefresh={() => {
                              setRefreshEnabled(prev => {
                                  const next = !prev;

                                  localStorage.setItem(
                                    "alarmops-refresh-enabled",
                                    next
                                  );

                                  return next;
                              })
                          }}
                          refreshInterval={refreshInterval}
                          onRefreshIntervalChange={(value) => {
                            setRefreshInterval(value);
                            localStorage.setItem(
                              "alarmops-refresh-rate",
                              value
                            );
                          }}
                          backendOnline={backendOnline}
                          sidebarCollapsed={sidebarCollapsed}
                          onToggleSidebarCollapsed={() => {
                              setSidebarCollapsed(prev => {
                                const next = !prev

                                localStorage.setItem(
                                  "alarm-sidebar-collapsed",
                                  next
                                );

                                return next;
                              });
                          }}
                          lastDataUpdate={lastDataUpdate}
                      />
                    )}

                </main>
            </div>

            {/* Modals */}
            {activeModal === "details" && <TicketDetailsModal ticket={selectedTicket} notifications={notifications} onClose={closeAllModals} />}
            {activeModal === "upgrade" && <UpgradeModal ticket={selectedTicket} onClose={closeAllModals} onUpgrade={confirmUpgrade} />}
            {activeModal === "close" && <CloseTicketModal ticket={selectedTicket} onClose={closeAllModals} onConfirm={confirmClose} />}
            {activeModal === "troubleshoot" && <TroubleshootModal ticket={selectedTicket} recommendation={troubleshootData.recommendation} historicalIncidents={troubleshootData.historicalIncidents} onClose={closeAllModals} />}
            {activeModal === "message" && <MessageModal title={messageData.title} message={messageData.message} onClose={closeAllModals} />}
            {logoutModalOpen && (<LogoutConfirmModal onConfirm={handleLogout} onCancel={cancelLogout} />)}
            {/* Toasts */}
            <ToastHost toasts={toasts} onDismiss={removeToast} />
        </div>
    );
}

export default App;