import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, MapPin, ThumbsUp, ChevronDown, Search, LayoutGrid, List, Map as MapIcon, Loader2, WifiOff, ShieldAlert } from "lucide-react";
import IssueMap from "./IssueMap";
import { apiFetch } from "../api";

/* ---------------------------------------------------------
   CampusFix — Admin Dashboard
   Palette (from design brief):
     bg base       #FFFFFF / #F4FAF9
     text primary  #1B2A2E
     text muted    #5C6B6E
     accent        #028090 (teal) / #00A896 (secondary) / #02C39A (mint)
     border        #E4EEEC
     status: reported = coral/orange, in_progress = amber, resolved = mint

   Wired to the real backend (main merged 2026-08-27):
     GET   /api/issues?category=&status=&sort=
     GET   /api/admin/stats
     PATCH /api/issues/:id/status
   Category/status filters and upvote-sort are sent to the server as query
   params. "urgency" and "newest" aren't in the backend's sort contract
   (only sort=upvotes is), so for those two we fetch unsorted and sort
   client-side instead — flag this to Aradhya if the backend later adds
   more sort options server-side.
--------------------------------------------------------- */

const COLORS = {
  bg: "#FFFFFF",
  bgSoft: "#F4FAF9",
  text: "#1B2A2E",
  textMuted: "#5C6B6E",
  accent: "#028090",
  accentSecondary: "#00A896",
  mint: "#02C39A",
  border: "#E4EEEC",
};

const STATUS_META = {
  reported: { label: "Reported", bg: "#FDEDE4", fg: "#C1502E", dot: "#E8734A" },
  in_progress: { label: "In progress", bg: "#FCF2DA", fg: "#8A6416", dot: "#E8AC3C" },
  resolved: { label: "Resolved", bg: "#E1F7EF", fg: "#0C7A54", dot: "#02C39A" },
};

const CATEGORY_META = {
  electrical: { label: "Electrical", icon: "⚡" },
  plumbing: { label: "Plumbing", icon: "🚰" },
  mess: { label: "Mess", icon: "🍽️" },
  infrastructure: { label: "Infrastructure", icon: "🏗️" },
  other: { label: "Other", icon: "📋" },
};

