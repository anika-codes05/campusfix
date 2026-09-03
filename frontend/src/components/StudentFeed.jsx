import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, MapPin, ThumbsUp, Search, List, Map as MapIcon, Loader2, WifiOff, Plus } from "lucide-react";
import IssueMap from "./IssueMap";
import { apiFetch, getUserId } from "../api";

/* ---------------------------------------------------------
   CampusFix — Student Feed
   Same design language as AdminDashboard: white/#F4FAF9 bg,
   #1B2A2E/#5C6B6E text, #028090 teal accent, #E4EEEC borders,
   card-based (per project brief), List/Map toggle.

   Differs from AdminDashboard:
     - No status-change controls — status is a read-only badge
     - Upvote button instead of a status dropdown
     - Card grid instead of a table (brief calls for "card-based"
       on the student-facing page specifically)
     - "Report an issue" button — Aradhya confirmed ReportIssue.jsx
       already exists and works (map pin-drop, block/floor/room,
       title, description, category, optional photo). This button
       just calls `onReportClick` when clicked — wire that prop up
       in App.jsx once ReportIssue.jsx is placed in this project.

   Upvoting: POST /api/issues/:id/upvote is a real toggle — calling it
   again removes a prior upvote. The response is { upvoteCount, upvoted },
   which drives the button's filled/outline state directly (with the
   initial pre-click state inferred from whether the current user's id is
   already in the issue's upvotes array, since the list endpoint doesn't
   include an `upvoted` flag).
--------------------------------------------------------- */

const COLORS = {
  bg: "#FFFFFF",
  bgSoft: "#F4FAF9",
  text: "#1B2A2E",
  textMuted: "#5C6B6E",
  accent: "#028090",
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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function UpvoteButton({ upvoted, count, saving, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait"
      style={{
        borderColor: upvoted ? COLORS.accent : COLORS.border,
        background: upvoted ? COLORS.accent + "14" : COLORS.bg,
        color: upvoted ? COLORS.accent : COLORS.textMuted,
      }}
      title={upvoted ? "Click to remove your upvote" : "Upvote this issue"}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ThumbsUp className="h-3.5 w-3.5" fill={upvoted ? COLORS.accent : "none"} />
      )}
      {count}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-4 flex-1 min-w-[140px]"
      style={{ borderColor: COLORS.border, background: COLORS.bg }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: tint + "1A" }}>
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

function Banner({ icon: Icon, message }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl border p-4 text-sm"
      style={{ borderColor: "#F3D9CE", background: "#FDEDE4", color: "#C1502E" }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function IssueCard({ issue, upvoted, count, saving, onUpvote }) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: COLORS.border, background: COLORS.bg }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate" style={{ color: COLORS.text }}>
            {issue.title}
          </div>
          <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
            {CATEGORY_META[issue.category]?.icon} {CATEGORY_META[issue.category]?.label}
          </div>
        </div>
        <StatusBadge status={issue.status} />
      </div>

      <p className="text-sm" style={{ color: COLORS.textMuted }}>
        {issue.description}
      </p>

      <div className="flex items-center gap-1 text-xs" style={{ color: COLORS.textMuted }}>
        <MapPin className="h-3.5 w-3.5" />
        {issue.location?.blockName}
        {issue.location?.floorRoom ? ` · ${issue.location.floorRoom}` : ""}
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          {timeAgo(issue.createdAt)}
        </span>
        <UpvoteButton upvoted={upvoted} count={count} saving={saving} onClick={() => onUpvote(issue._id)} />
      </div>
    </div>
  );
}

