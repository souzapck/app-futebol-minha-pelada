import { useState } from "react";

export default function VotingPage() {
  const [subView, setSubView] = useState("bola");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "40px" }}>
      <div
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
          🗳️ Votação
        </h2>
        <p
          style={{
            margin: "8px 0 0 0",
            color: "#666",
            textAlign: "center",
            fontSize: "14px"
          }}
        >
          Escolha uma funcionalidade de votação abaixo.
        </p>
      </div>

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
            padding: "10px 18px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "bola" ? "#28a745" : "#eee",
            color: subView === "bola" ? "white" : "#333"
          }}
        >
          ⚽ Bola cheia / Bola murcha
        </button>

        <button
          onClick={() => setSubView("estrelas")}
          style={{
            padding: "10px 18px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subView === "estrelas" ? "#28a745" : "#eee",
            color: subView === "estrelas" ? "white" : "#333"
          }}
        >
          ⭐ Atualizar estrelas
        </button>
      </div>

      {subView === "bola" && (
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
            ⚽ Bola cheia / Bola murcha
          </h3>
          <p style={{ color: "#666", marginBottom: 0 }}>
            Aqui vamos montar a votação de destaque positivo e negativo da partida.
          </p>
        </div>
      )}

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