import { useState } from "react";
import AdminDashboard from "./components/AdminDashboard";
import StudentFeed from "./components/StudentFeed";
import ReportIssue from "./components/ReportIssue";
import { ArrowLeft } from "lucide-react";

// No router set up yet in this project — this is a simple state-based
// toggle to preview pages during development. Once react-router (or
// similar) is added, replace this with real routes, e.g. "/admin", "/",
// and "/report".
function App() {
  const [page, setPage] = useState("admin"); // 'admin' | 'student'
  const [showReport, setShowReport] = useState(false);

  if (showReport) {
    return (
      <div>
        <button
          onClick={() => setShowReport(false)}
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 50,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#FFFFFF",
            border: "1px solid #E4EEEC",
            borderRadius: 12,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            color: "#1B2A2E",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} />
          Back to feed
        </button>
        <ReportIssue />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 50,
          display: "flex",
          gap: 4,
          background: "#FFFFFF",
          border: "1px solid #E4EEEC",
          borderRadius: 12,
          padding: 4,
        }}
      >
        <button
          onClick={() => setPage("admin")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            background: page === "admin" ? "#028090" : "transparent",
            color: page === "admin" ? "#FFFFFF" : "#5C6B6E",
          }}
        >
          Admin view
        </button>
        <button
          onClick={() => setPage("student")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            background: page === "student" ? "#028090" : "transparent",
            color: page === "student" ? "#FFFFFF" : "#5C6B6E",
          }}
        >
          Student view
        </button>
      </div>

      {page === "admin" ? (
        <AdminDashboard />
      ) : (
        <StudentFeed onReportClick={() => setShowReport(true)} />
      )}
    </div>
  );
}

export default App;