export default function StudentFeed({ onReportClick }) {
  const [issues, setIssues] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("upvotes");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // 'list' | 'map'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upvotingIds, setUpvotingIds] = useState({});
  // Per-issue overrides after a successful upvote/unvote toggle, since the
  // POST /upvote response only returns { upvoteCount, upvoted } — not a
  // full issue object — this is cheaper than refetching the whole list.
  const [upvoteOverrides, setUpvoteOverrides] = useState({});

  const currentUserId = getUserId();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchIssues() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (categoryFilter !== "all") params.set("category", categoryFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (sortBy === "upvotes") params.set("sort", "upvotes");

        const data = await apiFetch(`/api/issues?${params.toString()}`, {
          signal: controller.signal,
        });
        setIssues(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError({ status: err.status, message: err.message });
      } finally {
        setLoading(false);
      }
    }

    fetchIssues();
    return () => controller.abort();
  }, [categoryFilter, statusFilter, sortBy]);

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
    }
    return list;
  }, [issues, sortBy, query]);

  function hasUpvoted(issue) {
    if (!currentUserId) return false;
    return issue.upvotes?.some((u) => (typeof u === "string" ? u === currentUserId : u._id === currentUserId));
  }

  // Resolves the display count/upvoted state for a card: an override from
  // a just-completed toggle wins, otherwise fall back to what the list
  // fetch returned.
  function getUpvoteState(issue) {
    const override = upvoteOverrides[issue._id];
    if (override) return override;
    return { count: issue.upvotes?.length ?? 0, upvoted: hasUpvoted(issue) };
  }

  async function handleUpvote(id) {
    setUpvotingIds((prev) => ({ ...prev, [id]: true }));
    try {
      // POST toggles: calling it again removes a prior upvote. Response
      // shape: { upvoteCount, upvoted }.
      const data = await apiFetch(`/api/issues/${id}/upvote`, { method: "POST" });
      setUpvoteOverrides((prev) => ({
        ...prev,
        [id]: { count: data.upvoteCount, upvoted: data.upvoted },
      }));
    } catch (err) {
      window.alert(err.message || "Failed to update upvote.");
    } finally {
      setUpvotingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status === "reported").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    return { open, inProgress, resolved };
  }, [issues]);

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.bgSoft, color: COLORS.text }}>
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>
              Campus Issues
            </h1>
            <p className="text-sm mt-0.5" style={{ color: COLORS.textMuted }}>
              Browse what's been reported around campus and upvote what affects you too.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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

            <button
              onClick={onReportClick}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
              style={{ background: COLORS.accent }}
            >
              <Plus className="h-4 w-4" />
              Report an issue
            </button>
          </div>
        </div>

        {/* Quick stats (read-only, no "total"/admin framing) */}
        <div className="mb-6 flex flex-wrap gap-3">
          <StatCard icon={AlertTriangle} label="Reported" value={loading ? "—" : stats.open} tint="#E8734A" />
          <StatCard icon={Clock} label="In progress" value={loading ? "—" : stats.inProgress} tint="#E8AC3C" />
          <StatCard icon={CheckCircle2} label="Resolved" value={loading ? "—" : stats.resolved} tint={COLORS.mint} />
        </div>

        {/* Filters */}
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border p-3"
          style={{ borderColor: COLORS.border, background: COLORS.bg }}
        >
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: COLORS.textMuted }} />
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
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        {/* Content */}
        {error ? (
          <Banner icon={WifiOff} message={`Couldn't load issues: ${error.message}`} />
        ) : loading ? (
          <div
            className="flex items-center justify-center gap-2 rounded-2xl border p-10 text-sm"
            style={{ borderColor: COLORS.border, background: COLORS.bg, color: COLORS.textMuted }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading issues…
          </div>
        ) : view === "map" ? (
          <IssueMap issues={filtered} />
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center text-sm"
            style={{ borderColor: COLORS.border, background: COLORS.bg, color: COLORS.textMuted }}
          >
            No issues match these filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((issue) => {
              const { count, upvoted } = getUpvoteState(issue);
              return (
                <IssueCard
                  key={issue._id}
                  issue={issue}
                  upvoted={upvoted}
                  count={count}
                  saving={!!upvotingIds[issue._id]}
                  onUpvote={handleUpvote}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
