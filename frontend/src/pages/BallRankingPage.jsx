import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

const DURACAO_T1 = 15 * 60 * 1000; 
const INTERVALO = 1 * 60 * 1000;
const DURACAO_T2 = 10 * 60 * 1000;

export default function BallRankingPage() {
  const [rankingCheia, setRankingCheia] = useState([]);
  const [rankingMurcha, setRankingMurcha] = useState([]);
  const [loading, setLoading] = useState(true);

  const { activeGroup } = useGroup();

  useEffect(() => {
    if (activeGroup) {
      carregarRanking();
    }
  }, [activeGroup]);

  const carregarRanking = async () => {
    setLoading(true);

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("id_grupo", activeGroup.id_grupo) 
      .order("date", { ascending: false });

    if (matchesError) {
      console.error("Erro ao carregar partidas:", matchesError);
      setLoading(false);
      return;
    }

    const { data: votesData, error: votesError } = await supabase
      .from("match_votes")
      .select("*")
      .eq("id_grupo", activeGroup.id_grupo); 

    if (votesError) {
      console.error("Erro ao carregar votos:", votesError);
      setLoading(false);
      return;
    }

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

    const now = new Date();
    const partidasFinalizadasIds = new Set();
    const horaJogo = activeGroup?.hora_jogo_grupo ? activeGroup.hora_jogo_grupo.slice(0, 5) + ':00' : "22:30:00";

    (matchesData || []).forEach((match) => {
      const matchStart = new Date(`${match.date}T${horaJogo}-03:00`);
      const t1Start = new Date(matchStart.getTime() + 90 * 60 * 1000);
      const t1End = new Date(t1Start.getTime() + DURACAO_T1);
      const t2Start = new Date(t1End.getTime() + INTERVALO);
      const t2End = new Date(t2Start.getTime() + DURACAO_T2);

      if (now > t2End && match.is_drawn) {
        partidasFinalizadasIds.add(match.id);
      }
    });

    const votesByMatch = {};
    (votesData || []).forEach((vote) => {
      if (partidasFinalizadasIds.has(vote.match_id)) {
        if (!votesByMatch[vote.match_id]) {
          votesByMatch[vote.match_id] = { round1: [], round2: [] };
        }
        if (vote.round === 2) {
          votesByMatch[vote.match_id].round2.push(vote);
        } else {
          votesByMatch[vote.match_id].round1.push(vote);
        }
      }
    });

    const cheiaWinsMap = {};
    const murchaWinsMap = {};
    const cheiaLastDateMap = {};
    const murchaLastDateMap = {};

    (matchesData || []).forEach((match) => {
      if (!partidasFinalizadasIds.has(match.id)) return;

      const matchRounds = votesByMatch[match.id];
      if (!matchRounds) return;

      const votesT1 = matchRounds.round1;
      const votesT2 = matchRounds.round2;

      // Se não teve nem 1º turno, pula
      if (votesT1.length === 0) return;

      // 1. Apura o Turno 1 para saber quem empatou
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

      // 2. Apura os votos definitivos (Pega do T2 se houve desempate, senão consolida o T1)
      const cheiaFinalCount = {};
      const murchaFinalCount = {};

      // --- LÓGICA BOLA CHEIA ---
      if (empatadosCheia.length > 1 && votesT2.length > 0) {
        // Usa votos do T2
        votesT2.forEach(v => {
          if (v.bola_cheia_player_id) cheiaFinalCount[v.bola_cheia_player_id] = (cheiaFinalCount[v.bola_cheia_player_id] || 0) + 1;
        });
      } else {
        // Usa votos do T1
        Object.assign(cheiaFinalCount, cheiaCountT1);
      }

      // --- LÓGICA BOLA MURCHA ---
      if (empatadosMurcha.length > 1 && votesT2.length > 0) {
        // Usa votos do T2
        votesT2.forEach(v => {
          if (v.bola_murcha_player_id) murchaFinalCount[v.bola_murcha_player_id] = (murchaFinalCount[v.bola_murcha_player_id] || 0) + 1;
        });
      } else {
        // Usa votos do T1
        Object.assign(murchaFinalCount, murchaCountT1);
      }

      const maxCheiaFinal = Math.max(...Object.values(cheiaFinalCount), 0);
      const maxMurchaFinal = Math.max(...Object.values(murchaFinalCount), 0);

      // Atribui as vitórias finais
      Object.entries(cheiaFinalCount).forEach(([playerId, total]) => {
        if (total === maxCheiaFinal && maxCheiaFinal > 0) {
          cheiaWinsMap[playerId] = (cheiaWinsMap[playerId] || 0) + 1;
          if (!cheiaLastDateMap[playerId]) cheiaLastDateMap[playerId] = match.date;
        }
      });

      Object.entries(murchaFinalCount).forEach(([playerId, total]) => {
        if (total === maxMurchaFinal && maxMurchaFinal > 0) {
          murchaWinsMap[playerId] = (murchaWinsMap[playerId] || 0) + 1;
          if (!murchaLastDateMap[playerId]) murchaLastDateMap[playerId] = match.date;
        }
      });
    });

    const rankingFinalCheia = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        total: cheiaWinsMap[player.id] || 0,
        lastWinDate: cheiaLastDateMap[player.id] || "1970-01-01" 
      }))
      .filter((player) => player.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total; 
        const dateA = new Date(a.lastWinDate).getTime();
        const dateB = new Date(b.lastWinDate).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return a.name.localeCompare(b.name);
      });

    const rankingFinalMurcha = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        total: murchaWinsMap[player.id] || 0,
        lastWinDate: murchaLastDateMap[player.id] || "1970-01-01"
      }))
      .filter((player) => player.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total; 
        const dateA = new Date(a.lastWinDate).getTime();
        const dateB = new Date(b.lastWinDate).getTime();
        if (dateB !== dateA) return dateB - dateA;
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
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
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
          Nenhum resultado de votação consolidado ainda.
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
          {renderTabela("⚽ Bola Cheia", "Vezes Eleito", rankingCheia, "#198754")}
          {renderTabela("🎈 Bola Murcha", "Vezes Eleito", rankingMurcha, "#dc3545")}
        </div>
      )}
    </div>
  );
}