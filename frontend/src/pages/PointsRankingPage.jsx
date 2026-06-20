import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

// Constantes de Tempo
const DURACAO_T1 = 15 * 60 * 1000; 
const INTERVALO = 1 * 60 * 1000;
const DURACAO_T2 = 10 * 60 * 1000;

export default function PointsRankingPage() {
  const [mode, setMode] = useState("general"); // general | round
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  
  const [isOngoing, setIsOngoing] = useState(false);

  const { activeGroup } = useGroup();

  // === VARIÁVEIS DE PONTUAÇÃO DINÂMICAS ===
  const [pontuacaoConfig, setPontuacaoConfig] = useState({
    pt_vitoria_ativo: true, pt_vitoria_peso: 3,
    pt_empate_ativo: true, pt_empate_peso: 1,
    pt_gol_ativo: true, pt_gol_peso: 0.2,
    pt_gol_contra_ativo: true, pt_gol_contra_peso: -0.2,
    pt_assistencia_ativo: true, pt_assistencia_peso: 0.1,
    pt_bola_cheia_ativo: true, pt_bola_cheia_peso: 0.5,
    pt_bola_murcha_ativo: true, pt_bola_murcha_peso: -0.5
  });

  useEffect(() => {
    if (activeGroup) {
      loadBaseData();
    }
  }, [activeGroup]);

  useEffect(() => {
    if (matches.length > 0) {
      loadRanking();
    } else if (!loading) {
      setRanking([]);
    }
  }, [mode, selectedMatchId, matches, pontuacaoConfig]); 

  const loadBaseData = async () => {
    setLoading(true);

    // 1. Carrega as Configurações do Banco
    const { data: configData } = await supabase
      .from("grupos_pelada")
      .select(`
        pt_vitoria_ativo, pt_vitoria_peso,
        pt_empate_ativo, pt_empate_peso,
        pt_gol_ativo, pt_gol_peso,
        pt_gol_contra_ativo, pt_gol_contra_peso,
        pt_assistencia_ativo, pt_assistencia_peso,
        pt_bola_cheia_ativo, pt_bola_cheia_peso,
        pt_bola_murcha_ativo, pt_bola_murcha_peso
      `)
      .eq("id_grupo", activeGroup.id_grupo)
      .single();

    if (configData) {
      setPontuacaoConfig({
        pt_vitoria_ativo: configData.pt_vitoria_ativo ?? true,
        pt_vitoria_peso: Number(configData.pt_vitoria_peso ?? 3),
        pt_empate_ativo: configData.pt_empate_ativo ?? true,
        pt_empate_peso: Number(configData.pt_empate_peso ?? 1),
        pt_gol_ativo: configData.pt_gol_ativo ?? true,
        pt_gol_peso: Number(configData.pt_gol_peso ?? 0.2),
        pt_gol_contra_ativo: configData.pt_gol_contra_ativo ?? true,
        pt_gol_contra_peso: Number(configData.pt_gol_contra_peso ?? -0.2),
        pt_assistencia_ativo: configData.pt_assistencia_ativo ?? true,
        pt_assistencia_peso: Number(configData.pt_assistencia_peso ?? 0.1),
        pt_bola_cheia_ativo: configData.pt_bola_cheia_ativo ?? true,
        pt_bola_cheia_peso: Number(configData.pt_bola_cheia_peso ?? 0.5),
        pt_bola_murcha_ativo: configData.pt_bola_murcha_ativo ?? true,
        pt_bola_murcha_peso: Number(configData.pt_bola_murcha_peso ?? -0.5)
      });
    }

    // 2. Carrega as Partidas Fechadas
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("id_grupo", activeGroup.id_grupo) 
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
    setIsOngoing(false);

    const { data: membrosData, error: playersError } = await supabase
      .from("grupo_membros")
      .select(`
        position, shirt_number,
        players!inner(id, name)
      `)
      .eq("id_grupo", activeGroup.id_grupo)
      .eq("is_hidden", false)
      .neq("player_id", 1)
      .eq("is_spectator", false); 

    if (playersError) {
      console.error("Erro ao carregar jogadores:", playersError);
      setLoading(false);
      return;
    }

    const playersData = (membrosData || []).map((m) => ({
      id: m.players.id,
      name: m.players.name,
      position: m.position,
      shirt_number: m.shirt_number
    }));

    let matchesToUse = matches;

    if (mode === "round") {
      matchesToUse = matches.filter((m) => String(m.id) === String(selectedMatchId));
    }

    if (matchesToUse.length === 0) {
      setRanking([]);
      setLoading(false);
      return;
    }

    const now = new Date();
    const finishedMatches = [];

    const horaJogo = activeGroup?.hora_jogo_grupo ? activeGroup.hora_jogo_grupo.slice(0, 5) + ':00' : "22:30:00";

    matchesToUse.forEach((match) => {
      const matchStart = new Date(`${match.date}T${horaJogo}-03:00`);
      const t1Start = new Date(matchStart.getTime() + 90 * 60 * 1000);
      
      const t1End = new Date(t1Start.getTime() + DURACAO_T1);
      const t2Start = new Date(t1End.getTime() + INTERVALO);
      const t2End = new Date(t2Start.getTime() + DURACAO_T2);

      if (now > t2End) {
        finishedMatches.push(match);
      }
    });

    if (matchesToUse.length > 0 && finishedMatches.length === 0) {
      setRanking([]);
      setIsOngoing(true);
      setLoading(false);
      return;
    }

    const matchIds = finishedMatches.map((m) => m.id);

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
          AS: 0, 
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
        votesByMatch[vote.match_id] = { round1: [], round2: [] };
      }
      if (vote.round === 2) {
        votesByMatch[vote.match_id].round2.push(vote);
      } else {
        votesByMatch[vote.match_id].round1.push(vote);
      }
    });

    // Filtra Pesos Ativos
    const pV = pontuacaoConfig.pt_vitoria_ativo ? pontuacaoConfig.pt_vitoria_peso : 0;
    const pE = pontuacaoConfig.pt_empate_ativo ? pontuacaoConfig.pt_empate_peso : 0;
    const pGP = pontuacaoConfig.pt_gol_ativo ? pontuacaoConfig.pt_gol_peso : 0;
    const pGC = pontuacaoConfig.pt_gol_contra_ativo ? pontuacaoConfig.pt_gol_contra_peso : 0;
    const pAS = pontuacaoConfig.pt_assistencia_ativo ? pontuacaoConfig.pt_assistencia_peso : 0;
    const pBC = pontuacaoConfig.pt_bola_cheia_ativo ? pontuacaoConfig.pt_bola_cheia_peso : 0;
    const pBM = pontuacaoConfig.pt_bola_murcha_ativo ? pontuacaoConfig.pt_bola_murcha_peso : 0;

    finishedMatches.forEach((match) => {
      const playersInMatch = (matchPlayersByMatch[match.id] || []).filter(
        (item) => ["A", "B", "C"].includes(item.team)
      );

      const is3Teams = Boolean(match.team_c_name);
      
      const scores = [
        { t: "A", s: Number(match.score_a) || 0 },
        { t: "B", s: Number(match.score_b) || 0 }
      ];
      if (is3Teams) scores.push({ t: "C", s: Number(match.score_c) || 0 });

      const teamResult = {}; 
      const teamPts = {};    

      if (!is3Teams) {
        if (scores[0].s === scores[1].s) {
          teamResult["A"] = "E"; teamPts["A"] = pE;
          teamResult["B"] = "E"; teamPts["B"] = pE;
        } else if (scores[0].s > scores[1].s) {
          teamResult["A"] = "V"; teamPts["A"] = pV;
          teamResult["B"] = "D"; teamPts["B"] = 0;
        } else {
          teamResult["A"] = "D"; teamPts["A"] = 0;
          teamResult["B"] = "V"; teamPts["B"] = pV;
        }
      } else {
        const sorted = [...scores].sort((a, b) => b.s - a.s);
        const [s1, s2, s3] = sorted;

        if (s1.s === s2.s && s2.s === s3.s) {
          scores.forEach(x => { teamResult[x.t] = "E"; teamPts[x.t] = pE; });
        } else if (s1.s === s2.s) {
          teamResult[s1.t] = "E"; teamPts[s1.t] = pE;
          teamResult[s2.t] = "E"; teamPts[s2.t] = pE;
          teamResult[s3.t] = "D"; teamPts[s3.t] = 0;
        } else if (s2.s === s3.s) {
          teamResult[s1.t] = "V"; teamPts[s1.t] = pV;
          teamResult[s2.t] = "E"; teamPts[s2.t] = pE;
          teamResult[s3.t] = "E"; teamPts[s3.t] = pE;
        } else {
          teamResult[s1.t] = "V"; teamPts[s1.t] = pV;
          teamResult[s2.t] = "E"; teamPts[s2.t] = pE;
          teamResult[s3.t] = "D"; teamPts[s3.t] = 0;
        }
      }

      playersInMatch.forEach((item) => {
        const row = ensurePlayer(item.player_id);
        if (!row) return;

        const team = item.team;
        if (teamResult[team]) {
            row[teamResult[team]] += 1;
            row.PT += teamPts[team];
        }

        const golsPro = Number(item.goals) || 0;
        const golsContra = Number(item.own_goals) || 0;
        const assistencias = Number(item.assists) || 0; 

        row.GP += golsPro;
        row.GC += golsContra;
        row.AS += assistencias;

        row.PT += golsPro * pGP;
        row.PT += golsContra * pGC;
        row.PT += assistencias * pAS;
      });

      // === LÓGICA DE APURAÇÃO DE VOTOS INDEPENDENTE ===
      const matchRounds = votesByMatch[match.id] || { round1: [], round2: [] };
      const votesT1 = matchRounds.round1;
      const votesT2 = matchRounds.round2;

      if (votesT1.length > 0) {
        const cheiaCountT1 = {};
        const murchaCountT1 = {};

        votesT1.forEach((vote) => {
          if (vote.bola_cheia_player_id) cheiaCountT1[vote.bola_cheia_player_id] = (cheiaCountT1[vote.bola_cheia_player_id] || 0) + 1;
          if (vote.bola_murcha_player_id) murchaCountT1[vote.bola_murcha_player_id] = (murchaCountT1[vote.bola_murcha_player_id] || 0) + 1;
        });

        const maxCheiaT1 = Math.max(...Object.values(cheiaCountT1), 0);
        const maxMurchaT1 = Math.max(...Object.values(murchaCountT1), 0);

        const empatadosCheia = Object.keys(cheiaCountT1).filter(id => cheiaCountT1[id] === maxCheiaT1 && maxCheiaT1 > 0);
        const empatadosMurcha = Object.keys(murchaCountT1).filter(id => murchaCountT1[id] === maxMurchaT1 && maxMurchaT1 > 0);

        const cheiaFinalCount = {};
        const murchaFinalCount = {};

        const hasT2CheiaVotes = votesT2.some(v => v.bola_cheia_player_id);
        const hasT2MurchaVotes = votesT2.some(v => v.bola_murcha_player_id);

        if (empatadosCheia.length > 1 && hasT2CheiaVotes) {
          votesT2.forEach(v => {
            if (v.bola_cheia_player_id) cheiaFinalCount[v.bola_cheia_player_id] = (cheiaFinalCount[v.bola_cheia_player_id] || 0) + 1;
          });
        } else {
          Object.assign(cheiaFinalCount, cheiaCountT1);
        }

        if (empatadosMurcha.length > 1 && hasT2MurchaVotes) {
          votesT2.forEach(v => {
            if (v.bola_murcha_player_id) murchaFinalCount[v.bola_murcha_player_id] = (murchaFinalCount[v.bola_murcha_player_id] || 0) + 1;
          });
        } else {
          Object.assign(murchaFinalCount, murchaCountT1);
        }

        const maxCheiaFinal = Math.max(...Object.values(cheiaFinalCount), 0);
        const maxMurchaFinal = Math.max(...Object.values(murchaFinalCount), 0);

        Object.entries(cheiaFinalCount).forEach(([playerId, total]) => {
          if (total === maxCheiaFinal && maxCheiaFinal > 0) {
            const row = ensurePlayer(Number(playerId));
            if (row) {
              row.BC += 1; 
              row.PT += pBC;
            }
          }
        });

        Object.entries(murchaFinalCount).forEach(([playerId, total]) => {
          if (total === maxMurchaFinal && maxMurchaFinal > 0) {
            const row = ensurePlayer(Number(playerId));
            if (row) {
              row.BM += 1; 
              row.PT += pBM;
            }
          }
        });
      }
    });

    let rankingFinal = Object.values(rankingMap);

    if (mode === "round") {
      const allowedIds = new Set(
        (matchPlayersByMatch[Number(selectedMatchId)] || [])
          .filter((item) => ["A", "B", "C"].includes(item.team))
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
    if (mode === "general") return "📊 Ranking Geral";

    const selected = matches.find((m) => String(m.id) === String(selectedMatchId));
    if (!selected) return "📊 Ranking da Rodada";

    return `📊 Rodada (${selected.date.split("-").reverse().join("/")})`;
  }, [mode, matches, selectedMatchId]);

  const calcBreakdown = (jogador) => {
    return {
      V: jogador.V * (pontuacaoConfig.pt_vitoria_ativo ? pontuacaoConfig.pt_vitoria_peso : 0),
      E: jogador.E * (pontuacaoConfig.pt_empate_ativo ? pontuacaoConfig.pt_empate_peso : 0),
      D: jogador.D * 0,
      GP: jogador.GP * (pontuacaoConfig.pt_gol_ativo ? pontuacaoConfig.pt_gol_peso : 0),
      GC: jogador.GC * (pontuacaoConfig.pt_gol_contra_ativo ? pontuacaoConfig.pt_gol_contra_peso : 0),
      AS: jogador.AS * (pontuacaoConfig.pt_assistencia_ativo ? pontuacaoConfig.pt_assistencia_peso : 0),
      BC: jogador.BC * (pontuacaoConfig.pt_bola_cheia_ativo ? pontuacaoConfig.pt_bola_cheia_peso : 0),
      BM: jogador.BM * (pontuacaoConfig.pt_bola_murcha_ativo ? pontuacaoConfig.pt_bola_murcha_peso : 0)
    };
  };

  const renderColumnTooltip = (jogador, column) => {
    const breakdown = calcBreakdown(jogador);

    const config = {
      V: { label: "Vitórias", qty: jogador.V, weight: pontuacaoConfig.pt_vitoria_peso, points: breakdown.V },
      E: { label: "Empates (ou 2º Lugar)", qty: jogador.E, weight: pontuacaoConfig.pt_empate_peso, points: breakdown.E },
      D: { label: "Derrotas", qty: jogador.D, weight: 0, points: breakdown.D },
      GP: { label: "Gols Pró", qty: jogador.GP, weight: pontuacaoConfig.pt_gol_peso, points: breakdown.GP },
      GC: { label: "Gols Contra", qty: jogador.GC, weight: pontuacaoConfig.pt_gol_contra_peso, points: breakdown.GC },
      AS: { label: "Assistências", qty: jogador.AS, weight: pontuacaoConfig.pt_assistencia_peso, points: breakdown.AS },
      BC: { label: "Bola Cheia", qty: jogador.BC, weight: pontuacaoConfig.pt_bola_cheia_peso, points: breakdown.BC },
      BM: { label: "Bola Murcha", qty: jogador.BM, weight: pontuacaoConfig.pt_bola_murcha_peso, points: breakdown.BM },
      PT: { label: "Pontuação Total", qty: null, weight: null, points: jogador.PT }
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
            <div>
               {pontuacaoConfig.pt_vitoria_ativo && `V = ${breakdown.V.toFixed(1)} | `}
               {pontuacaoConfig.pt_empate_ativo && `E = ${breakdown.E.toFixed(1)} | `}
               D = {breakdown.D} | 
               {pontuacaoConfig.pt_gol_ativo && ` GP = ${breakdown.GP.toFixed(1)} | `}
               {pontuacaoConfig.pt_gol_contra_ativo && ` GC = ${breakdown.GC.toFixed(1)} | `}
               {pontuacaoConfig.pt_assistencia_ativo && ` AS = ${breakdown.AS.toFixed(1)} | `}
               {pontuacaoConfig.pt_bola_cheia_ativo && ` BC = ${breakdown.BC.toFixed(1)} | `}
               {pontuacaoConfig.pt_bola_murcha_ativo && ` BM = ${breakdown.BM.toFixed(1)}`}
            </div>
            <hr style={{ borderColor: "rgba(255,255,255,0.2)", margin: "6px 0" }} />
            <div><strong>{jogador.PT.toFixed(2)} ponto(s)</strong></div>
          </>
        )}
      </div>
    );
  };

  const renderHoverCell = (jogador, column, displayValue, textColor = "#333") => {
    const isOpen = hoveredCell?.playerId === jogador.id && hoveredCell?.column === column;

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
      ) : isOngoing ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#856404",
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            borderRadius: "12px"
          }}
        >
          ⏳ A pontuação desta rodada será consolidada após o encerramento da votação.
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
                  <th style={{ padding: "8px 2px", textAlign: "center" }}>Pos</th>
                  <th style={{ padding: "8px 2px" }}>Jogador</th>
                  <th style={{ padding: "8px 2px", textAlign: "center" }}>PT</th>
                  
                  {pontuacaoConfig.pt_vitoria_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>V</th>}
                  {pontuacaoConfig.pt_empate_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>E</th>}
                  
                  {/* Derrota sem toggle (sempre exibe) */}
                  <th style={{ padding: "8px 2px", textAlign: "center" }}>D</th>
                  
                  {pontuacaoConfig.pt_gol_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>GP</th>}
                  {pontuacaoConfig.pt_gol_contra_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>GC</th>}
                  {pontuacaoConfig.pt_assistencia_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>AS</th>}
                  {pontuacaoConfig.pt_bola_cheia_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>BC</th>}
                  {pontuacaoConfig.pt_bola_murcha_ativo && <th style={{ padding: "8px 2px", textAlign: "center" }}>BM</th>}
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
                    <td style={{ padding: "6px 2px", textAlign: "center", fontWeight: "bold", color: "#555", whiteSpace: "nowrap" }}>
                      {getPosLabel(index)}
                    </td>

                    <td style={{ padding: "6px 2px", color: "#333", minWidth: "80px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>
                          <span style={{ color: "#007bff", marginRight: "5px" }}>
                            {jogador.shirt_number ? String(jogador.shirt_number).padStart(2, "0") : "--"}
                          </span>
                          {jogador.name}
                        </span>
                        <span style={{ fontSize: "10px", color: "#888" }}>
                          {jogador.position}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: "6px 2px", textAlign: "center", fontSize: "14px" }}>
                      {renderHoverCell(jogador, "PT", jogador.PT.toFixed(1), jogador.PT >= 0 ? "#1565c0" : "#dc3545")}
                    </td>  

                    {pontuacaoConfig.pt_vitoria_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>                  
                        {renderHoverCell(jogador, "V", jogador.V, "#2e7d32")}                                  
                      </td>
                    )}
                    {pontuacaoConfig.pt_empate_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "E", jogador.E, "#6c757d")}
                      </td>
                    )}

                    <td style={{ padding: "6px 2px", textAlign: "center" }}>
                      {renderHoverCell(jogador, "D", jogador.D, "#999")}
                    </td>

                    {pontuacaoConfig.pt_gol_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "GP", jogador.GP, "#198754")}
                      </td>
                    )}
                    {pontuacaoConfig.pt_gol_contra_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "GC", jogador.GC, "#dc3545")}
                      </td>
                    )}
                    {pontuacaoConfig.pt_assistencia_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "AS", jogador.AS, "#0d6efd")}
                      </td>
                    )}
                    {pontuacaoConfig.pt_bola_cheia_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "BC", jogador.BC, "#2e7d32")}
                      </td>
                    )}
                    {pontuacaoConfig.pt_bola_murcha_ativo && (
                      <td style={{ padding: "6px 2px", textAlign: "center" }}>
                        {renderHoverCell(jogador, "BM", jogador.BM, "#8e24aa")}
                      </td>
                    )}
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
            <div><strong>PT</strong> = Pontos Total.</div>
            {pontuacaoConfig.pt_vitoria_ativo && <div><strong>V</strong> = Vitórias, tem peso {pontuacaoConfig.pt_vitoria_peso} pontos.</div>}
            {pontuacaoConfig.pt_empate_ativo && <div><strong>E</strong> = Empates (ou 2º lugar), tem peso {pontuacaoConfig.pt_empate_peso} ponto.</div>}
            <div><strong>D</strong> = Derrotas, não pontua.</div>
            {pontuacaoConfig.pt_gol_ativo && <div><strong>GP</strong> = Gols Pró, tem peso {String(pontuacaoConfig.pt_gol_peso).replace(".", ",")} ponto por gol.</div>}
            {pontuacaoConfig.pt_gol_contra_ativo && <div><strong>GC</strong> = Gols Contra, tem peso {String(pontuacaoConfig.pt_gol_contra_peso).replace(".", ",")} ponto por gol contra.</div>}
            {pontuacaoConfig.pt_assistencia_ativo && <div><strong>AS</strong> = Assistências, tem peso {String(pontuacaoConfig.pt_assistencia_peso).replace(".", ",")} ponto por assistência.</div>}
            {pontuacaoConfig.pt_bola_cheia_ativo && <div><strong>BC</strong> = Bola Cheia, tem peso {String(pontuacaoConfig.pt_bola_cheia_peso).replace(".", ",")} ponto.</div>}
            {pontuacaoConfig.pt_bola_murcha_ativo && <div><strong>BM</strong> = Bola Murcha, tem peso {String(pontuacaoConfig.pt_bola_murcha_peso).replace(".", ",")} ponto.</div>}
          </div>
        </>
      )}
    </div>
  );
}