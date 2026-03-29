import { useState } from "react";
import BallVotePage from "./BallVotePage.jsx";

export default function VotingPage({ user }) {
  const [subView, setSubView] = useState("bola");

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
          onClick={() => setSubView("bola")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "bola" ? "#007bff" : "#eee",
            color: subView === "bola" ? "white" : "#333"
          }}
        >
          ⚽ Bola cheia / 🎈 Bola murcha
        </button>

        <button
          onClick={() => setSubView("estrelas")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "estrelas" ? "#007bff" : "#eee",
            color: subView === "estrelas" ? "white" : "#333"
          }}
        >
          ⭐ Atualizar estrelas
        </button>
      </div>

      {subView === "bola" && <BallVotePage user={user} />}

      {subView === "estrelas" && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid #eee",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
          }}
        >
          <h3 style={{ marginTop: 0, color: "#333" }}>
            ⭐ Atualizar estrelas
          </h3>
          <p style={{ color: "#666", marginBottom: 0 }}>
            Aqui vamos montar a atualização da classificação dos jogadores.
          </p>
        </div>
      )}
    </div>
  );
}