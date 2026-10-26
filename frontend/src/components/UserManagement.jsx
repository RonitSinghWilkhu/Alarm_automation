import { useEffect, useState } from "react";
import RoleChangeModal from "../modals/RoleChangeModal";

const API_BASE = "http://localhost:8001";

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [pendingRoleChange, setPendingRoleChange] = useState(null);
    const [isRoleUpdating, setIsRoleUpdating] = useState(false);
    const [roleUpdateSuccess, setRoleUpdateSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter]);
    const usersPerPage = 10;

    const handleRoleChange = (userId, newRole) => {
        const currentUser = users.find((user) => user.id === userId);
        if(!currentUser || currentUser.role === newRole){
            return;
        }

        setPendingRoleChange({
            userId,
            newRole,
            username: currentUser.username,
            currentRole: currentUser.role
        });
        setShowRoleModal(true);
    }

    const confirmRoleChange = async() => {
        if(!pendingRoleChange || isRoleUpdating){
            return;
        }
        setIsRoleUpdating(true);

        const {userId, newRole} = pendingRoleChange;

        try{
            const response = await fetch(
                `${API_BASE}/auth/users/${userId}/role`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        role: newRole
                    })
                }
            );

            const data = await response.json();

            if (!response.ok){
                throw new Error(
                    data?.detail || "Failed to update user role."
                );
            }

            const updatedUser = data?.user;

            if (updatedUser?.role){
                setUsers((previousUsers) =>
                    previousUsers.map((user) =>
                            user.id === userId
                                ? { ...user, role: updatedUser.role}
                                : user
                    )
                );
            } else if (Array.isArray(data?.users)){
                setUsers(data.users);
            }else{
                throw new Error(
                    "The server response does not contain updated user information."
                );
            }

            setRoleUpdateSuccess(true);

        } catch(err){
            console.error("Role update failed:", err);
            alert(err.message || "Could not update user role.");
        } finally{
            setIsRoleUpdating(false);
        }
    };


    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_BASE}/auth/users`, {
                    credentials: "include"
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error("Admin access required.");
                    }
                    if (response.status === 401) {
                        throw new Error("Please login again");
                    }
                    throw new Error("Failed to load users.");
                }

                const data = await response.json();
                console.log("Role update response status:", response.status);
                console.log("Role update response body:",
                            JSON.stringify(data, null, 2)
                );
                setUsers(data.users || []);
            } catch (err) {
                setError(err.message || "Could not connect to the backend.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // FIX 2: Reset to page 1 whenever filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter]);

    const filteredUsers = users.filter((user) => {
        const search = searchTerm.toLowerCase().trim();

        const matchesSearch = 
            user.fullName?.toLowerCase().includes(search) ||
            user.username?.toLowerCase().includes(search) ||
            user.email?.toLowerCase().includes(search);

        const matchesRole = 
            roleFilter === "all" || user.role === roleFilter;

        const matchedStatus = 
            statusFilter === "all" ||
            (statusFilter === "active" && user.isActive === true) ||
            (statusFilter === "inactive" && user.isActive === false);

        return matchesSearch && matchesRole && matchedStatus;
    });

    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const startIndex = (currentPage - 1) * usersPerPage;
    const paginatedUsers = filteredUsers.slice(
        startIndex,
        startIndex + usersPerPage
    );

    return (
        <section className="user-management-page">
            <div className="user-management-header">
                <div>
                    <h2>User Management</h2>
                    <p>View registered users and their access roles</p>
                </div>
                <span className="user-count">
                    {users.length} users
                </span>
            </div>

            <div className="user-filters">
                <div className="user-search-container">
                    <input
                        type="text"
                        className="user-search-input"
                        placeholder="Search by name, username, or email...."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="user-role-filter">
                    <label htmlFor="role-filter">Filter by role:</label>
                    <select
                        id="role-filter"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                </div>

                <div className="user-status-filter">
                    <label htmlFor="status-filter">Filter by status:</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {loading && <p>Loading users....</p>}

            {!loading && error && (
                <div className="user-management-error" role="alert">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <> {/* FIX 1: Added React Fragment wrapper here */}
                    <div className="user-table-container">
                        <table className="user-management-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Full Name</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.fullName}</td>
                                        <td>{user.username}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`user-role-badge ${user.role === "admin" ? "admin" : "regular"}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={user.isActive ? "user-status-active" : "user-status-inactive"}>
                                                {user.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className="role-select"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                aria-label={`Change role for ${user.username}`}
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}

                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            No users match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="user-pagination">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>

                        <span>
                            Page {currentPage} of {Math.max(totalPages, 1)}
                        </span>

                        <button
                            type="button"
                            onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                        >
                            Next
                        </button>
                    </div>
                    <RoleChangeModal
                        isOpen={showRoleModal && pendingRoleChange !== null}
                        isLoading={isRoleUpdating}
                        username={pendingRoleChange?.username}
                        currentRole={pendingRoleChange?.currentRole}
                        newRole={pendingRoleChange?.newRole}
                        isSuccess={roleUpdateSuccess}
                        onDone={() => {
                            setShowRoleModal(false);
                            setPendingRoleChange(null);
                            setRoleUpdateSuccess(false);
                        }}
                        onCancel={() => {
                            setShowRoleModal(false);
                            setPendingRoleChange(null);
                            setRoleUpdateSuccess(false);
                        }}
                        onConfirm={confirmRoleChange}
                    />
                </>
            )}
        </section>
    );
}

export default UserManagement;