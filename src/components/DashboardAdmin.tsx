import React from "react";
import { Shield, Users, Package, DollarSign, Settings, Bell, ClipboardList, CheckCircle, Ban, RefreshCw, Layers, LogIn, LogOut, Key } from "lucide-react";
import { AuditLog } from "../types";

interface DashboardAdminProps {
  token: string | null;
  onRefreshConfig: () => void;
}

export default function DashboardAdmin({ token, onRefreshConfig }: DashboardAdminProps) {
  const [activeTab, setActiveTab] = React.useState<"metrics" | "sellers" | "withdrawals" | "session-logins" | "settings" | "announcements" | "audit-logs">("metrics");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Stats / KPIs
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    totalSellers: 0,
    pendingSellers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0
  });

  const [users, setUsers] = React.useState<any[]>([]);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [withdrawals, setWithdrawals] = React.useState<any[]>([]);

  // Settings Fields
  const [platformName, setPlatformName] = React.useState("");
  const [heroHeadline, setHeroHeadline] = React.useState("");
  const [heroSubheadline, setHeroSubheadline] = React.useState("");
  const [promoText, setPromoText] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");

  // Announcement Fields
  const [annTitle, setAnnTitle] = React.useState("");
  const [annBody, setAnnBody] = React.useState("");

  const loadAdminConfigAndLogs = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch metrics
      const mRes = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mData = await mRes.json();
      if (mRes.ok) {
        setStats(mData.summary);
        setLogs(mData.recentLogs);
      }

      // 2. Fetch users
      const uRes = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const uData = await uRes.json();
      if (uRes.ok) {
        setUsers(uData);
      }

      // 3. Fetch custom system settings
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      if (configRes.ok && configData.settings) {
        const s = configData.settings;
        setPlatformName(s.platformName || "");
        setHeroHeadline(s.heroHeadline || "");
        setHeroSubheadline(s.heroSubheadline || "");
        setPromoText(s.promoText || "");
        setContactEmail(s.contactEmail || "");
      }

      // 4. Fetch dynamic session audits
      const sessRes = await fetch("/api/admin/sessions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData);
      }

      // 5. Fetch platform payouts queue
      const rawWith = await fetch("/api/admin/withdrawals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rawWith.ok) {
        const withData = await rawWith.json();
        setWithdrawals(withData);
      }

    } catch (err: any) {
      setError("Failed to stream administrative database keys.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadAdminConfigAndLogs();
  }, [loadAdminConfigAndLogs]);

  const handleApproveSeller = async (userId: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: "seller",
          sellerApproved: approve
        })
      });
      if (res.ok) {
        loadAdminConfigAndLogs();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to update seller state.");
      }
    } catch (err) {
      alert("Error occurred updating seller permissions.");
    }
  };

  const handleModerateWithdrawal = async (wId: string, status: "approved" | "failed") => {
    try {
      const res = await fetch(`/api/admin/withdrawals/${wId}/moderate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        loadAdminConfigAndLogs();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to moderate payout query.");
      }
    } catch (err) {
      alert("Error executing payout moderation.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          platformName,
          heroHeadline,
          heroSubheadline,
          promoText,
          contactEmail
        })
      });
      if (res.ok) {
        alert("Platform settings saved successfully!");
        onRefreshConfig();
        loadAdminConfigAndLogs();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to configure properties.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annBody) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: annTitle,
          body: annBody
        })
      });
      if (res.ok) {
        alert("Banner published to storefront homepage!");
        setAnnTitle("");
        setAnnBody("");
        onRefreshConfig();
      } else {
        alert("Failed to publish announcement banner.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div id="admin-loading-state" className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
        <span className="font-sans text-sm text-neutral-500">Decrypting administrative console tables...</span>
      </div>
    );
  }

  const pendingSellers = users.filter(u => u.role === "seller" && !u.sellerApproved);
  const pendingPayouts = withdrawals.filter(w => w.status === "pending");

  return (
    <div id="admin-dashboard-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Brand Header */}
      <div id="admin-dashboard-header" className="border-b border-neutral-100 pb-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white/95">
            <Shield className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-3xl text-neutral-900 tracking-tight">Admin Console</h1>
            <p className="font-sans text-sm text-neutral-500 mt-1">Platform management, profit withdrawals moderation, and user session monitoring logs.</p>
          </div>
        </div>
      </div>

      {/* Navigation and Content Grid */}
      <div id="admin-tabbed-grid" className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar Tabs */}
        <div id="admin-sidebar" className="lg:col-span-1 space-y-1.5">
          <button
            id="tab-btn-metrics"
            onClick={() => setActiveTab("metrics")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "metrics" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <Layers className="w-4 h-4" />
            Platform Metrics
          </button>
          
          <button
            id="tab-btn-sellers"
            onClick={() => setActiveTab("sellers")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
              activeTab === "sellers" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              Sellers Queue
            </span>
            {pendingSellers.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 font-sans text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                {pendingSellers.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-withdrawals"
            onClick={() => setActiveTab("withdrawals")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
              activeTab === "withdrawals" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <DollarSign className="w-4 h-4" />
              Seller Withdrawals
            </span>
            {pendingPayouts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 font-sans text-[10px] font-bold text-white flex items-center justify-center">
                {pendingPayouts.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-sessions"
            onClick={() => setActiveTab("session-logins")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "session-logins" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <Key className="w-4 h-4" />
            Sign-in Monitor
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => setActiveTab("settings")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "settings" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <Settings className="w-4 h-4" />
            Global Settings
          </button>

          <button
            id="tab-btn-announcements"
            onClick={() => setActiveTab("announcements")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "announcements" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <Bell className="w-4 h-4" />
            Announcements
          </button>

          <button
            id="tab-btn-audit-logs"
            onClick={() => setActiveTab("audit-logs")}
            className={`w-full text-left px-4 py-3 rounded-xl font-sans text-xs font-semibold flex items-center gap-3 cursor-pointer transition-all ${
              activeTab === "audit-logs" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Audit Log Roll
          </button>
        </div>

        {/* Content Panel Area */}
        <div id="admin-main-panel" className="lg:col-span-3 min-h-[500px]">
          {/* TAB: METRICS */}
          {activeTab === "metrics" && (
            <div id="metrics-pane" className="space-y-10 animate-in fade-in duration-300">
              <div id="kpis-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div id="kpi-revenue" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
                  <div className="w-11 h-11 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Completed Sales</span>
                    <span className="font-sans font-bold text-xl text-neutral-900 block mt-0.5">GH₵ {stats.totalRevenue.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div id="kpi-users" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Total Users</span>
                    <span className="font-sans font-semibold text-xl text-neutral-900 block mt-0.5">{stats.totalUsers} profiles</span>
                  </div>
                </div>

                <div id="kpi-products" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex items-center gap-4.5">
                  <div className="w-11 h-11 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Products Listed</span>
                    <span className="font-sans font-semibold text-xl text-neutral-900 block mt-0.5">{stats.totalProducts} placements</span>
                  </div>
                </div>
              </div>

              {/* Dynamic commission indicator statement */}
              <div id="commission-kpi-callout" className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-semibold text-sm">Dataghmart Platform Revenue</h3>
                  <p className="font-sans text-xs text-white/80 mt-1">Formulate dynamic splits consisting of a 5.5% deduction taken directly off all customer order transactions.</p>
                </div>
                <div className="text-right">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider block text-emerald-100">COMMISSIONS EARNED</span>
                  <span className="font-mono text-xl font-bold">GH₵ {(stats.totalRevenue * 0.055).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Recent secure system activity entries */}
              <div id="recent-activities-box" className="p-6 sm:p-8 rounded-2xl border border-neutral-100 bg-white shadow-sm space-y-4">
                <h2 className="font-sans font-semibold text-base text-neutral-900">Recent Secure Vault Signatures</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-neutral-400">
                        <th className="pb-3.5 font-semibold">Event stamp</th>
                        <th className="pb-3.5 font-semibold">User trace</th>
                        <th className="pb-3.5 font-semibold">Action</th>
                        <th className="pb-3.5 font-semibold text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-neutral-700 font-normal">
                      {logs.slice(0, 5).map(log => (
                        <tr key={log.id} className="hover:bg-neutral-50/40">
                          <td className="py-3 font-mono text-[10px] text-neutral-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                          <td className="py-3 font-semibold text-neutral-800">{log.userId || "anonymous"}</td>
                          <td className="py-3 font-medium text-neutral-500 uppercase tracking-wider text-[10px]">{log.action}</td>
                          <td className="py-3 text-right max-w-xs truncate">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PENDING SELLERS APPROVAL QUEUE */}
          {activeTab === "sellers" && (
            <div id="sellers-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <h2 className="font-sans font-semibold text-lg text-neutral-900 pb-4 border-b border-gray-50">Pending Seller Moderation Queue</h2>
              {pendingSellers.length === 0 ? (
                <div id="no-pending-sellers" className="py-16 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="font-sans font-semibold text-neutral-800 text-sm">Clear Horizons</h3>
                  <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">All recent independent merchants requesting seller properties have been approved and moderations are perfectly aligned.</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {pendingSellers.map(sel => (
                    <div key={sel.id} id={`seller-pending-${sel.id}`} className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={sel.avatarUrl}
                          alt={sel.name}
                          className="w-11 h-11 rounded-xl object-cover bg-neutral-150 border border-neutral-100"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="font-sans font-semibold text-sm text-neutral-950">{sel.name}</h4>
                          <span className="font-sans text-xs text-neutral-400 block">{sel.email}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          id={`approve-btn-${sel.id}`}
                          onClick={() => handleApproveSeller(sel.id, true)}
                          className="px-3.5 py-1.5 bg-neutral-950 text-white font-sans font-semibold text-xs rounded-xl hover:bg-neutral-850 shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve Shop
                        </button>
                        <button
                          id={`deny-btn-${sel.id}`}
                          onClick={() => handleApproveSeller(sel.id, false)}
                          className="px-3.5 py-1.5 border border-neutral-200 text-neutral-500 font-sans font-medium text-xs rounded-xl hover:text-red-600 hover:bg-red-50 cursor-pointer transition-all flex items-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Deny request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SELLER INTEREST WITHDRAWAL MODERATIONS */}
          {activeTab === "withdrawals" && (
            <div id="withdrawals-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <h2 className="font-sans font-semibold text-lg text-neutral-900 pb-4 border-b border-gray-50">Sellers Payout Request queue</h2>
              {withdrawals.length === 0 ? (
                <div id="no-withdrawals" className="py-16 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-neutral-400 mx-auto" />
                  <h3 className="font-sans font-semibold text-neutral-800 text-sm">Perfect Balance</h3>
                  <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">No earnings settlement claims have been filed by Ghanaian vendors so far.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-neutral-400">
                        <th className="py-3 font-semibold">Merchant ID</th>
                        <th className="py-3 font-semibold">Payment Details</th>
                        <th className="py-3 font-semibold text-right">Sum requested</th>
                        <th className="py-3 font-semibold">Status</th>
                        <th className="py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {withdrawals.map(w => (
                        <tr key={w.id} className="hover:bg-neutral-50/40">
                          <td className="py-3.5">
                            <span className="font-sans font-semibold block text-neutral-800">{w.sellerId.replace("user-", "")}</span>
                            <span className="font-sans text-[10px] text-neutral-400 block">{new Date(w.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="py-3.5">
                            <span className="font-sans font-medium text-neutral-800 block">{w.bankName}</span>
                            <span className="font-mono text-[11px] text-neutral-500 block">Acct: {w.accountNumber}</span>
                          </td>
                          <td className="py-3.5 text-right font-mono font-bold text-neutral-900">
                            GH₵ {w.amount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold capitalize ${
                              w.status === "approved" 
                                ? "bg-emerald-50 text-emerald-700" 
                                : w.status === "failed" 
                                ? "bg-rose-50 text-rose-700" 
                                : "bg-amber-50 text-amber-700"
                            }`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            {w.status === "pending" ? (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handleModerateWithdrawal(w.id, "approved")}
                                  className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-semibold font-sans rounded-lg hover:bg-emerald-750 cursor-pointer"
                                >
                                  Disburse
                                </button>
                                <button
                                  onClick={() => handleModerateWithdrawal(w.id, "failed")}
                                  className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold font-sans rounded-lg hover:bg-rose-100 cursor-pointer"
                                >
                                  Fail
                                </button>
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-[10px] font-sans font-medium">Finished</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: SECURE SIGN-IN & CREDENTIALS AUDITOR */}
          {activeTab === "session-logins" && (
            <div id="session-passphrase-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <h2 className="font-sans font-semibold text-lg text-neutral-900 pb-4 border-b border-gray-50">Sign-In / Sign-Out Credentials Monitor</h2>
              {sessions.length === 0 ? (
                <div id="no-sessions" className="py-16 text-center space-y-3">
                  <Key className="w-10 h-10 text-neutral-400 mx-auto animate-bounce" />
                  <h3 className="font-sans font-semibold text-neutral-800 text-sm">No Active Signatures</h3>
                  <p className="font-sans text-xs text-neutral-400 max-w-sm mx-auto">No verification security signatures have registered within the active application session.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-neutral-400">
                        <th className="py-3 font-semibold">Timestamp</th>
                        <th className="py-3 font-semibold">User Identity</th>
                        <th className="py-3 font-semibold">Email Anchor</th>
                        <th className="py-3 font-semibold">Access Event</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {sessions.map(s => (
                        <tr key={s.id} className="hover:bg-neutral-50/40">
                          <td className="py-3.5 font-mono text-[10px] text-neutral-400">
                            {new Date(s.createdAt).toLocaleString("en-GH")}
                          </td>
                          <td className="py-3.5">
                            <span className="font-sans font-semibold text-neutral-900 block">{s.userName}</span>
                            <span className="font-sans text-[10px] text-neutral-400 block">{s.userId}</span>
                          </td>
                          <td className="py-3.5 font-sans font-medium text-neutral-600">
                            {s.userEmail}
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider ${
                              s.action === "LOGIN" 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                                : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                            }`}>
                              {s.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTINGS PANEL */}
          {activeTab === "settings" && (
            <div id="settings-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <h2 className="font-sans font-semibold text-lg text-neutral-900 pb-4 border-b border-gray-50">Global Storefront Settings</h2>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Store Brand Name</label>
                  <input
                    type="text"
                    required
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Banner Headline</label>
                    <input
                      type="text"
                      required
                      value={heroHeadline}
                      onChange={(e) => setHeroHeadline(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Banner Small Callout</label>
                    <input
                      type="text"
                      required
                      value={heroSubheadline}
                      onChange={(e) => setHeroSubheadline(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Promo ticker callout (Top banner)</label>
                  <input
                    type="text"
                    value={promoText}
                    onChange={(e) => setPromoText(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                  />
                </div>

                <div>
                  <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Customer Support Email Desk</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-50 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-neutral-950 text-white font-sans font-semibold text-xs rounded-xl hover:bg-neutral-850 shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Custom Properties
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: ANNOUNCEMENTS SCHEDULER */}
          {activeTab === "announcements" && (
            <div id="announcements-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <h2 className="font-sans font-semibold text-lg text-neutral-900 pb-4 border-b border-gray-50">Publish Active Promotional Banner</h2>
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div>
                  <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Announcement Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midseason Ceramics Handoff"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none"
                  />
                </div>

                <div>
                  <label className="font-sans text-xs font-semibold text-neutral-500 block mb-1">Body Text Content</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe discount codes, premium arrivals, or shop maintenance updates to storefront visitors..."
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 focus:border-neutral-950 outline-none resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-50 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-neutral-950 text-white font-sans font-semibold text-xs rounded-xl hover:bg-neutral-850 shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Publish Live Announcement
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: AUDIT LOGS CHART */}
          {activeTab === "audit-logs" && (
            <div id="audit-pane" className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                <h2 className="font-sans font-semibold text-lg text-neutral-900">Platform Audit Event Trail</h2>
                <button onClick={loadAdminConfigAndLogs} className="p-1.5 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[550px] pr-1">
                <table id="audit-logs-roll" className="w-full text-left font-sans text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 font-semibold">Stamp</th>
                      <th className="py-3 font-semibold">User</th>
                      <th className="py-3 font-semibold">Action ID</th>
                      <th className="py-3 font-semibold">Net Trace</th>
                      <th className="py-3 font-semibold text-right">Event description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50 text-neutral-700">
                    {logs.map(log => (
                      <tr key={log.id} id={`audit-tr-${log.id}`} className="hover:bg-neutral-50/50">
                        <td className="py-3 font-mono text-[9px] text-neutral-400">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-3 font-semibold text-neutral-800">{log.userId || "anonymous"}</td>
                        <td className="py-3"><span className="px-1.5 py-0.5 rounded bg-neutral-100 font-mono text-[9px] text-neutral-600 tracking-wider uppercase">{log.action}</span></td>
                        <td className="py-3 font-mono text-[10px] text-neutral-400">{log.ipAddress}</td>
                        <td className="py-3 text-right text-neutral-600 font-medium max-w-sm" title={log.details}>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
