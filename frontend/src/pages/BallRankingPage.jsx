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

    if (playersError) {
      console.error("Erro ao carregar jogadores:", playersError);
      setLoading(false);
      return;
    }

    // Agrupa votos por partida
    const votesByMatch = {};
    (votesData || []).forEach((vote) => {
      if (!votesByMatch[vote.match_id]) {
        votesByMatch[vote.match_id] = [];
      }
      votesByMatch[vote.match_id].push(vote);
    });

    // Contagem de vencedores por jogo
    const cheiaWinsMap = {};
    const murchaWinsMap = {};

    Object.values(votesByMatch).forEach((matchVotes) => {
      const cheiaCount = {};
      const murchaCount = {};

      matchVotes.forEach((vote) => {
        cheiaCount[vote.bola_cheia_player_id] =
          (cheiaCount[vote.bola_cheia_player_id] || 0) + 1;

        murchaCount[vote.bola_murcha_player_id] =
          (murchaCount[vote.bola_murcha_player_id] || 0) + 1;
      });

      const maxCheia = Math.max(...Object.values(cheiaCount), 0);
      const maxMurcha = Math.max(...Object.values(murchaCount), 0);

      // Se houver empate, todos os empatados contam como vencedores daquela rodada
      Object.entries(cheiaCount).forEach(([playerId, total]) => {
        if (total === maxCheia && maxCheia > 0) {
          cheiaWinsMap[playerId] = (cheiaWinsMap[playerId] || 0) + 1;
        }
      });

      Object.entries(murchaCount).forEach(([playerId, total]) => {
        if (total === maxMurcha && maxMurcha > 0) {
          murchaWinsMap[playerId] = (murchaWinsMap[playerId] || 0) + 1;
        }
      });
    });

    const rankingFinalCheia = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        total: cheiaWinsMap[player.id] || 0
      }))
      .filter((player) => player.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      });

    const rankingFinalMurcha = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        total: murchaWinsMap[player.id] || 0
      }))
      .filter((player) => player.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      });

    setRankingCheia(rankingFinalCheia);
    setRankingMurcha(rankingFinalMurcha);
    setLoading(false);
  };

  const getMedalha = (index) => {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  };

  const renderTabela = (titulo, colunaFinal, ranking, corNumero) => (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #eee",
        flex: 1,
        minWidth: "320px"
      }}
    >
      <div
        style={{
          background: "#f8f9fa",
          borderBottom: "2px solid #ddd",
          padding: "14px 16px",
          fontWeight: "bold",
          color: "#333",
          textAlign: "center"
        }}
      >
        {titulo}
      </div>

      {ranking.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "30px",
            color: "#666"
          }}
        >
          Nenhum resultado ainda.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", borderBottom: "2px solid #ddd", color: "#444" }}>
              <th style={{ padding: "15px 10px", width: "12%", textAlign: "center" }}>Pos</th>
              <th style={{ padding: "15px 10px", width: "55%"}}>Jogador  </th>
              <th style={{ padding: "15px 10px", width: "33%", textAlign: "center", color: corNumero }}>
                {colunaFinal}
              </th>
            </tr>
          </thead>

          <tbody>
            {ranking.map((jogador, index) => (
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
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      {jogador.position}
                    </span>
                  </div>
                </td>

                <td
                  style={{
                    padding: "15px 10px",
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "18px",
                    color: corNumero
                  }}
                >
                  {jogador.total}
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
      <div
        style={{
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
          padding: "20px",
          borderRadius: "12px",
          color: "white",
          textAlign: "center",
          fontSize: "12px",
          marginBottom: "25px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>🗳️ Ranking Geral</h2>
        <p style={{ margin: "5px 0 0 0", opacity: 0.85 }}>
          Quantidade de vezes que cada jogador venceu uma votação
        </p>
      </div>

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
      ) : rankingCheia.length === 0 && rankingMurcha.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#666",
            background: "#f8f9fa",
            borderRadius: "12px"
          }}
        >
          Nenhum resultado de votação ainda.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            alignItems: "flex-start"
          }}
        >
          {renderTabela("⚽ Bola Cheia", "Bola Cheia", rankingCheia, "#198754")}
          {renderTabela("🎈 Bola Murcha", "Bola Murcha", rankingMurcha, "#dc3545")}
        </div>
      )}
    </div>
  );
}