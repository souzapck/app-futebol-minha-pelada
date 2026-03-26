import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function BallRankingPage() {
  const [rankingCheia, setRankingCheia] = useState([]);
  const [rankingMurcha, setRankingMurcha] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRanking();
  }, []);

  const carregarRanking = async () => {
    setLoading(true);

    const { data: votesData, error: votesError } = await supabase
      .from("match_votes")
      .select("*");

    if (votesError) {
      console.error("Erro ao carregar votos:", votesError);
      setLoading(false);
      return;
    }

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("is_hidden", false);

    setLoading(false);

    if (playersError) {
      console.error("Erro ao carregar jogadores:", playersError);
      return;
    }

    const cheiaMap = {};
    const murchaMap = {};

    (votesData || []).forEach((vote) => {
      cheiaMap[vote.bola_cheia_player_id] = (cheiaMap[vote.bola_cheia_player_id] || 0) + 1;
      murchaMap[vote.bola_murcha_player_id] = (murchaMap[vote.bola_murcha_player_id] || 0) + 1;
    });

    const cheiaRanking = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        votos: cheiaMap[player.id] || 0
      }))
      .filter((player) => player.votos > 0)
      .sort((a, b) => {
        if (b.votos !== a.votos) return b.votos - a.votos;
        return a.name.localeCompare(b.name);
      });

    const murchaRanking = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        votos: murchaMap[player.id] || 0
      }))
      .filter((player) => player.votos > 0)
      .sort((a, b) => {
        if (b.votos !== a.votos) return b.votos - a.votos;
        return a.name.localeCompare(b.name);
      });

    setRankingCheia(cheiaRanking);
    setRankingMurcha(murchaRanking);
  };

  const getMedalha = (index) => {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  };

  const renderTabela = (titulo, subtitulo, lista, cor) => (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #eee",
        marginBottom: "25px"
      }}
    >
      <div
        style={{
          background: cor,
          padding: "18px",
          color: "white",
          textAlign: "center"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "24px" }}>{titulo}</h2>
        <p style={{ margin: "6px 0 0 0", opacity: 0.9 }}>{subtitulo}</p>
      </div>

      {lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#666" }}>
          Nenhum voto registrado ainda.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #ddd", color: "#444" }}>
              <th style={{ padding: "15px 10px", width: "50px", textAlign: "center" }}>Pos</th>
              <th style={{ padding: "15px 10px" }}>Jogador</th>
              <th style={{ padding: "15px 10px", textAlign: "center" }}>Votos</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((jogador, index) => (
              <tr
                key={jogador.id}
                style={{
                  borderBottom: "1px solid #eee",
                  backgroundColor: index === 0 ? "#fffbcc" : "transparent"
                }}
              >
                <td
                  style={{
                    padding: "15px 10px",
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: index < 3 ? "22px" : "16px",
                    color: "#555"
                  }}
                >
                  {getMedalha(index)}
                </td>
                <td
                  style={{
                    padding: "15px 10px",
                    fontWeight: index === 0 ? "bold" : "normal",
                    color: "#333"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>
                      <span style={{ color: "#007bff", marginRight: "5px" }}>
                        {jogador.shirt_number
                          ? String(jogador.shirt_number).padStart(2, "0")
                          : "--"}
                      </span>
                      {jogador.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "#888" }}>{jogador.position}</span>
                  </div>
                </td>
                <td
                  style={{
                    padding: "15px 10px",
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "18px",
                    color: "#333"
                  }}
                >
                  {jogador.votos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "40px" }}>
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#666",
            background: "#f8f9fa",
            borderRadius: "12px"
          }}
        >
          Carregando ranking...
        </div>
      ) : (
        <>
          {renderTabela(
            "⚽ Bola Cheia",
            "Os jogadores mais votados como destaque positivo",
            rankingCheia,
            "linear-gradient(135deg, #198754 0%, #28a745 100%)"
          )}

          {renderTabela(
            "🎈 Bola Murcha",
            "Os jogadores mais votados como destaque negativo",
            rankingMurcha,
            "linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
          )}
        </>
      )}
    </div>
  );
}