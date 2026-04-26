import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Mesmas Constantes de Tempo da página de votação
const DURACAO_T1 = 15 * 60 * 1000; 
const INTERVALO = 1 * 60 * 1000;
const DURACAO_T2 = 10 * 60 * 1000;

export default function BallRankingPage() {
  const [rankingCheia, setRankingCheia] = useState([]);
  const [rankingMurcha, setRankingMurcha] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRanking();
  }, []);

  const carregarRanking = async () => {
    setLoading(true);

    // 1. Carrega os Jogos (Matches) - AGORA ORDENADOS POR DATA
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .order("date", { ascending: false }); // <--- ESSENCIAL para sabermos qual é a atual

    if (matchesError) {
      console.error("Erro ao carregar partidas:", matchesError);
      setLoading(false);
      return;
    }

    // 2. Carrega todos os votos
    const { data: votesData, error: votesError } = await supabase
      .from("match_votes")
      .select("*");

    if (votesError) {
      console.error("Erro ao carregar votos:", votesError);
      setLoading(false);
      return;
    }

    // 3. Carrega os jogadores
    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("is_hidden", false);

    if (playersError) {
      console.error("Erro ao carregar jogadores:", playersError);
      setLoading(false);
      return;
    }

    const now = new Date();
    const partidasFinalizadasIds = new Set();

    // 4. Identifica quais partidas já terminaram a votação
    (matchesData || []).forEach((match, index) => {

      // === AMBIENTE DE TESTES ===
      // Se for a partida mais recente (index 0), usa a data do seu teste.
      // Se for uma partida antiga (index > 0), usa a data REAL dela para liberar no ranking.
 /*    
      let t1Start;
      if (index === 0) {
        t1Start = new Date("2026-04-26T02:25:00-03:00"); 
      } else {
        t1Start = new Date(`${match.date}T22:30:00-03:00`);
      }
  */

      // === AMBIENTE DE PRODUÇÃO ===
      // Quando for subir oficial, apague o bloco IF/ELSE acima e deixe apenas esta linha:
      const t1Start = new Date(`${match.date}T22:30:00-03:00`);

      const t1End = new Date(t1Start.getTime() + DURACAO_T1);
      const t2Start = new Date(t1End.getTime() + INTERVALO);
      const t2End = new Date(t2Start.getTime() + DURACAO_T2);

      // Só consideramos a partida válida se o tempo final do 2º turno já passou
      if (now > t2End && match.is_drawn) {
        partidasFinalizadasIds.add(match.id);
      }
    });

    // 5. Agrupa votos APENAS das partidas finalizadas E separa por Turno (Round)
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

    // Contadores e Mapas de Data
    const cheiaWinsMap = {};
    const murchaWinsMap = {};
    const cheiaLastDateMap = {};
    const murchaLastDateMap = {};

    // 6. Calcula os vencedores iterando pelas partidas (da mais nova para a mais velha)
    (matchesData || []).forEach((match) => {
      // Ignora a partida se a votação ainda não acabou
      if (!partidasFinalizadasIds.has(match.id)) return;

      const matchRounds = votesByMatch[match.id];
      if (!matchRounds) return;

      // Prioriza o Turno 2 se houver votos nele.
      const activeVotes = matchRounds.round2.length > 0 ? matchRounds.round2 : matchRounds.round1;

      if (activeVotes.length === 0) return;

      const cheiaCount = {};
      const murchaCount = {};

      activeVotes.forEach((vote) => {
        cheiaCount[vote.bola_cheia_player_id] = (cheiaCount[vote.bola_cheia_player_id] || 0) + 1;
        murchaCount[vote.bola_murcha_player_id] = (murchaCount[vote.bola_murcha_player_id] || 0) + 1;
      });

      const maxCheia = Math.max(...Object.values(cheiaCount), 0);
      const maxMurcha = Math.max(...Object.values(murchaCount), 0);

      // --- BOLA CHEIA ---
      Object.entries(cheiaCount).forEach(([playerId, total]) => {
        if (total === maxCheia && maxCheia > 0) {
          cheiaWinsMap[playerId] = (cheiaWinsMap[playerId] || 0) + 1;
          
          // Como as partidas estão ordenadas da mais nova para a mais velha, 
          // a primeira vez que passamos aqui é a vitória mais recente do jogador
          if (!cheiaLastDateMap[playerId]) {
            cheiaLastDateMap[playerId] = match.date;
          }
        }
      });

      // --- BOLA MURCHA ---
      Object.entries(murchaCount).forEach(([playerId, total]) => {
        if (total === maxMurcha && maxMurcha > 0) {
          murchaWinsMap[playerId] = (murchaWinsMap[playerId] || 0) + 1;
          
          // Salva a data da vitória mais recente
          if (!murchaLastDateMap[playerId]) {
            murchaLastDateMap[playerId] = match.date;
          }
        }
      });
    });

    // 7. Monta o ranking final aplicando o critério de desempate
    const rankingFinalCheia = (playersData || [])
      .map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirt_number,
        total: cheiaWinsMap[player.id] || 0,
        lastWinDate: cheiaLastDateMap[player.id] || "1970-01-01" // fallback caso nunca tenha ganho
      }))
      .filter((player) => player.total > 0)
      .sort((a, b) => {
        // Critério 1: Maior número de vitórias
        if (b.total !== a.total) return b.total - a.total; 
        
        // Critério 2: Desempate pela Data (quem ganhou mais recentemente fica na frente)
        const dateA = new Date(a.lastWinDate).getTime();
        const dateB = new Date(b.lastWinDate).getTime();
        if (dateB !== dateA) return dateB - dateA;

        // Critério 3: Ordem alfabética
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
        // Critério 1: Maior número de vitórias
        if (b.total !== a.total) return b.total - a.total; 
        
        // Critério 2: Desempate pela Data
        const dateA = new Date(a.lastWinDate).getTime();
        const dateB = new Date(b.lastWinDate).getTime();
        if (dateB !== dateA) return dateB - dateA;

        // Critério 3: Ordem alfabética
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