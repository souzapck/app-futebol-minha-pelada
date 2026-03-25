import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function TeamsPage({ user }) {

  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goals, setGoals] = useState({});

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Erro ao carregar partidas:", error);
      return;
    }

    setMatches(data || []);
  };

  const loadMatchData = async (match) => {
    setSelectedMatch(match);

    const { data: matchPlayersData, error: mpError } = await supabase
      .from("match_player")
      .select("*")
      .eq("match_id", match.id);

    if (mpError) {
      console.error("Erro ao carregar match_player:", mpError);
      return;
    }

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*");

    if (playersError) {
      console.error("Erro ao carregar players:", playersError);
      return;
    }

    const confirmados = (matchPlayersData || [])
      .filter(item => String(item.status || "").trim().toLowerCase() === "confirmado")
      .map(item => {
        const player = (playersData || []).find(
          p => Number(p.id) === Number(item.player_id)
        );

        if (!player) return null;

        return {
          id: player.id,
          name: player.name,
          position: player.position,
          rating: player.rating,
          shirt_number: player.shirt_number,
          phone: player.phone,
          status: item.status,
          team: item.team,
          goals: item.goals || 0
        };
      })
      .filter(Boolean);

    setPlayers(confirmados);

    if (match.is_drawn) {
      setTeamA(confirmados.filter(p => p.team === "A"));
      setTeamB(confirmados.filter(p => p.team === "B"));
      setScoreA(match.score_a || 0);
      setScoreB(match.score_b || 0);

      const goalsMap = {};
      confirmados.forEach(p => {
        goalsMap[p.id] = p.goals || 0;
      });
      setGoals(goalsMap);
    } else {
      setTeamA([]);
      setTeamB([]);
      setScoreA(0);
      setScoreB(0);
      setGoals({});
    }
  };


  const sortearTimes = () => {
    if (players.length === 0) return alert("Não há jogadores confirmados!");
    
    const jogadoresPorPosicao = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };

    // EMBARALHAR OS JOGADORES PRIMEIRO (Para garantir resultados diferentes)
    // Usamos um truque simples do JavaScript (Math.random() - 0.5) para misturar a lista original
    const playersEmbaralhados = [...players].sort(() => Math.random() - 0.5);

    playersEmbaralhados.forEach(p => {
      const pos = jogadoresPorPosicao[p.position] ? p.position : "MEI";
      jogadoresPorPosicao[pos].push(p);
    });

    // Agora ordena do melhor para o pior, mas como eles foram embaralhados antes,
    // jogadores com a MESMA NOTA vão cair em ordens diferentes a cada clique!
    Object.keys(jogadoresPorPosicao).forEach(pos => {
      jogadoresPorPosicao[pos].sort((a, b) => b.rating - a.rating);
    });

    const tA = []; 
    const tB = [];
    let forçaA = 0; 
    let forçaB = 0;
    
    // Sortear de forma aleatória qual time começa escolhendo o primeiro jogador
    // Isso também ajuda a mudar os times a cada clique!
    const timeA_Comeca = Math.random() > 0.5;

    const ordemSorteio = ["GOL", "ZAG", "LAT", "MEI", "ATA"];

    ordemSorteio.forEach(posicao => {
      const jogadores = jogadoresPorPosicao[posicao] || [];
      
      jogadores.forEach((p, index) => {
        // REGRA 1: Sempre mandar para o time que tem MENOS jogadores
        if (tA.length < tB.length) {
          tA.push(p);
          forçaA += p.rating;
        } 
        else if (tB.length < tA.length) {
          tB.push(p);
          forçaB += p.rating;
        } 
        // REGRA 2: Se têm a mesma quantidade, decide por quem está mais fraco, ou por sorteio se estiverem iguais
        else {
          if (forçaA < forçaB) {
            tA.push(p); forçaA += p.rating;
          } else if (forçaB < forçaA) {
            tB.push(p); forçaB += p.rating;
          } else {
            // Se as forças estiverem iguais, usa o sorteio inicial para decidir quem leva
            if (timeA_Comeca) {
              tA.push(p); forçaA += p.rating;
            } else {
              tB.push(p); forçaB += p.rating;
            }
          }
        }
      });
    });

    setTeamA(tA); 
    setTeamB(tB);
  };


  const confirmarSorteio = async () => {
    if (teamA.length === 0 || teamB.length === 0) return;

    const confirm = window.confirm(
      "🔒 Deseja travar o jogo? \nNinguém mais poderá alterar presença após isso.\n"
    );
    if (!confirm) return;

    try {
      // salva os times no match_player
      const updatesA = teamA.map((p) =>
        supabase
          .from("match_player")
          .update({ team: "A" })
          .eq("match_id", selectedMatch.id)
          .eq("player_id", p.id)
      );

      const updatesB = teamB.map((p) =>
        supabase
          .from("match_player")
          .update({ team: "B" })
          .eq("match_id", selectedMatch.id)
          .eq("player_id", p.id)
      );

      const results = await Promise.all([...updatesA, ...updatesB]);

      const teamError = results.find((r) => r.error);
      if (teamError) {
        console.error(teamError.error);
        alert("❌ Erro ao salvar os times.");
        return;
      }

      // trava a partida
      const { error: matchError } = await supabase
        .from("matches")
        .update({ is_drawn: true })
        .eq("id", selectedMatch.id);

      if (matchError) {
        console.error(matchError);
        alert("❌ Erro ao travar o jogo.");
        return;
      }

      alert("✅ Sorteio confirmado e jogo travado!");
      await loadMatches();
      await loadMatchData({ ...selectedMatch, is_drawn: true });
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao confirmar o sorteio.");
    }
  };


  const desfazerSorteio = async () => {
    const confirm = window.confirm(
      "⚠️ Deseja REABRIR esta partida? Isso apagará os placares e times gravados."
    );
    if (!confirm) return;

    try {
      // limpa times e gols dos jogadores
      const { error: mpError } = await supabase
        .from("match_player")
        .update({ team: null, goals: 0 })
        .eq("match_id", selectedMatch.id);

      if (mpError) {
        console.error(mpError);
        alert("❌ Erro ao limpar os dados da partida.");
        return;
      }

      // reabre a partida e zera placar
      const { error: matchError } = await supabase
        .from("matches")
        .update({
          is_drawn: false,
          score_a: 0,
          score_b: 0
        })
        .eq("id", selectedMatch.id);

      if (matchError) {
        console.error(matchError);
        alert("❌ Erro ao reabrir o jogo.");
        return;
      }

      alert("✅ Jogo reaberto!");
      await loadMatches();
      await loadMatchData({
        ...selectedMatch,
        is_drawn: false,
        score_a: 0,
        score_b: 0
      });
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao desfazer o sorteio.");
    }
  };


  const handleGoalChange = (playerId, amount) => {
    setGoals(prev => ({ ...prev, [playerId]: Math.max(0, parseInt(amount) || 0) }));
  };

  const salvarEstatisticas = async () => {
    try {
      // salva placar da partida
      const { error: matchError } = await supabase
        .from("matches")
        .update({
          score_a: Number(scoreA),
          score_b: Number(scoreB)
        })
        .eq("id", selectedMatch.id);

      if (matchError) {
        console.error(matchError);
        alert("❌ Erro ao salvar o placar.");
        return;
      }

      // salva gols por jogador
      const goalUpdates = Object.entries(goals).map(([playerId, goalCount]) =>
        supabase
          .from("match_player")
          .update({ goals: Number(goalCount) || 0 })
          .eq("match_id", selectedMatch.id)
          .eq("player_id", Number(playerId))
      );

      const results = await Promise.all(goalUpdates);
      const goalError = results.find((r) => r.error);

      if (goalError) {
        console.error(goalError.error);
        alert("❌ Erro ao salvar os gols.");
        return;
      }

      alert("✅ Estatísticas do jogo salvas com sucesso!");
      await loadMatchData({
        ...selectedMatch,
        score_a: Number(scoreA),
        score_b: Number(scoreB)
      });
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao salvar estatísticas.");
    }
  };

  const calcForca = (time) => time.reduce((soma, p) => soma + p.rating, 0).toFixed(1);

  const formatarJogador = (p) => {
    const num = (p.shirt_number !== null && p.shirt_number !== undefined && p.shirt_number !== "") 
                  ? String(p.shirt_number).padStart(2, '0') : "--";
    return `${num} - ${p.name} - (${p.position})`;
  };

  // NOVA FUNÇÃO DE ORDENAÇÃO: Da Defesa para o Ataque
  const ordenarPorPosicao = (time) => {
    const pesos = { "GOL": 1, "ZAG": 2, "LAT": 3, "MEI": 4, "ATA": 5 };
    // Cria uma cópia da lista e ordena usando o peso. 
    // Se a posição não existir no objeto (ex: erro de digitação), ganha peso 99 (vai pro final)
    return [...time].sort((a, b) => (pesos[a.position] || 99) - (pesos[b.position] || 99));
  };


  const copiarWhatsApp = () => {
    let texto = `⚽ *JOGO DA QUINTA* (${selectedMatch.date.split("-").reverse().join("/")})\n\n`;
    
    // Usa o ordenarPorPosicao antes de gerar a lista
    const timeA_ordenado = ordenarPorPosicao(teamA);
    const timeB_ordenado = ordenarPorPosicao(teamB);
    
    texto += `🟡⚫ *TIME Amarelo/Preto* (⭐ ${calcForca(teamA)})\n${timeA_ordenado.map(p => `• ${formatarJogador(p)}`).join("\n")}\n\n`;
    texto += `🔵🔴 *TIME Azul/Vermelho* (⭐ ${calcForca(teamB)})\n${timeB_ordenado.map(p => `• ${formatarJogador(p)}`).join("\n")}\n\n`;
    
    navigator.clipboard.writeText(texto);
    alert("Copiado para área de transferência, pode colar no WhatsApp!");
  };


  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* Botões Superiores de Datas (Carrossel) */}
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px", paddingBottom: "10px" }}>
            {matches.map(m => (
            <button
                key={m.id}
                onClick={() => loadMatchData(m)}
                style={{
                minWidth: "120px", padding: "10px", borderRadius: "8px", cursor: "pointer",
                border: selectedMatch?.id === m.id ? "2px solid #007bff" : "1px solid #ddd",
                background: selectedMatch?.id === m.id ? "#e7f1ff" : "#fff",
                color: "#333", /* Força a cor do texto para não ficar branco no fundo branco */
                fontWeight: selectedMatch?.id === m.id ? "bold" : "normal",
                }}
            >
                {m.date.split("-").reverse().join("/")} {m.is_drawn && "🔒"}
            </button>
            ))}
        </div>

      {selectedMatch && (
        <div style={{ width: "100%", maxWidth: "320px", background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #ddd" }}>
          
          {/* Cabeçalho da Área do Jogo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, color: "#333" }}>
              {selectedMatch.is_drawn ? "🔒 Jogo Fechado" : "🎲 Escalação não realizada"}
            </h2>
            {(teamA.length > 0) && (
              <button 
                onClick={copiarWhatsApp} 
                style={{ 
                  background: "#25D366", color: "white", padding: "10px 16px", 
                  borderRadius: "8px", border: "none", cursor: "pointer", 
                  fontWeight: "bold", boxShadow: "0 2px 5px rgba(37,211,102,0.3)" 
                }}
              >
                📱 WhatsApp
              </button>
            )}
          </div>

          {/* ÁREA DOS TIMES */}
          {(teamA.length > 0 || teamB.length > 0) && (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center", marginBottom: "25px" }}>
              
              {/* TIME A */}
              <div style={{ width: "100%", background: "#fff", padding: "15px", borderRadius: "10px", border: "3px solid #e6a800", boxShadow: "0 4px 6px rgba(0,123,255,0.1)" }}>
                <h3 style={{ textAlign: "center", color: "#000102", marginTop: 0, marginBottom: "15px", fontWeight: "bold", fontSize: "18px" }}>
                  🟡⚫ Time Amarelo <span style={{ fontSize: "13px", color: "#666", fontWeight: "normal" }}>(⭐ {calcForca(teamA)})</span>
                </h3>
                
                {selectedMatch.is_drawn && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "12px", background: "#e9ecef", padding: "6px", borderRadius: "8px" }}>
                    <label style={{ fontWeight: "bold", marginRight: "10px", color: "#333", fontSize: "14px" }}>Placar:</label>
                    <input type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} style={{ width: "50px", textAlign: "center", fontSize: "18px", fontWeight: "bold", padding: "4px", borderRadius: "6px", border: "1px solid #ccc", color: "#000", backgroundColor: "#fff" }} />
                  </div>
                )}
                
                {ordenarPorPosicao(teamA).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f1f1", alignItems: "center", fontSize: "15px", color: "#333" }}>
                    <span style={{ fontWeight: "500" }}>{formatarJogador(p)}</span>
                    {selectedMatch.is_drawn && (
                      <input type="number" min="0" value={goals[p.id] || 0} onChange={(e) => handleGoalChange(p.id, e.target.value)} style={{ width: "40px", padding: "3px", textAlign: "center", borderRadius: "4px", border: "1px solid #999", backgroundColor: "#f8f9fa", color: "#000", fontWeight: "bold", fontSize: "13px", outline: "none" }} title="Gols" />
                    )}
                  </div>
                ))}
              </div>

              {/* TIME B */}
              <div style={{ width: "100%", background: "#fff", padding: "15px", borderRadius: "10px", border: "3px solid #2d3db4", boxShadow: "0 4px 6px rgba(220,53,69,0.1)" }}>
                <h3 style={{ textAlign: "center", color: "#000102", marginTop: 0, marginBottom: "15px", fontWeight: "bold", fontSize: "18px" }}>
                  🔵🔴 Time Azul <span style={{ fontSize: "13px", color: "#666", fontWeight: "normal" }}>(⭐ {calcForca(teamB)})</span>
                </h3>
                
                {selectedMatch.is_drawn && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "12px", background: "#e9ecef", padding: "6px", borderRadius: "8px" }}>
                    <label style={{ fontWeight: "bold", marginRight: "10px", color: "#333", fontSize: "14px" }}>Placar:</label>
                    <input type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} style={{ width: "50px", textAlign: "center", fontSize: "18px", fontWeight: "bold", padding: "4px", borderRadius: "6px", border: "1px solid #ccc", color: "#000", backgroundColor: "#fff" }} />
                  </div>
                )}
                
                {ordenarPorPosicao(teamB).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f1f1", alignItems: "center", fontSize: "15px", color: "#333" }}>
                    <span style={{ fontWeight: "500" }}>{formatarJogador(p)}</span>
                    {selectedMatch.is_drawn && (
                      <input type="number" min="0" value={goals[p.id] || 0} onChange={(e) => handleGoalChange(p.id, e.target.value)} style={{ width: "40px", padding: "3px", textAlign: "center", borderRadius: "4px", border: "1px solid #999", backgroundColor: "#f8f9fa", color: "#000", fontWeight: "bold", fontSize: "13px", outline: "none" }} title="Gols" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* PAINEL DE BOTÕES DE AÇÃO (Visível APENAS para o Administrador) */}
        {user?.is_admin && (
          <>
            {!selectedMatch.is_drawn ? (
                
                <div style={{ display: "flex", gap: "12px", flexDirection: "column", background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6" }}>
                
                {/* O botão de Sortear some assim que o sorteio é feito pela primeira vez */}
                {teamA.length === 0 && (
                    <button 
                    onClick={sortearTimes} 
                    style={{ width: "100%", padding: "16px", background: "#007bff", color: "white", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "18px", fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,123,255,0.2)" }}
                    >
                    🎲 Sortear Times Equilibrados
                    </button>
                    
                )}
                
                {/* Se os times já foram sorteados, mostra o botão de Confirmar */}
                {teamA.length > 0 && (
                    <>
                    <button 
                        onClick={confirmarSorteio} 
                        style={{ width: "100%", padding: "16px", background: "#28a745", color: "white", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "18px", fontWeight: "bold", boxShadow: "0 4px 6px rgba(40,167,69,0.2)" }}
                    >
                        🔒 Confirmar Sorteio e Travar Jogo
                    </button>
                    
                    <button 
                        onClick={sortearTimes} 
                        style={{ width: "100%", padding: "10px", background: "#f8f9fa", color: "#6c757d", borderRadius: "8px", border: "1px solid #ced4da", cursor: "pointer", fontSize: "14px", marginTop: "5px" }}
                    >
                        🔄 Não gostei, refazer sorteio
                    </button>
                    </>
                )}
                </div>
            ) : (
                <div style={{ display: "flex", gap: "12px", flexDirection: "column", background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6" }}>
                <button 
                    onClick={salvarEstatisticas} 
                    style={{ width: "100%", padding: "16px", background: "#ffc107", color: "#333", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "18px", fontWeight: "bold", boxShadow: "0 4px 6px rgba(255,193,7,0.2)" }}
                >
                    💾 Salvar Placar e Gols
                </button>
                
                {/* O botão "Reabrir" SÓ APARECE se nenhum time fez gol E nenhum jogador tiver gol anotado */}
                {(Number(scoreA) === 0 && Number(scoreB) === 0 && Object.values(goals).every(g => Number(g) === 0)) && (
                    <button 
                    onClick={desfazerSorteio} 
                    style={{ width: "100%", padding: "14px", background: "#fff", color: "#dc3545", borderRadius: "8px", border: "2px solid #dc3545", cursor: "pointer", fontSize: "16px", fontWeight: "bold", marginTop: "10px" }}
                    >
                    ⚠️ Reabrir Jogo (Desfazer Sorteio)
                    </button>
                )}
                </div>
            )}
          </>
        )}      
        </div>
      )}
    </div>
  );
}

