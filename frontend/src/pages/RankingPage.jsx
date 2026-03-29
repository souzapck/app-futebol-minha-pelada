import { useState } from "react";
import GoalsRankingPage from "./GoalsRankingPage.jsx";
import BallRankingPage from "./BallRankingPage.jsx";

export default function RankingPage() {
  const [subView, setSubView] = useState("goals");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

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

      {subView === "goals" && <GoalsRankingPage />}
      {subView === "ball" && <BallRankingPage />}

      {subView === "points" && (
        <div style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #ddd",
          textAlign: "center"
        }}>
          <h3 style={{ marginTop: 0 }}>📊 Pontuação</h3>
          <p style={{ color: "#666" }}>
            Em breve você verá aqui o ranking por pontuação geral dos jogadores.
          </p>
        </div>
      )}
      
    </div>
  );
}