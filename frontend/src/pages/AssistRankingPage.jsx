import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

export default function AssistRankingPage() {
  const [ranking, setRanking] = useState([]);
  
  const { activeGroup } = useGroup();

  useEffect(() => {
    if (activeGroup) {
      carregarRanking();
    }
  }, [activeGroup]);

  const carregarRanking = async () => {
    try {
      // 1. Traz os jogadores vinculados à pelada (sem espectadores)
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
        return;
      }

      const playersData = (membrosData || []).map((m) => ({
        id: m.players.id,
        name: m.players.name,
        position: m.position,
        shirt_number: m.shirt_number
      }));

      // 2. Descobre quais são as partidas DESTA pelada para não misturar assistências de outros grupos
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("id")
        .eq("id_grupo", activeGroup.id_grupo);

      if (matchesError) {
        console.error("Erro ao carregar partidas:", matchesError);
        return;
      }

      const matchIds = (matchesData || []).map(m => m.id);

      if (matchIds.length === 0) {
        setRanking([]);
        return;
      }

      // 3. Trazemos as estatísticas APENAS dos jogos desta pelada
      const { data: matchPlayersData, error: matchPlayersError } = await supabase
        .from("match_player")
        .select("*")
        .in("match_id", matchIds);

      if (matchPlayersError) {
        console.error("Erro ao carregar estatísticas:", matchPlayersError);
        return;
      }

      const rankingCalculado = (playersData || [])
        .map((player) => {
          const participacoes = (matchPlayersData || []).filter(
            (mp) => Number(mp.player_id) === Number(player.id) && mp.team
          );

          const jogos = participacoes.length;
          // 👉 Puxa a soma da coluna de assistências
          const assistencias = participacoes.reduce(
            (total, mp) => total + (Number(mp.assists) || 0),
            0
          );
          
          const media = jogos > 0 ? (assistencias / jogos).toFixed(2) : "0.00";

          return {
            id: player.id,
            name: player.name,
            position: player.position,
            shirt_number: player.shirt_number,
            jogos,
            assistencias,
            media
          };
        })
        .filter((jogador) => jogador.jogos > 0) // Mostra apenas quem já jogou
        .sort((a, b) => {
          // 1. Mais assistências fica na frente
          if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;

          // 2. Se empatar em assistências, maior média fica na frente
          if (Number(b.media) !== Number(a.media)) return Number(b.media) - Number(a.media);

          // 3. Desempate final por nome
          return a.name.localeCompare(b.name);
        });

      setRanking(rankingCalculado);
    } catch (error) {
      console.error("Erro ao carregar o ranking de assistências", error);
    }
  };

  const getMedalha = (index) => {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}º`;
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      <div
        style={{
          // Gradiente verde/esmeralda para diferenciar visualmente da página de gols
          background: "linear-gradient(135deg, #0f766e 0%, #047857 100%)",
          padding: "10px",
          borderRadius: "12px",
          color: "white",
          textAlign: "center",
          fontSize: "12px",
          marginBottom: "25px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>👟 Ranking de Garçons</h2>
        <p style={{ margin: "5px 0 0 0", opacity: 0.9 }}>
          Os maiores assistentes do nosso grupo!
        </p>
      </div>

      {ranking.length === 0 ? (
        <div
          style={{
            display: "flex",
            textAlign: "center",
            padding: "40px",
            color: "#666",
            background: "#f8f9fa",
            borderRadius: "12px",
            justifyContent: "center"
          }}
        >
          Nenhum jogo salvo com assistências ainda.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            background: "#fff",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #eee"
          }}
        >
          <table style={{ minWidth: "100px", width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ fontSize: "14px" ,background: "#f8f9fa", borderBottom: "2px solid #ddd", color: "#444" }}>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>Pos</th>
                <th style={{ padding: "10px 6px", }}>Jogador</th>
                <th style={{ padding: "10px 6px", textAlign: "center", color: "#d97706" }}>Assist.</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>Jogos</th>
                <th style={{ padding: "10px 6px", textAlign: "center" }}>Média</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((jogador, index) => (
                <tr
                  key={jogador.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    backgroundColor: index === 0 ? "#fffbcc" : "transparent",
                    transition: "background 0.2s"
                  }}
                >
                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: index < 3 ? "20px" : "14px",
                      color: "#555"
                    }}
                  >
                    {getMedalha(index)}
                  </td>

                  <td
                    style={{
                      padding: "10px 6px",
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
                      padding: "10px 6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "14px",
                      color: "#d97706" // Cor laranja/dourada para as assistências
                    }}
                  >
                    {jogador.assistencias}
                  </td>

                  <td style={{ padding: "10px 6px", fontSize: "12px", textAlign: "center", color: "#666" }}>
                    {jogador.jogos}
                  </td>

                  <td
                    style={{
                      padding: "10px 6px",
                      textAlign: "center",
                      color: "#666",
                      fontSize: "12px"
                    }}
                  >
                    {jogador.media}
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