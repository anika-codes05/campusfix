import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Camera, MapPin, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/* ---------------------------------------------------------
   CampusFix — Report Issue Page
   Same design system as AdminDashboard.jsx.
   Flow: pick location on map -> fill form -> check-duplicate
   -> if match found, ask "same issue?" -> join existing OR
   create new.
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

const CATEGORY_META = {
  electrical: { label: "Electrical", icon: "⚡" },
  plumbing: { label: "Plumbing", icon: "🚰" },
  mess: { label: "Mess", icon: "🍽️" },
  infrastructure: { label: "Infrastructure", icon: "🏗️" },
  other: { label: "Other", icon: "📋" },
};

// Default map center — KIET Group of Institutions, Ghaziabad (Meerut Rd, Muradnagar)
const DEFAULT_CENTER = [28.7526, 77.4985];

// Fix Leaflet's default marker icon path (breaks under bundlers otherwise)
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const API_BASE = "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("campusfix_token");
}

// Clicking anywhere on the map drops/moves the pin here
function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} icon={markerIcon} /> : null;
}

export default function ReportIssue() {
  const [position, setPosition] = useState(null);
  const [blockName, setBlockName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("electrical");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Flow state: 'form' -> 'checking' -> 'duplicates-found' -> 'submitting' -> 'done'
  const [stage, setStage] = useState("form");
  const [duplicates, setDuplicates] = useState([]);
  const [error, setError] = useState("");

  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  function resetForm() {
    setPosition(null);
    setBlockName("");
    setTitle("");
    setDescription("");
    setCategory("electrical");
    setPhoto(null);
    setPhotoPreview(null);
    setStage("form");
    setDuplicates([]);
    setError("");
  }

  async function handleCheckDuplicate(e) {
    e.preventDefault();
    setError("");

    if (!position) {
      setError("Please tap the map to pin the issue's location.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("Please fill in a title and description.");
      return;
    }

    setStage("checking");
    try {
      const res = await fetch(`${API_BASE}/issues/check-duplicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ lat: position[0], lng: position[1], category }),
      });
      if (!res.ok) throw new Error("Could not check for duplicates. Please try again.");
      const data = await res.json();

      if (data.hasDuplicates) {
        setDuplicates(data.matches);
        setStage("duplicates-found");
      } else {
        await submitIssue(null);
      }
    } catch (err) {
      setError(err.message);
      setStage("form");
    }
  }

  // joinExistingId: pass an issue _id to join it instead of creating new
  async function submitIssue(joinExistingId) {
    setStage("submitting");
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("lat", position[0]);
      formData.append("lng", position[1]);
      formData.append("blockName", blockName);
      if (joinExistingId) formData.append("joinExistingId", joinExistingId);
      if (photo && !joinExistingId) formData.append("photo", photo);

      const res = await fetch(`${API_BASE}/issues`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to submit the report. Please try again.");

      setStage("done");
    } catch (err) {
      setError(err.message);
      setStage("duplicates-found"); // fall back so they can retry
    }
  }

  const inputStyle = {
    borderColor: COLORS.border,
    color: COLORS.text,
    background: COLORS.bg,
  };

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.bgSoft, color: COLORS.text }}>
      <div className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>
          Report an Issue
        </h1>
        <p className="text-sm mt-0.5 mb-6" style={{ color: COLORS.textMuted }}>
          Tap the map to pin the exact spot, then tell us what's wrong.
        </p>

        {stage === "done" ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ borderColor: COLORS.border, background: COLORS.bg }}
          >
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: COLORS.mint }} />
            <h2 className="text-lg font-medium" style={{ color: COLORS.text }}>
              Report submitted
            </h2>
            <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
              Thanks — the maintenance team will pick this up.
            </p>
            <button
              onClick={resetForm}
              className="mt-4 rounded-xl px-4 py-2 text-sm font-medium"
              style={{ background: COLORS.accent, color: "#fff" }}
            >
              Report another issue
            </button>
          </div>
        ) : stage === "duplicates-found" ? (
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: COLORS.border, background: COLORS.bg }}
          >
            <div className="flex items-start gap-2 mb-4">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#E8AC3C" }} />
              <div>
                <h2 className="font-medium" style={{ color: COLORS.text }}>
                  Is this the same issue?
                </h2>
                <p className="text-sm mt-0.5" style={{ color: COLORS.textMuted }}>
                  Someone nearby already reported something similar. If it's the same
                  problem, join their report instead of creating a duplicate — it helps
                  us see how many people are affected.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {duplicates.map((d) => (
                <div
                  key={d._id}
                  className="flex items-center justify-between rounded-xl border p-3"
                  style={{ borderColor: COLORS.border, background: COLORS.bgSoft }}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: COLORS.text }}>
                      {CATEGORY_META[d.category]?.icon} {d.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                      {d.upvoteCount} people reported this · {d.status}
                    </div>
                  </div>
                  <button
                    onClick={() => submitIssue(d._id)}
                    disabled={stage === "submitting"}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
                    style={{ background: COLORS.accent, color: "#fff" }}
                  >
                    Yes, same issue
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm mb-3" style={{ color: "#C1502E" }}>
                {error}
              </p>
            )}

            <button
              onClick={() => submitIssue(null)}
              disabled={stage === "submitting"}
              className="w-full rounded-xl border py-2.5 text-sm font-medium"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            >
              {stage === "submitting" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </span>
              ) : (
                "No, this is a different issue — submit as new"
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCheckDuplicate} className="flex flex-col gap-4">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ borderColor: COLORS.border }}
            >
              <div style={{ height: "280px" }}>
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={17}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <LocationPicker position={position} setPosition={setPosition} />
                </MapContainer>
              </div>
              <div
                className="px-3 py-2 text-xs flex items-center gap-1.5"
                style={{ background: COLORS.bgSoft, color: COLORS.textMuted }}
              >
                <MapPin className="h-3.5 w-3.5" />
                {position
                  ? `Pinned at ${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
                  : "Tap the map to drop a pin"}
              </div>
            </div>

            <input
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="Block / building name (e.g. Hostel C)"
              className="rounded-xl border py-2.5 px-3 text-sm outline-none"
              style={inputStyle}
            />

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title (e.g. Broken AC in room 204)"
              className="rounded-xl border py-2.5 px-3 text-sm outline-none"
              style={inputStyle}
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="rounded-xl border py-2.5 px-3 text-sm outline-none resize-none"
              style={inputStyle}
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border py-2.5 px-3 text-sm outline-none"
              style={inputStyle}
            >
              {Object.entries(CATEGORY_META).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>

            <label
              className="rounded-xl border py-2.5 px-3 text-sm flex items-center gap-2 cursor-pointer"
              style={inputStyle}
            >
              <Camera className="h-4 w-4" style={{ color: COLORS.textMuted }} />
              {photo ? photo.name : "Add a photo (optional)"}
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>

            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                className="rounded-xl border h-32 w-full object-cover"
                style={{ borderColor: COLORS.border }}
              />
            )}

            {error && (
              <p className="text-sm" style={{ color: "#C1502E" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={stage === "checking"}
              className="rounded-xl py-2.5 text-sm font-medium"
              style={{ background: COLORS.accent, color: "#fff" }}
            >
              {stage === "checking" ? (
                <span className="inline-flex items-center gap-2 justify-center w-full">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking for similar reports...
                </span>
              ) : (
                "Submit report"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
