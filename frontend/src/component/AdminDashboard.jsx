import { useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, MapPin, ThumbsUp, ChevronDown, Search, LayoutGrid } from "lucide-react";

/* ---------------------------------------------------------
   CampusFix — Admin Dashboard
   Palette (from design brief):
     bg base       #FFFFFF / #F4FAF9
     text primary  #1B2A2E
     text muted    #5C6B6E
     accent        #028090 (teal) / #00A896 (secondary) / #02C39A (mint)
     border        #E4EEEC
     status: reported = coral/orange, in_progress = amber, resolved = mint
   Mock data only — no API calls. Swap fetchIssues()/fetchStats()
   for real calls once backend routes are wired up.
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

// ---------- Mock data (matches Issue shape from the API contract) ----------
const MOCK_ISSUES = [
  {
    _id: "1",
    title: "Flickering tube light in Block C corridor",
    description: "Light near room 214 flickers constantly, strains eyes at night.",
    category: "electrical",
    location: { lat: 28.6139, lng: 77.209, blockName: "Block C" },
    photoUrl: null,
    reportedBy: [{ name: "Meera Iyer", email: "meera@campus.edu" }],
    upvotes: Array(14).fill({}),
    status: "reported",
    createdAt: "2026-08-15T09:20:00Z",
  },
  {
    _id: "2",
    title: "Leaking pipe outside Hostel D washroom",
    description: "Water pooling on the floor since yesterday evening, slippery.",
    category: "plumbing",
    location: { lat: 28.615, lng: 77.208, blockName: "Hostel D" },
    photoUrl: null,
    reportedBy: [{ name: "Aman Verma", email: "aman@campus.edu" }, { name: "Riya Sen", email: "riya@campus.edu" }],
    upvotes: Array(31).fill({}),
    status: "in_progress",
    createdAt: "2026-08-13T14:05:00Z",
  },
  {
    _id: "3",
    title: "Mess serving cold food during dinner",
    description: "Dinner has been served lukewarm to cold for the past three days.",
    category: "mess",
    location: { lat: 28.6142, lng: 77.2101, blockName: "Central Mess" },
    photoUrl: null,
    reportedBy: [{ name: "Kabir Shah", email: "kabir@campus.edu" }],
    upvotes: Array(52).fill({}),
    status: "reported",
    createdAt: "2026-08-16T19:40:00Z",
  },
  {
    _id: "4",
    title: "Broken handrail on library staircase",
    description: "Handrail is loose near the second floor landing, safety risk.",
    category: "infrastructure",
    location: { lat: 28.6128, lng: 77.2095, blockName: "Library" },
    photoUrl: null,
    reportedBy: [{ name: "Nisha Patel", email: "nisha@campus.edu" }],
    upvotes: Array(9).fill({}),
    status: "resolved",
    createdAt: "2026-08-09T11:15:00Z",
    resolvedAt: "2026-08-12T10:00:00Z",
  },
  {
    _id: "5",
    title: "Projector not turning on in Room 301",
    description: "Projector in the seminar room hasn't worked for a week.",
    category: "electrical",
    location: { lat: 28.6135, lng: 77.211, blockName: "Academic Block" },
    photoUrl: null,
    reportedBy: [{ name: "Devansh Rao", email: "devansh@campus.edu" }],
    upvotes: Array(6).fill({}),
    status: "in_progress",
    createdAt: "2026-08-14T08:30:00Z",
  },
  {
    _id: "6",
    title: "Clogged drain near canteen entrance",
    description: "Standing water attracting mosquitoes, needs urgent clearing.",
    category: "plumbing",
    location: { lat: 28.6141, lng: 77.2088, blockName: "Canteen" },
    photoUrl: null,
    reportedBy: [{ name: "Sara Khan", email: "sara@campus.edu" }],
    upvotes: Array(22).fill({}),
    status: "reported",
    createdAt: "2026-08-16T07:50:00Z",
  },
  {
    _id: "7",
    title: "Vending machine out of order",
    description: "Coin slot jammed, machine displays error since Monday.",
    category: "other",
    location: { lat: 28.6133, lng: 77.2079, blockName: "Block A" },
    photoUrl: null,
    reportedBy: [{ name: "Yash Malhotra", email: "yash@campus.edu" }],
    upvotes: Array(3).fill({}),
    status: "resolved",
    createdAt: "2026-08-05T16:00:00Z",
    resolvedAt: "2026-08-07T09:30:00Z",
  },
  {
    _id: "8",
    title: "Cracked window pane in Hostel B common room",
    description: "Glass is cracked and could fall, needs replacement soon.",
    category: "infrastructure",
    location: { lat: 28.6119, lng: 77.2105, blockName: "Hostel B" },
    photoUrl: null,
    reportedBy: [{ name: "Priya Nair", email: "priya@campus.edu" }],
    upvotes: Array(17).fill({}),
    status: "in_progress",
    createdAt: "2026-08-12T13:10:00Z",
  },
];

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

function StatusDropdown({ status, onChange }) {
  return (
    <div className="relative inline-block">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition-colors"
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
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
        style={{ color: STATUS_META[status].fg }}
      />
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

export default function AdminDashboard() {
  const [issues, setIssues] = useState(MOCK_ISSUES);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("upvotes");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status === "reported").length;
    const inProgress = issues.filter((i) => i.status === "in_progress").length;
    const resolved = issues.filter((i) => i.status === "resolved").length;
    return { open, inProgress, resolved, total: issues.length };
  }, [issues]);

  const filtered = useMemo(() => {
    let list = [...issues];
    if (categoryFilter !== "all") list = list.filter((i) => i.category === categoryFilter);
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.location.blockName.toLowerCase().includes(q)
      );
    }
    if (sortBy === "upvotes") {
      list.sort((a, b) => b.upvotes.length - a.upvotes.length);
    } else if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "urgency") {
      const rank = { reported: 0, in_progress: 1, resolved: 2 };
      list.sort((a, b) => rank[a.status] - rank[b.status] || b.upvotes.length - a.upvotes.length);
    }
    return list;
  }, [issues, categoryFilter, statusFilter, sortBy, query]);

  function updateStatus(id, newStatus) {
    setIssues((prev) =>
      prev.map((i) =>
        i._id === id
          ? {
              ...i,
              status: newStatus,
              resolvedAt: newStatus === "resolved" ? new Date().toISOString() : i.resolvedAt,
            }
          : i
      )
    );
    // TODO: replace with PATCH /api/issues/:id/status once backend route is finished
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
          <div
            className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: COLORS.accent + "14", color: COLORS.accent }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Mock data — API not connected
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-6 flex flex-wrap gap-3">
          <StatCard icon={AlertTriangle} label="Reported" value={stats.open} tint="#E8734A" />
          <StatCard icon={Clock} label="In progress" value={stats.inProgress} tint="#E8AC3C" />
          <StatCard icon={CheckCircle2} label="Resolved" value={stats.resolved} tint={COLORS.mint} />
          <StatCard icon={LayoutGrid} label="Total issues" value={stats.total} tint={COLORS.accent} />
        </div>

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

        {/* Desktop table */}
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
                    <StatusDropdown status={issue.status} onChange={(v) => updateStatus(issue._id, v)} />
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

        {/* Mobile cards */}
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
                <StatusDropdown status={issue.status} onChange={(v) => updateStatus(issue._id, v)} />
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
      </div>
    </div>
  );
}
