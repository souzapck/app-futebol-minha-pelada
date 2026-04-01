import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function PointsRankingPage() {
  const [mode, setMode] = useState("general"); // general | round
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPlayerId, setHoveredPlayerId] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);


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
            row.V += 1; // quantidade vitoria
            row.PT += 3; // pontos por vitória
          } else {
            row.D += 1; // tabela mostra em quantidade vitória
          }
        }

        const golsPro = Number(item.goals) || 0;
        const golsContra = Number(item.own_goals) || 0;

        row.GP += golsPro;
        row.GC += golsContra;

        row.PT += golsPro * 0.2;
        row.PT -= golsContra * 0.2;
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
          row.BC += 1; // mostra na tabela qtd de bola cheia
          row.PT += 0.5;  // soma 0,5 a cada bola cheia
        }
      });

      Object.entries(murchaCount).forEach(([playerId, total]) => {
        if (total === maxMurcha && maxMurcha > 0) {
          const row = ensurePlayer(Number(playerId));
          if (!row) return;
          row.BM += 1; // mostra na tabela qtd de bola murcha
          row.PT -= 0.5;  // diminui 0,5 a cada bola murcha
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
      if (a.GC !== b.GC) return a.GC - b.GC;
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

  const calcBreakdown = (jogador) => {
    return {
      V: jogador.V * 3,
      E: jogador.E * 1,
      D: jogador.D * 0,
      GP: jogador.GP * 0.2,
      GC: jogador.GC * -0.2,
      BC: jogador.BC * 0.5,
      BM: jogador.BM * -0.5
    };
  };

  //aqui monta função para popup apenas da coluna PT
  const renderPointsTooltipPT = (jogador) => {
    //const { vPts, ePts, dPts, gpPts, gcPts, bcPts, bmPts } = calcBreakdown(jogador);
    const breakdown = calcBreakdown(jogador);

    return (
      <div
        style={{
          position: "absolute",
          bottom: "125%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1f2937",
          color: "white",
          padding: "6px 8px",
          borderRadius: "8px",
          fontSize: "9px",
          lineHeight: "1.5",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 20,
          minWidth: "180px",
          textAlign: "left"
        }}
      >
        <div> 
          <strong>
             Contagem de pontos por categoria:
           </strong>
        </div>
        <div> 
          <strong>
             V  | E | D | {" "}G.P.{""} | {""}G.C.{""} | {""}B.C.{""} | {""}B.M.{""} 
           </strong>
        </div>
        <hr style={{ borderColor: "rgba(255,255,255,0.2)", margin: "2px 0" }} />
        <div>
          <strong>
            {V} | {E} | {D} | {GP.toFixed(2)} | {GC.toFixed(2)} | {BC.toFixed(2)} | {BM.toFixed(2)}
          </strong>
        </div>
      </div>
    );
  };
  


  //aqui monta função para popup das colunas de pontuação
  const renderColumnTooltip = (jogador, column) => {
    const breakdown = calcBreakdown(jogador);

    const config = {
      V: {
        label: "Vitórias",
        qty: jogador.V,
        weight: 3,
        points: breakdown.V
      },
      E: {
        label: "Empates",
        qty: jogador.E,
        weight: 1,
        points: breakdown.E
      },
      D: {
        label: "Derrotas",
        qty: jogador.D,
        weight: 0,
        points: breakdown.D
      },
      GP: {
        label: "Gols Pró",
        qty: jogador.GP,
        weight: 0.2,
        points: breakdown.GP
      },
      GC: {
        label: "Gols Contra",
        qty: jogador.GC,
        weight: -0.2,
        points: breakdown.GC
      },
      BC: {
        label: "Bola Cheia",
        qty: jogador.BC,
        weight: 0.5,
        points: breakdown.BC
      },
      BM: {
        label: "Bola Murcha",
        qty: jogador.BM,
        weight: -0.5,
        points: breakdown.BM
      },
      PT: {
        label: "Pontuação Total",
        qty: null,
        weight: null,
        points: jogador.PT
      }
    };

    const item = config[column];
    if (!item) return null;

    return (
      <div
        style={{
          position: "absolute",
          bottom: "125%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1f2937",
          color: "white",
          padding: "6px 8px",
          borderRadius: "8px",
          fontSize: "9px",
          lineHeight: "1.5",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 20,
          minWidth: "180px",
          textAlign: "left"
        }}
      >
        <div><strong>{column}</strong> = {item.label}</div>

        {column !== "PT" ? (
          <>
            <div>
              {item.qty} x {String(item.weight).replace(".", ",")} = {item.points.toFixed(1)}
            </div>
            <hr style={{ borderColor: "rgba(255,255,255,0.2)", margin: "6px 0" }} />
            <div><strong>{item.points.toFixed(2)} ponto(s)</strong></div>
          </>
        ) : (
          <>
            <div>V = {breakdown.V} | E = {breakdown.E} | D = {breakdown.D} |
                 GP = {breakdown.GP.toFixed(2)}| GC = {breakdown.GC.toFixed(2)} |
                 BC = {breakdown.BC.toFixed(2)} | BM = {breakdown.BM.toFixed(2)}
            </div>
            <hr style={{ borderColor: "rgba(255,255,255,0.2)", margin: "6px 0" }} />
            <div><strong>{jogador.PT.toFixed(2)} ponto(s)</strong></div>
          </>
        )}
      </div>
    );
  };

    const renderHoverCell = (jogador, column, displayValue, textColor = "#333") => {
      const isOpen =
        hoveredCell?.playerId === jogador.id && hoveredCell?.column === column;

      return (
        <div
          style={{ position: "relative", display: "inline-block" }}
          onMouseEnter={() => setHoveredCell({ playerId: jogador.id, column })}
          onMouseLeave={() => setHoveredCell(null)}
        >
          <span
            style={{
              cursor: "help",
              borderBottom: "1px dotted #999",
              color: textColor,
              fontWeight: "bold"
            }}
          >
            {displayValue}
          </span>

          {isOpen && renderColumnTooltip(jogador, column)}
        </div>
      );
    };

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
        <>
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
                fontSize: "13px"
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

                    <td style={{ padding: "10px 6px", color: "#333", minWidth: "120px" }}>
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

               {/*     <td
                      style={{
                        padding: "10px 6px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: "15px",
                        color: jogador.PT >= 0 ? "#1565c0" : "#dc3545"
                      }}
                    >
                      <div
                        style={{ position: "relative", display: "inline-block" }}
                        onMouseEnter={() => setHoveredPlayerId(jogador.id)}
                        onMouseLeave={() => setHoveredPlayerId(null)}
                      >
                        <span style={{cursor: "help",borderBottom: "1px dotted #999"}}>
                          {jogador.PT.toFixed(2)}
                        </span>

                        {hoveredPlayerId === jogador.id && renderPointsTooltipPT(jogador)}
                      </div>
                    </td>
                  */}

                    <td
                      style={{
                        padding: "10px 6px",
                        textAlign: "center",
                        fontSize: "15px"
                      }}
                    >
                      {renderHoverCell(
                        jogador,
                        "PT",
                        jogador.PT.toFixed(1),
                        jogador.PT >= 0 ? "#1565c0" : "#dc3545"
                      )}
                    </td>  

                    <td style={{ padding: "10px 6px", textAlign: "center" }}>                   
                      {renderHoverCell(jogador, "V", jogador.V, "#2e7d32")}                                  
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "E", jogador.E, "#6c757d")}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "D", jogador.D, "#999")}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "GP", jogador.GP, "#198754")}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "GC", jogador.GC, "#dc3545")}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "BC", jogador.BC, "#2e7d32")}
                    </td>
                    <td style={{ padding: "10px 6px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "BM", jogador.BM, "#8e24aa")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: "14px",
              background: "#f8f9fa",
              border: "1px solid #dee2e6",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "9px",
              textAlign: "left",
              color: "#555",
              lineHeight: "1.7"
            }}
          >
            <div><strong>Mapa de contagem da pontuação:</strong></div>
            <div><strong>PT</strong> = Pontos Total, soma total de pontos do jogador.</div>
            <div><strong>V</strong> = Vitórias, tem peso 3 pontos.</div>
            <div><strong>E</strong> = Empates, tem peso 1 ponto.</div>
            <div><strong>D</strong> = Derrotas, tem peso 0 ponto.</div>
            <div><strong>GP</strong> = Gols Pró, tem peso 0,2 ponto por gol.</div>
            <div><strong>GC</strong> = Gols Contra, tem peso -0,2 ponto por gol contra.</div>
            <div><strong>BC</strong> = Bola Cheia, tem peso 0,5 ponto.</div>
            <div><strong>BM</strong> = Bola Murcha, tem peso -0,5 ponto.</div>
          </div>
        </>
      )}
    </div>
  );
}