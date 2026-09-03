import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ThumbsUp } from "lucide-react";

/* ---------------------------------------------------------
   CampusFix — Admin Map View
   Plots issues as pins color-coded by status. Clicking a pin
   opens a popup with title, category, upvotes, and (for the
   admin view) an inline status dropdown.
   Mock data only — same MOCK_ISSUES shape as AdminDashboard.
--------------------------------------------------------- */

const COLORS = {
  bg: "#FFFFFF",
  text: "#1B2A2E",
  textMuted: "#5C6B6E",
  accent: "#028090",
  border: "#E4EEEC",
};

const STATUS_META = {
  reported: { label: "Reported", color: "#E8734A" },
  in_progress: { label: "In progress", color: "#E8AC3C" },
  resolved: { label: "Resolved", color: "#02C39A" },
};

const CATEGORY_META = {
  electrical: { label: "Electrical", icon: "⚡" },
  plumbing: { label: "Plumbing", icon: "🚰" },
  mess: { label: "Mess", icon: "🍽️" },
  infrastructure: { label: "Infrastructure", icon: "🏗️" },
  other: { label: "Other", icon: "📋" },
};

const STATUS_ORDER = ["reported", "in_progress", "resolved"];

// Leaflet's default marker icon path breaks under bundlers like Vite
// because it references image URLs relative to the leaflet package rather
// than the app's asset pipeline. Building icons as inline SVG data URIs
// sidesteps that entirely and lets us color-code by status for free.
function makePinIcon(color) {
  const svg = `
    <svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24c0-7.7-6.3-14-14-14z"
            fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5.5" fill="#FFFFFF"/>
    </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

const PIN_ICONS = {
  reported: makePinIcon(STATUS_META.reported.color),
  in_progress: makePinIcon(STATUS_META.in_progress.color),
  resolved: makePinIcon(STATUS_META.resolved.color),
};

/**
 * @param {Array} issues - issues to plot, each with location.lat/lng
 * @param {(id: string, status: string) => void} [onStatusChange] - if
 *   provided, popups show an inline status dropdown (admin use). Omit this
 *   prop entirely for the student-facing feed to get a read-only popup.
 * @param {[number, number]} [center] - map center, defaults to the
 *   average of all issue coordinates so the view is never empty.
 */
export default function IssueMap({ issues, onStatusChange, center }) {
  const validIssues = issues.filter(
    (i) => typeof i.location?.lat === "number" && typeof i.location?.lng === "number"
  );

  const mapCenter =
    center ||
    (validIssues.length
      ? [
          validIssues.reduce((sum, i) => sum + i.location.lat, 0) / validIssues.length,
          validIssues.reduce((sum, i) => sum + i.location.lng, 0) / validIssues.length,
        ]
      : [28.7526, 77.4985]); // fallback: KIET Ghaziabad, so the map never renders blank

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: COLORS.border, background: COLORS.bg }}
    >
      <div style={{ height: "520px", width: "100%" }}>
        <MapContainer
          center={mapCenter}
          zoom={16}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {validIssues.map((issue) => (
            <Marker
              key={issue._id}
              position={[issue.location.lat, issue.location.lng]}
              icon={PIN_ICONS[issue.status] || PIN_ICONS.reported}
            >
              <Popup minWidth={220}>
                <div style={{ fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
                    {CATEGORY_META[issue.category]?.icon} {CATEGORY_META[issue.category]?.label}
                    {issue.location.blockName ? ` · ${issue.location.blockName}` : ""}
                    {issue.location.floorRoom ? ` · ${issue.location.floorRoom}` : ""}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: COLORS.accent,
                      marginBottom: onStatusChange ? 8 : 0,
                    }}
                  >
                    <ThumbsUp size={12} />
                    {issue.upvotes?.length ?? 0} upvotes
                  </div>

                  {onStatusChange ? (
                    <select
                      value={issue.status}
                      onChange={(e) => onStatusChange(issue._id, e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: 12,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.text,
                        background: COLORS.bg,
                      }}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: "#FFFFFF",
                        background: STATUS_META[issue.status]?.color || STATUS_META.reported.color,
                      }}
                    >
                      {STATUS_META[issue.status]?.label}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
