import React from "react";
import { useGroup } from "../contexts/GroupContext";

export default function DashboardPage({ user, onNavigate }) {
  const { activeGroup } = useGroup();

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "22px", color: "#333", marginBottom: "30px" }}>
        Olá, {user?.players?.name?.split(" ")[0]}! 👋
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
        
        {/* Card de Ação Principal */}
        <button 
          onClick={() => onNavigate("matches")}
          style={{ padding: "20px", background: "#007bff", color: "white", border: "none", borderRadius: "16px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,123,255,0.3)" }}
        >
          ⚽ Ver Próxima Partida
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <button onClick={() => onNavigate("teams")} style={{ padding: "15px", background: "#fff", border: "1px solid #ddd", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
            🆎 Times
          </button>
          <button onClick={() => onNavigate("ranking")} style={{ padding: "15px", background: "#fff", border: "1px solid #ddd", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
            🏆 Ranking
          </button>
        </div>
    {/* bloqueio de card até resolver situação do parametro de liberação
        <button onClick={() => onNavigate("finance")} style={{ padding: "15px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", color: "#555" }}>
        💰 Tesouraria
        </button>
    */}
      </div>
    </div>
  );
}