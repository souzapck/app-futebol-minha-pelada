import { useState } from "react";
import GoalsRankingPage from "./GoalsRankingPage.jsx";
import BallRankingPage from "./BallRankingPage.jsx";

export default function RankingPage() {
  const [subView, setSubView] = useState("goals");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: "40px" }}>
      {/*<div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #eee",
          marginBottom: "20px"
        }}
      >
        <h2 style={{ margin: 0, color: "#333", textAlign: "center" }}>
          🏆 Ranking
        </h2>
        <p
          style={{
            margin: "8px 0 0 0",
            color: "#666",
            textAlign: "center",
            fontSize: "14px"
          }}
        >
          Escolha o ranking que deseja visualizar.
        </p>
      </div>*/}

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
          onClick={() => setSubView("goals")}
          style={{
            padding: "10px 18px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "goals" ? "#28a745" : "#eee",
            color: subView === "goals" ? "white" : "#333"
          }}
        >
          ⚽ Artilharia
        </button>

        <button
          onClick={() => setSubView("ball")}
          style={{
            padding: "10px 18px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "ball" ? "#28a745" : "#eee",
            color: subView === "ball" ? "white" : "#333"
          }}
        >
          ⚽ Bola Cheia / 🎈 Bola Murcha
        </button>
      </div>

      {subView === "goals" && <GoalsRankingPage />}
      {subView === "ball" && <BallRankingPage />}
    </div>
  );
}