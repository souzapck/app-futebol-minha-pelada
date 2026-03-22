import { useEffect, useState } from "react";
import api from "../api.js";

export default function RankingPage() {
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    carregarRanking();
  }, []);

  const carregarRanking = async () => {
    try {
      const res = await api.get("/ranking");
      setRanking(res.data);
    } catch (error) {
      console.error("Erro ao carregar o ranking", error);
    }
  };

  const getMedalha = (index) => {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "40px" }}>
      
      <div style={{ background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)", padding: "20px", borderRadius: "12px", color: "white", textAlign: "center", marginBottom: "25px", boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }}>
        <h2 style={{ margin: 0, fontSize: "28px" }}>⚽ Artilharia Geral</h2>
        <p style={{ margin: "5px 0 0 0", opacity: 0.8 }}>Ranking dos maiores matadores da Quinta-feira!</p>
      </div>

      {ranking.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666", background: "#f8f9fa", borderRadius: "12px" }}>
          Nenhum jogo salvo com gols ainda.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #eee" }}>
          
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #ddd", color: "#444" }}>
                <th style={{ padding: "15px 10px", width: "50px", textAlign: "center" }}>Pos</th>
                <th style={{ padding: "15px 10px" }}>Jogador</th>
                <th style={{ padding: "15px 10px", textAlign: "center" }}>Jogos</th>
                <th style={{ padding: "15px 10px", textAlign: "center" }}>Média</th>
                <th style={{ padding: "15px 10px", textAlign: "center", color: "#28a745" }}>Gols</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((jogador, index) => (
                <tr key={jogador.id} style={{ borderBottom: "1px solid #eee", backgroundColor: index === 0 ? "#fffbcc" : "transparent", transition: "background 0.2s" }}>
                  <td style={{ padding: "15px 10px", textAlign: "center", fontWeight: "bold", fontSize: index < 3 ? "22px" : "16px", color: "#555" }}>
                    {getMedalha(index)}
                  </td>
                  <td style={{ padding: "15px 10px", fontWeight: index === 0 ? "bold" : "normal", color: "#333" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>
                        <span style={{ color: "#007bff", marginRight: "5px" }}>
                          {jogador.shirt_number ? String(jogador.shirt_number).padStart(2, '0') : "--"}
                        </span>
                        {jogador.name}
                      </span>
                      <span style={{ fontSize: "12px", color: "#888" }}>{jogador.position}</span>
                    </div>
                  </td>
                  <td style={{ padding: "15px 10px", textAlign: "center", color: "#666" }}>{jogador.jogos}</td>
                  <td style={{ padding: "15px 10px", textAlign: "center", color: "#666", fontSize: "14px" }}>{jogador.media}</td>
                  <td style={{ padding: "15px 10px", textAlign: "center", fontWeight: "bold", fontSize: "18px", color: "#28a745" }}>
                    {jogador.gols}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
        </div>
      )}
    </div>
  );
}
