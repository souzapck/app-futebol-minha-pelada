import { useState } from "react";
import VotingSettingsPage from "./VotingSettingsPage";
import PointsSettingsPage from "./PointsSettingsPage";

export default function SettingsPage() {
  const [subView, setSubView] = useState("voting");

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      <div
        style={{
          background: "#fff",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #ddd",
          marginBottom: "20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
        }}
      >
        <h2 style={{ margin: "0 0 12px 0", color: "#333", textAlign: "center" }}>
          ⚙️ Parametrizações
        </h2>

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            flexWrap: "wrap"
          }}
        >
          <button
            onClick={() => setSubView("voting")}
            style={{
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              background: subView === "voting" ? "#007bff" : "#eee",
              color: subView === "voting" ? "white" : "#333"
            }}
          >
            🗳️ Votação
          </button>

          <button
            onClick={() => setSubView("points")}
            style={{
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              background: subView === "points" ? "#007bff" : "#eee",
              color: subView === "points" ? "white" : "#333"
            }}
          >
            📊 Pontuação
          </button>
        </div>
      </div>

      {subView === "voting" && <VotingSettingsPage />}
      {subView === "points" && <PointsSettingsPage />}
    </div>
  );
}