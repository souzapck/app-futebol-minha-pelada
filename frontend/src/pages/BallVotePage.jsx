import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Constantes de Tempo
const DURACAO_T1 = 15 * 60 * 1000; 
const INTERVALO = 1 * 60 * 1000;
const DURACAO_T2 = 10 * 60 * 1000;

export default function BallVotePage({ user }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [players, setPlayers] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const [bolaCheiaId, setBolaCheiaId] = useState(null);
  const [bolaMurchaId, setBolaMurchaId] = useState(null);

  const [existingVote, setExistingVote] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [loadingVote, setLoadingVote] = useState(false);

  const [currentRound, setCurrentRound] = useState(1);
  const [runoffCandidates, setRunoffCandidates] = useState({ cheia: [], murcha: [] });
  const [allVotes, setAllVotes] = useState([]);

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoadingMatches(true);
    const { data, error } = await supabase.from("matches").select("*").order("date", { ascending: false });
    setLoadingMatches(false);
    if (!error) setMatches(data || []);
  };

  const loadConfirmedPlayers = async (matchId) => {
    if (!matchId) return setPlayers([]);
    setLoadingPlayers(true);
    const { data, error } = await supabase
      .from("match_player")
      .select(`shirt_number, team, status, post_draw_action, player_id, players:player_id!inner (id, name, position, rating)`)
      .eq("match_id", matchId)
      .eq("status", "confirmado");

    setLoadingPlayers(false);
    if (!error) {
      setPlayers(data.filter(i => !i.post_draw_action || i.post_draw_action === "included").map(i => ({
        id: i.players.id,
        name: i.players.name,
        position: i.players.position,
        team: i.team,
        shirt_number: i.shirt_number ?? i.players.shirt_number
      })));
    }
  };

  // 2. GATILHOS DE VOTOS
  const loadMatchVotes = async (matchId) => {
    const { data, error } = await supabase.from("match_votes").select("*").eq("match_id", matchId);
    if (!error) setAllVotes(data || []);
  };

  useEffect(() => {
    if (selectedMatchId) loadMatchVotes(selectedMatchId);
  }, [selectedMatchId]);

  useEffect(() => {
    if (allVotes.length > 0) {
      const v1 = allVotes.filter(v => v.round === 1);
      const runoff = getRunoffCandidates(v1);
      setRunoffCandidates(runoff);
    }
  }, [allVotes]);

  const loadExistingVote = async (matchId, round) => {
    if (!matchId || !user?.player_id) return;
    const { data } = await supabase
      .from("match_votes")
      .select("*")
      .eq("match_id", matchId)
      .eq("voter_player_id", user.player_id)
      .eq("round", round)
      .maybeSingle();
    
    setExistingVote(data || null);
    if (data) {
      setBolaCheiaId(data.bola_cheia_player_id);
      setBolaMurchaId(data.bola_murcha_player_id);
    }
  };

  // === SOLUÇÃO APLICADA AQUI ===
  // Garante que o voto do usuário seja validado assim que ele entra na tela (resolve o problema do re-login)
  useEffect(() => {
    if (selectedMatchId && user?.player_id) {
      loadExistingVote(selectedMatchId, currentRound);
    }
  }, [selectedMatchId, user?.player_id]); 
  // =============================

  // 3. LÓGICA DO TIMER
  useEffect(() => {
    if (!selectedMatchId || matches.length === 0) return;
    const match = matches.find(m => String(m.id) === String(selectedMatchId));
    if (!match) return;

    const updateTimer = () => {
      // === BLOQUEIO DE PARTIDAS ANTERIORES ===
      // Verifica se a partida selecionada é a mais recente da lista (índice 0)
      const isLatestMatch = matches.length > 0 && match.id === matches[0].id;

      if (!isLatestMatch) {
        setTimeLeft("Votação encerrada (Partida Anterior).");
        setIsVotingOpen(false);
        return; // Interrompe o relógio aqui. Partidas velhas só mostram resultados.
      }

      const now = new Date();
      
      // === PRODUÇÃO (Usa a data do jogo) ===
      const t1Start = new Date(`${match.date}T22:30:00-03:00`); 
      
      // === TESTES (Se precisar testar novamente, comente a linha acima e descomente a debaixo) ===
      // const t1Start = new Date("2026-04-26T02:25:00-03:00"); 

      const t1End = new Date(t1Start.getTime() + DURACAO_T1);
      const t2Start = new Date(t1End.getTime() + INTERVALO);
      const t2End = new Date(t2Start.getTime() + DURACAO_T2);

      if (!match.is_drawn) {
        setTimeLeft("Aguardando fechamento da partida...");
        setIsVotingOpen(false);
      } else if (now < t1Start) {
        setTimeLeft(`Aguarde, início da votação às 22:30!`);
        setIsVotingOpen(false);
      } else if (now <= t1End) {
        if (currentRound !== 1) {
          setCurrentRound(1);
          setExistingVote(null);
          loadExistingVote(match.id, 1);
        }
        setTimeLeft(`1º Turno: ${formatTime(t1End - now)}`);
        setIsVotingOpen(true);
      } else if (now < t2Start) {
        setTimeLeft("Apurando empates... 2º Turno em breve.");
        setIsVotingOpen(false);
      } else if (now <= t2End) {
        // Usa o estado já calculado com segurança
        const hasEmpate = runoffCandidates.cheia.length > 1 || runoffCandidates.murcha.length > 1;
        
        if (hasEmpate) {
          if (currentRound !== 2) {
            setCurrentRound(2);
            setExistingVote(null);
            setBolaCheiaId(null);
            setBolaMurchaId(null);          
            loadExistingVote(match.id, 2);
          }
          setTimeLeft(`2º TURNO (Desempate): ${formatTime(t2End - now)}`);
          setIsVotingOpen(true);
        } else {
          setTimeLeft("Votação encerrada (Sem empates).");
          setIsVotingOpen(false);
        }
      } else {
        setTimeLeft("Votação encerrada.");
        setIsVotingOpen(false);
      }
    };

    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [selectedMatchId, matches, currentRound, runoffCandidates]);

  // 4. PROCESSAMENTO E SALVAMENTO
  const getRunoffCandidates = (votesT1) => {
    const counts = votesT1.reduce((acc, v) => {
      acc.c[v.bola_cheia_player_id] = (acc.c[v.bola_cheia_player_id] || 0) + 1;
      acc.m[v.bola_murcha_player_id] = (acc.m[v.bola_murcha_player_id] || 0) + 1;
      return acc;
    }, { c: {}, m: {} });

    const calc = (obj) => {
      const max = Math.max(...Object.values(obj), 0);
      return max > 0 ? Object.keys(obj).filter(k => obj[k] === max).map(Number) : [];
    };
    return { cheia: calc(counts.c), murcha: calc(counts.m) };
  };

  const handleSaveVote = async () => {
    if (loadingVote) return; // Trava contra cliques duplos
    if (!bolaCheiaId || !bolaMurchaId) return alert("Selecione os dois!");
    if (bolaCheiaId === bolaMurchaId) return alert("Não pode ser a mesma pessoa!");
    
    const roundParaGravar = currentRound; 
    setLoadingVote(true);

    const { data, error } = await supabase
      .from("match_votes")
      .insert([{
        match_id: selectedMatchId,
        voter_player_id: user.player_id,
        bola_cheia_player_id: bolaCheiaId,
        bola_murcha_player_id: bolaMurchaId,
        round: roundParaGravar
      }])
      .select()
      .single();

    setLoadingVote(false);

    if (error) {
        if (error.code === '23505') { 
          alert("Você já registrou seu voto para este turno!");
          await loadExistingVote(selectedMatchId, currentRound);
        } else {
          alert(`Erro ao gravar: ${error.message}`);
        }
    } else {
        alert("Voto confirmado com sucesso!");
        setExistingVote(data);
        loadMatchVotes(selectedMatchId);
    }
  };

  const formatTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  // Verifica se o usuário atual jogou a partida selecionada
  const isUserAllowedToVote = players.some(
    (p) => Number(p.id) === Number(user?.player_id)
  );

  // 5. FUNÇÕES DE RENDERIZAÇÃO DE INTERFACE
  const renderVotingArea = (round) => {
    const isRoundActive = currentRound === round && isVotingOpen;
    const hasVotedThisRound = existingVote && existingVote.round === round;
    
    // Trava geral para a área de votação
    const canVote = isRoundActive && isUserAllowedToVote && !hasVotedThisRound;

    return (
      <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #eee", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <h4 style={{ margin: "0 0 15px 0" }}>{round === 1 ? "📝 1º Turno" : "🔥 2º Turno (Desempate)"}</h4>
        
        {/* Aviso de erro (Mesmo Jogador) */}
        {bolaCheiaId && bolaMurchaId && bolaCheiaId === bolaMurchaId && (
          <div style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "8px", padding: "10px", fontSize: "14px", marginBottom: "12px" }}>
            ⚠️ O mesmo jogador não pode ser bola cheia e bola murcha.
          </div>
        )}

        {/* Aviso de Restrição (Não Participou) */}
        {!isUserAllowedToVote && (
          <div style={{ background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "8px", padding: "10px", fontSize: "14px", marginBottom: "12px" }}>
            ❌ Você não participou desta partida e não pode votar.
          </div>
        )}

        {/* Aviso de Sucesso (Já Votou) */}
        {hasVotedThisRound ? (
          <div style={{ padding: "12px", background: "#d4edda", color: "#155724", borderRadius: "8px", fontWeight: "500", border: "1px solid #c3e6cb" }}>
            ✅ Seu voto foi registrado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {players.map(p => {
              const canCheia = round === 1 || runoffCandidates.cheia.includes(p.id);
              const canMurcha = round === 1 || runoffCandidates.murcha.includes(p.id);
              if (!canCheia && !canMurcha) return null;

              // Condição para desabilitar o clique nos jogadores
              const disableClick = !canVote || p.id === user?.player_id;

              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8f9fa", borderRadius: "8px", opacity: disableClick ? 0.6 : 1 }}>
                  <span style={{ fontSize: "14px" }}>{p.name} {p.id === user?.player_id && <small style={{color: "#888"}}>(Você)</small>}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {canCheia && (
                      <button 
                        onClick={() => setBolaCheiaId(p.id)} 
                        disabled={disableClick}
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "none", cursor: disableClick ? "not-allowed" : "pointer", background: bolaCheiaId === p.id ? "#28a745" : "#e9ecef", color: bolaCheiaId === p.id ? "#fff" : "#333" }}
                      >
                        ⚽Cheia
                      </button>
                    )}
                    {canMurcha && (
                      <button 
                        onClick={() => setBolaMurchaId(p.id)} 
                        disabled={disableClick}
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "none", cursor: disableClick ? "not-allowed" : "pointer", background: bolaMurchaId === p.id ? "#dc3545" : "#e9ecef", color: bolaMurchaId === p.id ? "#fff" : "#333" }}
                      >
                        🎈Murcha
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Botão de Salvar com o visual solicitado */}
            <button 
              onClick={handleSaveVote} 
              disabled={!canVote || !bolaCheiaId || !bolaMurchaId || loadingVote}
              style={{ 
                width: "100%",
                marginTop: "10px", 
                padding: "14px", 
                borderRadius: "8px", 
                border: "none", 
                background: (canVote && bolaCheiaId && bolaMurchaId && !loadingVote) ? "#007bff" : "#ced4da", 
                color: (canVote && bolaCheiaId && bolaMurchaId && !loadingVote) ? "white" : "#6c757d", 
                fontWeight: "bold", 
                fontSize: "15px",
                cursor: (canVote && bolaCheiaId && bolaMurchaId && !loadingVote) ? "pointer" : "not-allowed" 
              }}
            >
              {loadingVote ? "Gravando..." : "💾 Confirmar Voto"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSummaryArea = (round, title) => {
    const votes = allVotes.filter(v => v.round === round);
    const totalVotes = votes.length;

    let vencedoresC = [];
    let vencedoresM = [];
    let rankingCheia = [];
    let rankingMurcha = [];

    // Só processamos os rankings se houver votos para o turno
    if (totalVotes > 0) {
      const processRanking = (type) => {
        const map = {};
        votes.forEach(v => {
          const id = type === 'C' ? v.bola_cheia_player_id : v.bola_murcha_player_id;
          map[id] = (map[id] || 0) + 1;
        });

        return Object.entries(map)
          .map(([id, total]) => {
            const p = players.find(player => player.id === Number(id));
            return { ...p, total };
          })
          .filter(p => p && p.name) 
          .sort((a, b) => {
            if (round === 2 && isVotingOpen) return a.name.localeCompare(b.name); 
            return b.total - a.total || a.name.localeCompare(b.name); 
          });
      };

      rankingCheia = processRanking('C');
      rankingMurcha = processRanking('M');

      const getWinners = (ranking) => {
        if (ranking.length === 0) return [];
        const max = Math.max(...ranking.map(r => r.total));
        return ranking.filter(r => r.total === max);
      };

      vencedoresC = getWinners(rankingCheia);
      vencedoresM = getWinners(rankingMurcha);
    }

    return (
      <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e0e0e0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 20px 0", textAlign: "center", color: "#333", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px" }}>{title}</h3>

        {/* VALIDAÇÃO DE QUANTIDADE DE VOTOS */}
        {totalVotes === 0 ? (
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "10px", padding: "12px", textAlign: "center", color: "#777", fontSize: "14px" }}>
            Nenhum voto registrado para este turno.
          </div>
        ) : (
          <>
            {/* FAIXA COM TOTAL DE VOTOS */}
            <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "10px", padding: "10px 12px", marginBottom: "20px", fontSize: "14px", color: "#444", textAlign: "center" }}>
              Total de votos registrados: <strong>{totalVotes}</strong>
            </div>

            {/* --- DESTAQUE: VENCEDORES --- */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "25px" }}>
              <div style={{ background: "#ebfbee", padding: "15px", borderRadius: "12px", textAlign: "center", border: "1px solid #c3e6cb" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#2f9e44", textTransform: "uppercase" }}>⚽ CHEIA</div>
                {vencedoresC.map(v => (
                  <div key={v.id} style={{ fontSize: "16px", fontWeight: "800", color: "#1b5e20", marginTop: "5px" }}>{v.name}</div>
                ))}
              </div>

              <div style={{ background: "#fff5f5", padding: "15px", borderRadius: "12px", textAlign: "center", border: "1px solid #f5c6cb" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", color: "#e03131", textTransform: "uppercase" }}>🎈 MURCHA</div>
                {vencedoresM.map(v => (
                  <div key={v.id} style={{ fontSize: "16px", fontWeight: "800", color: "#c92a2a", marginTop: "5px" }}>{v.name}</div>
                ))}
              </div>
            </div>

            {/* --- LISTAGEM COMPLETA --- */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Coluna Cheia */}
              <div>
                <p style={{ fontSize: "10px", fontWeight: "bold", color: "#888", marginBottom: "8px" }}>Votados:</p>
                {rankingCheia.map(r => (
                  <div key={r.id} style={{ fontSize: "10px", padding: "4px 0", borderBottom: "1px solid #f5f5f5", color: "#444" }}>
                    <strong>{r.name}</strong> - <small>{r.team === 'A' ? 'Preto' : 'Verm'}</small> <strong>({r.total})</strong>
                  </div>
                ))}
              </div>

              {/* Coluna Murcha */}
              <div>
                <p style={{ fontSize: "10px", fontWeight: "bold", color: "#888", marginBottom: "8px" }}>Votados:</p>
                {rankingMurcha.map(r => (
                  <div key={r.id} style={{ fontSize: "10px", padding: "4px 0", borderBottom: "1px solid #f5f5f5", color: "#444" }}>
                    <strong>{r.name}</strong> - <small>{r.team === 'A' ? 'Preto' : 'Verm'}</small> <strong>({r.total})</strong>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px" }}>
        <select value={selectedMatchId} onChange={(e) => {
          setSelectedMatchId(e.target.value);
          loadConfirmedPlayers(e.target.value);
        }} style={{ width: "100%", padding: "10px", borderRadius: "8px" }}>
          <option value="">Selecione a data...</option>
          {matches.map(m => <option key={m.id} value={m.id}>{m.date.split("-").reverse().join("/")}</option>)}
        </select>
        <div style={{ marginTop: "10px", fontWeight: "bold", color: "#007bff" }}>{timeLeft}</div>
      </div>

      {selectedMatchId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* SEÇÃO 1º TURNO */}
          <section>
            {currentRound === 1 && isVotingOpen 
              ? renderVotingArea(1) 
              : renderSummaryArea(1, "📊 Resultado 1º Turno")}
          </section>

          {/* SEÇÃO 2º TURNO */}
          {(runoffCandidates.cheia.length > 1 || runoffCandidates.murcha.length > 1) && (
            <section>
              <hr style={{ border: "none", borderTop: "1px dashed #ccc", margin: "10px 0 25px 0" }} />
              {currentRound === 2 && isVotingOpen 
                ? renderVotingArea(2) 
                : renderSummaryArea(2, "🏁 Resultado Final - Desempate")}
            </section>
          )}

        </div>
      )}
    </div>
  );
}