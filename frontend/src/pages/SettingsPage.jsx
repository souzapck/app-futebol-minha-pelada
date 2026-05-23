import { useState } from "react";
import GroupSettingsPage from "./GroupSettingsPage.jsx";
import PointsSettingsPage from "./PointsSettingsPage";
import VotingSettingsPage from "./VotingSettingsPage";

export default function SettingsPage() {
  const [subView, setSubView] = useState("group");

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "25px"
        }}
      >
        <button
          onClick={() => setSubView("group")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "group" ? "#007bff" : "#eee",
            color: subView === "group" ? "white" : "#333"
          }}
        >
          ⚙️ Grupo
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
      </div>
      {subView === "group" && <GroupSettingsPage />}
      {subView === "points" && <PointsSettingsPage />}
      {subView === "voting" && <VotingSettingsPage />}
    </div>
  );
}