const STATUS_ORDER = ["reported", "in_progress", "resolved"];

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.round(diffMs / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function StatusDropdown({ status, onChange, saving }) {
  return (
    <div className="relative inline-block">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition-colors disabled:opacity-60 disabled:cursor-wait"
        style={{
          borderColor: COLORS.border,
          color: STATUS_META[status].fg,
          background: STATUS_META[status].bg,
        }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s} style={{ color: COLORS.text, background: COLORS.bg }}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      {saving ? (
        <Loader2
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin"
          style={{ color: STATUS_META[status].fg }}
        />
      ) : (
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
          style={{ color: STATUS_META[status].fg }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-4 flex-1 min-w-[140px]"
      style={{ borderColor: COLORS.border, background: COLORS.bg }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: tint + "1A" }}
      >
        <Icon className="h-5 w-5" style={{ color: tint }} />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none" style={{ color: COLORS.text }}>
          {value}
        </div>
        <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function Banner({ icon: Icon, message, className = "" }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border p-4 text-sm ${className}`}
      style={{ borderColor: "#F3D9CE", background: "#FDEDE4", color: "#C1502E" }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm" style={{ color: COLORS.textMuted }}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading issues…
    </div>
  );
}

export default function AdminDashboard() {
  const [issues, setIssues] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("upvotes");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // 'list' | 'map'

  // Issues list: loading/error state
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState(null); // { status, message } | null

  // Stats bar: separate loading/error state, since it's a separate request
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Per-row "saving" state for status updates, keyed by issue id, so only
  // the row being changed shows a spinner rather than blocking the page.
  const [updatingIds, setUpdatingIds] = useState({});

  // ---- Fetch issues whenever server-side filters change ----
  useEffect(() => {
    const controller = new AbortController();

    async function fetchIssues() {
      setIssuesLoading(true);
      setIssuesError(null);
      try {
        const params = new URLSearchParams();
        if (categoryFilter !== "all") params.set("category", categoryFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        // Backend contract only documents sort=upvotes — for "newest" and
        // "urgency" we fetch unsorted and sort client-side below.
        if (sortBy === "upvotes") params.set("sort", "upvotes");

        const data = await apiFetch(`/api/issues?${params.toString()}`, {
          signal: controller.signal,
        });
        setIssues(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setIssuesError({ status: err.status, message: err.message });
      } finally {
        setIssuesLoading(false);
      }
    }

    fetchIssues();
    return () => controller.abort();
  }, [categoryFilter, statusFilter, sortBy]);

  // ---- Fetch stats once on mount (independent of issue filters — the
  // stats bar always reflects totals across all issues) ----
  useEffect(() => {
    const controller = new AbortController();

    async function fetchStats() {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await apiFetch("/api/admin/stats", { signal: controller.signal });
        setStats(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setStatsError({ status: err.status, message: err.message });
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
    return () => controller.abort();
  }, []);

  // Client-side search + fallback sorting (newest/urgency) on top of
  // whatever the server already filtered/sorted for us.
  const filtered = useMemo(() => {
    let list = [...issues];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.location?.blockName?.toLowerCase().includes(q)
      );
    }
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "urgency") {
      const rank = { reported: 0, in_progress: 1, resolved: 2 };
      list.sort((a, b) => rank[a.status] - rank[b.status] || b.upvotes.length - a.upvotes.length);
    }
    return list;
  }, [issues, sortBy, query]);

  async function updateStatus(id, newStatus) {
    setUpdatingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const updatedIssue = await apiFetch(`/api/issues/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // Wait-for-server: only commit the change once the PATCH confirms,
      // using the server's copy of the issue (not an optimistic guess).
      setIssues((prev) => prev.map((i) => (i._id === id ? updatedIssue : i)));
    } catch (err) {
      const msg =
        err.status === 403
          ? "Admin access required to update status."
          : err.message || "Failed to update status.";
      window.alert(msg); // simple for now — swap for a toast if you add one later
    } finally {
      setUpdatingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.bgSoft, color: COLORS.text }}>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>
              Admin Dashboard
            </h1>
            <p className="text-sm mt-0.5" style={{ color: COLORS.textMuted }}>
              Review, prioritize, and update campus issue reports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* List / Map toggle */}
            <div
              className="inline-flex rounded-xl border p-1"
              style={{ borderColor: COLORS.border, background: COLORS.bg }}
            >
              <button
                onClick={() => setView("list")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: view === "list" ? COLORS.accent : "transparent",
                  color: view === "list" ? "#FFFFFF" : COLORS.textMuted,
                }}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setView("map")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: view === "map" ? COLORS.accent : "transparent",
                  color: view === "map" ? "#FFFFFF" : COLORS.textMuted,
                }}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {statsError ? (
          <Banner
            className="mb-6"
            icon={statsError.status === 403 ? ShieldAlert : WifiOff}
            message={
              statsError.status === 403
                ? "Admin access required to view stats."
                : `Couldn't load stats: ${statsError.message}`
            }
          />
        ) : (
          <div className="mb-6 flex flex-wrap gap-3">
            <StatCard icon={AlertTriangle} label="Reported" value={statsLoading ? "—" : stats.open} tint="#E8734A" />
            <StatCard icon={Clock} label="In progress" value={statsLoading ? "—" : stats.inProgress} tint="#E8AC3C" />
            <StatCard icon={CheckCircle2} label="Resolved" value={statsLoading ? "—" : stats.resolved} tint={COLORS.mint} />
            <StatCard icon={LayoutGrid} label="Total issues" value={statsLoading ? "—" : stats.total} tint={COLORS.accent} />
          </div>
        )}

        {/* Filters */}
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border p-3"
          style={{ borderColor: COLORS.border, background: COLORS.bg }}
        >
          <div className="relative flex-1 min-w-[180px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: COLORS.textMuted }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or block…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border py-2 px-3 text-sm outline-none"
            style={{ borderColor: COLORS.border, color: COLORS.text, background: COLORS.bg }}
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([key, m]) => (
              <option key={key} value={key}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border py-2 px-3 text-sm outline-none"
            style={{ borderColor: COLORS.border, color: COLORS.text, background: COLORS.bg }}
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border py-2 px-3 text-sm outline-none"
            style={{ borderColor: COLORS.border, color: COLORS.text, background: COLORS.bg }}
          >
            <option value="upvotes">Sort: Most upvoted</option>
            <option value="urgency">Sort: Urgency</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        {/* Issues: loading / error / content */}
        {issuesError ? (
          <Banner
            icon={issuesError.status === 403 ? ShieldAlert : WifiOff}
            message={
              issuesError.status === 403
                ? "Admin access required to view issues. Ask Aradhya for an admin test token."
                : `Couldn't load issues: ${issuesError.message}`
            }
          />
        ) : issuesLoading ? (
          <div
            className="rounded-2xl border"
            style={{ borderColor: COLORS.border, background: COLORS.bg }}
          >
            <LoadingRows />
          </div>
        ) : (
          <>
        {/* Map view */}
        {view === "map" && (
          <IssueMap issues={filtered} onStatusChange={updateStatus} />
        )}

        {/* Desktop table */}
        {view === "list" && (
        <div
          className="hidden md:block overflow-hidden rounded-2xl border"
          style={{ borderColor: COLORS.border, background: COLORS.bg }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.bgSoft }}>
                {["Issue", "Category", "Location", "Upvotes", "Reported", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left font-medium px-4 py-3 text-xs uppercase tracking-wide"
                    style={{ color: COLORS.textMuted }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, idx) => (
                <tr
                  key={issue._id}
                  style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    background: idx % 2 === 1 ? COLORS.bgSoft + "80" : "transparent",
                  }}
                >
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="font-medium truncate" style={{ color: COLORS.text }}>
                      {issue.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: COLORS.textMuted }}>
                      {issue.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {CATEGORY_META[issue.category].icon} {CATEGORY_META[issue.category].label}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMuted }}>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {issue.location.blockName}
                    </span>
                    {issue.location.floorRoom && (
                      <div className="text-xs mt-0.5 pl-5" style={{ color: COLORS.textMuted }}>
                        {issue.location.floorRoom}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <ThumbsUp className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
                      {issue.upvotes.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMuted }}>
                    {timeAgo(issue.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusDropdown
                      status={issue.status}
                      saving={!!updatingIds[issue._id]}
                      onChange={(v) => updateStatus(issue._id, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: COLORS.textMuted }}>
              No issues match these filters.
            </div>
          )}
        </div>
        )}

        {/* Mobile cards */}
        {view === "list" && (
        <div className="md:hidden flex flex-col gap-3">
          {filtered.map((issue) => (
            <div
              key={issue._id}
              className="rounded-2xl border p-4"
              style={{ borderColor: COLORS.border, background: COLORS.bg }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium" style={{ color: COLORS.text }}>
                    {issue.title}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                    {CATEGORY_META[issue.category].icon} {CATEGORY_META[issue.category].label} ·{" "}
                    {issue.location.blockName}
                    {issue.location.floorRoom ? ` · ${issue.location.floorRoom}` : ""}
                  </div>
                </div>
                <StatusBadge status={issue.status} />
              </div>
              <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
                {issue.description}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="inline-flex items-center gap-1 text-sm font-medium">
                  <ThumbsUp className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
                  {issue.upvotes.length} · {timeAgo(issue.createdAt)}
                </span>
                <StatusDropdown
                  status={issue.status}
                  saving={!!updatingIds[issue._id]}
                  onChange={(v) => updateStatus(issue._id, v)}
                />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              className="rounded-2xl border p-8 text-center text-sm"
              style={{ borderColor: COLORS.border, background: COLORS.bg, color: COLORS.textMuted }}
            >
              No issues match these filters.
            </div>
          )}
        </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
