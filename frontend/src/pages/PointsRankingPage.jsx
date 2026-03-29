import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function PointsRankingPage() {
  const [mode, setMode] = useState("general"); // general | round
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (matches.length > 0) {
      loadRanking();
    }
  }, [mode, selectedMatchId, matches]);

  const loadBaseData = async () => {
    setLoading(true);

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("is_drawn", true)
      .order("date", { ascending: false });

    if (matchesError) {
      console.error("Erro ao carregar partidas:", matchesError);
      setLoading(false);
      return;
    }

    setMatches(matchesData || []);

    if ((matchesData || []).length > 0) {
      setSelectedMatchId(String(matchesData[0].id));
    }

    setLoading(false);
  };

  const loadRanking = async () => {
    setLoading(true);

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("id, name, position, shirt_number")
      .eq("is_hidden", false);

    if (playersError) {
      console.error("Erro ao carregar jogadores:", playersError);
      setLoading(false);
      return;
    }

    let matchesToUse = matches;

    if (mode === "round") {
      matchesToUse = matches.filter((m) => String(m.id) === String(selectedMatchId));
    }

    if (matchesToUse.length === 0) {
      setRanking([]);
      setLoading(false);
      return;
    }

    const matchIds = matchesToUse.map((m) => m.id);

    const { data: matchPlayersData, error: mpError } = await supabase
      .from("match_player")
      .select("*")
      .in("match_id", matchIds);

    if (mpError) {
      console.error("Erro ao carregar match_player:", mpError);
      setLoading(false);
      return;
    }

    const { data: votesData, error: votesError } = await supabase
      .from("match_votes")
      .select("*")
      .in("match_id", matchIds);

    if (votesError) {
      console.error("Erro ao carregar votos:", votesError);
      setLoading(false);
      return;
    }

    const playerMap = {};
    (playersData || []).forEach((p) => {
      playerMap[p.id] = p;
    });

    const rankingMap = {};

    const ensurePlayer = (playerId) => {
      if (!rankingMap[playerId]) {
        const player = playerMap[playerId];
        if (!player) return null;

        rankingMap[playerId] = {
          id: player.id,
          name: player.name,
          position: player.position,
          shirt_number: player.shirt_number,
          V: 0,
          E: 0,
          D: 0,
          GP: 0,
          GC: 0,
          BC: 0,
          BM: 0,
          PT: 0
        };
      }
      return rankingMap[playerId];
    };

    const matchPlayersByMatch = {};
    (matchPlayersData || []).forEach((item) => {
      if (!matchPlayersByMatch[item.match_id]) {
        matchPlayersByMatch[item.match_id] = [];
      }
      matchPlayersByMatch[item.match_id].push(item);
    });

    const votesByMatch = {};
    (votesData || []).forEach((vote) => {
      if (!votesByMatch[vote.match_id]) {
        votesByMatch[vote.match_id] = [];
      }
      votesByMatch[vote.match_id].push(vote);
    });

    matchesToUse.forEach((match) => {
      const playersInMatch = (matchPlayersByMatch[match.id] || []).filter(
        (item) => item.team === "A" || item.team === "B"
      );

      playersInMatch.forEach((item) => {
        const row = ensurePlayer(item.player_id);
        if (!row) return;

        const team = item.team;
        const scoreA = Number(match.score_a) || 0;
        const scoreB = Number(match.score_b) || 0;

        if (scoreA === scoreB) {
          row.E += 1;
          row.PT += 1;
        } else {
          const venceu =
            (team === "A" && scoreA > scoreB) ||
            (team === "B" && scoreB > scoreA);

          if (venceu) {
            row.V += 3; // já em pontos
            row.PT += 3;
          } else {
            row.D += 0; // já em pontos
          }
        }

        const golsPro = Number(item.goals) || 0;
        const golsContra = Number(item.own_goals) || 0;

        row.GP += golsPro; // 1 ponto por gol
        row.GC += golsContra * -1; // já negativo
        row.PT += golsPro;
        row.PT -= golsContra;
      });

      const votes = votesByMatch[match.id] || [];
      const cheiaCount = {};
      const murchaCount = {};

      votes.forEach((vote) => {
        if (vote.bola_cheia_player_id) {
          cheiaCount[vote.bola_cheia_player_id] =
            (cheiaCount[vote.bola_cheia_player_id] || 0) + 1;
        }

        if (vote.bola_murcha_player_id) {
          murchaCount[vote.bola_murcha_player_id] =
            (murchaCount[vote.bola_murcha_player_id] || 0) + 1;
        }
      });

      const maxCheia = Math.max(0, ...Object.values(cheiaCount));
      const maxMurcha = Math.max(0, ...Object.values(murchaCount));

      Object.entries(cheiaCount).forEach(([playerId, total]) => {
        if (total === maxCheia && maxCheia > 0) {
          const row = ensurePlayer(Number(playerId));
          if (!row) return;
          row.BC += 3; // já em pontos
          row.PT += 3;
        }
      });

      Object.entries(murchaCount).forEach(([playerId, total]) => {
        if (total === maxMurcha && maxMurcha > 0) {
          const row = ensurePlayer(Number(playerId));
          if (!row) return;
          row.BM += -1; // já em pontos
          row.PT -= 1;
        }
      });
    });

    let rankingFinal = Object.values(rankingMap);

    if (mode === "round") {
      const allowedIds = new Set(
        (matchPlayersByMatch[Number(selectedMatchId)] || [])
          .filter((item) => item.team === "A" || item.team === "B")
          .map((item) => Number(item.player_id))
      );

      rankingFinal = rankingFinal.filter((p) => allowedIds.has(Number(p.id)));
    }

    rankingFinal.sort((a, b) => {
      if (b.PT !== a.PT) return b.PT - a.PT;
      if (b.V !== a.V) return b.V - a.V;
      if (b.GP !== a.GP) return b.GP - a.GP;
      if (b.GC !== a.GC) return b.GC - a.GC;
      return a.name.localeCompare(b.name);
    });

    setRanking(rankingFinal);
    setLoading(false);
  };

  const getPosLabel = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  };

  const titleText = useMemo(() => {
    if (mode === "general") return "📊 Ranking de Pontuação Geral";

    const selected = matches.find((m) => String(m.id) === String(selectedMatchId));
    if (!selected) return "📊 Ranking de Pontuação por Rodada";

    return `📊 Pontuação da Rodada (${selected.date.split("-").reverse().join("/")})`;
  }, [mode, matches, selectedMatchId]);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}> 
      <div
        style={{
          background: "linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)",
          padding: "20px",
          borderRadius: "12px",
          color: "white",
          textAlign: "center",
          marginBottom: "20px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>{titleText}</h2>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "20px"
        }}
      >
        <button
          onClick={() => setMode("general")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: mode === "general" ? "#007bff" : "#eee",
            color: mode === "general" ? "white" : "#333"
          }}
        >
          Geral
        </button>

        <button
          onClick={() => setMode("round")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: mode === "round" ? "#007bff" : "#eee",
            color: mode === "round" ? "white" : "#333"
          }}
        >
          Por Rodada
        </button>

        {mode === "round" && (
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "14px",
              background: "#fff",
              color: "#333",
              maxWidth: "100%"
            }}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.date.split("-").reverse().join("/")}
              </option>
            ))}
          </select>
        )}
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
          Carregando pontuação...
        </div>
      ) : ranking.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#666",
            background: "#f8f9fa",
            borderRadius: "12px"
          }}
        >
          Nenhum dado encontrado.
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            overflowX: "auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #eee"
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "11px"
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8f9fa",
                  borderBottom: "2px solid #ddd",
                  color: "#444"
                }}
              >
                <th style={{ padding: "10px 6px", textAlign: "center" }}>Pos</th>
                <th style={{ padding: "10px 6px" }}>Jogador</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>PT</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>V</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>E</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>D</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>GP</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>GC</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>BC</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>BM</th>
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
                      padding: "10px 6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      color: "#555",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {getPosLabel(index)}
                  </td>

                  <td style={{  color: "#333", minWidth: "100px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>
                        <span style={{ color: "#007bff", marginRight: "5px" }}>
                          {jogador.shirt_number
                            ? String(jogador.shirt_number).padStart(2, "0")
                            : "--"}
                        </span>
                        {jogador.name}
                      </span>
                      <span style={{ fontSize: "11px", color: "#888" }}>
                        {jogador.position}
                      </span>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "15px",
                      color: jogador.PT >= 0 ? "#1565c0" : "#dc3545"
                    }}
                  >
                    {jogador.PT}
                  </td>

                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#2e7d32", fontWeight: "bold" }}>
                    {jogador.V}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#6c757d", fontWeight: "bold" }}>
                    {jogador.E}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#999", fontWeight: "bold" }}>
                    {jogador.D}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#198754", fontWeight: "bold" }}>
                    {jogador.GP}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#dc3545", fontWeight: "bold" }}>
                    {jogador.GC}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#2e7d32", fontWeight: "bold" }}>
                    {jogador.BC}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "center", color: "#8e24aa", fontWeight: "bold" }}>
                    {jogador.BM}
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