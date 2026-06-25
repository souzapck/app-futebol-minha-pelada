import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

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
  
  // Máquina de estado para controlar as fases da votação
  const [votingPhase, setVotingPhase] = useState("WAITING"); // WAITING | T1 | INTERVAL | T2 | CLOSED
  const [loadingVote, setLoadingVote] = useState(false);

  const [currentRound, setCurrentRound] = useState(1);
  const [runoffCandidates, setRunoffCandidates] = useState({ cheia: [], murcha: [] });
  const [allVotes, setAllVotes] = useState([]);

  const { activeGroup } = useGroup();

  useEffect(() => {
    if (activeGroup) {
      loadMatches();
      setSelectedMatchId("");
      setPlayers([]);
      setAllVotes([]);
      setExistingVote(null);
      setRunoffCandidates({ cheia: [], murcha: [] });
      setCurrentRound(1);
      setVotingPhase("WAITING");
    }
  }, [activeGroup]);

  const loadMatches = async () => {
    setLoadingMatches(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id_grupo", activeGroup.id_grupo)
      .order("date", { ascending: false });
    
    setLoadingMatches(false);
    if (!error) setMatches(data || []);
  };

  const loadConfirmedPlayers = async (matchId) => {
    if (!matchId) return setPlayers([]);
    setLoadingPlayers(true);
    
    const { data, error } = await supabase
      .from("match_player")
      .select(`shirt_number, team, status, post_draw_action, player_id, players:player_id!inner (id, name)`)
      .eq("match_id", matchId)
      .eq("status", "confirmado");

    setLoadingPlayers(false);
    if (!error) {
      setPlayers(data.filter(i => !i.post_draw_action || i.post_draw_action === "incluido").map(i => ({
        id: i.players.id,
        name: i.players.name,
        team: i.team,
        shirt_number: i.shirt_number
      })));
    } else {
        console.error("Erro ao carregar jogadores confirmados:", error);
    }
  };

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
    } else {
      setBolaCheiaId(null);
      setBolaMurchaId(null);
    }
  };

  useEffect(() => {
    if (selectedMatchId && user?.player_id) {
      loadExistingVote(selectedMatchId, currentRound);
    }
  }, [selectedMatchId, user?.player_id, currentRound]); 

  useEffect(() => {
    if (!selectedMatchId || matches.length === 0) return;
    const match = matches.find(m => String(m.id) === String(selectedMatchId));
    if (!match) return;

    const updateTimer = () => {
      const isLatestMatch = matches.length > 0 && match.id === matches[0].id;

      if (!isLatestMatch) {
        setTimeLeft("Votação encerrada (Partida Anterior).");
        setIsVotingOpen(false);
        setVotingPhase("CLOSED");
        return; 
      }

      const now = new Date();
      const horaCrua = activeGroup?.hora_jogo_grupo || "22:30:00"; 
      const [ano, mes, dia] = match.date.split("-").map(Number);
      const [hora, minuto, segundo] = horaCrua.split(":").map(Number);
      
      const matchStart = new Date(ano, mes - 1, dia, hora, minuto, segundo || 0);
      
      if (isNaN(matchStart.getTime())) {
         setTimeLeft("⏳ Erro de leitura de data no celular.");
         setIsVotingOpen(false);
         setVotingPhase("WAITING");
         return;
      }
      
      const t1Start = new Date(matchStart.getTime() + 90 * 60 * 1000); 
      const t1End = new Date(t1Start.getTime() + DURACAO_T1);
      const t2Start = new Date(t1End.getTime() + INTERVALO);
      const t2End = new Date(t2Start.getTime() + DURACAO_T2);

      if (!match.is_drawn) {
        setTimeLeft("Aguardando fechamento da partida...");
        setIsVotingOpen(false);
        setVotingPhase("WAITING");
      } else if (now < t1Start) {
        const horaAbertura = t1Start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setTimeLeft(`Aguarde, início da votação às ${horaAbertura}!`);
        setIsVotingOpen(false);
        setVotingPhase("WAITING");
      } else if (now <= t1End) {
        if (currentRound !== 1) {
          setCurrentRound(1);
          setExistingVote(null);
          loadMatchVotes(match.id); 
        }
        setTimeLeft(`1º Turno: ${formatTime(t1End - now)}`);
        setIsVotingOpen(true);
        setVotingPhase("T1");
      } else if (now < t2Start) {
        setTimeLeft("Apurando empates... 2º Turno em breve.");
        setIsVotingOpen(false);
        setVotingPhase("INTERVAL");
      } else if (now <= t2End) {
        const hasEmpate = runoffCandidates.cheia.length > 1 || runoffCandidates.murcha.length > 1;
        
        if (hasEmpate) {
          if (currentRound !== 2) {
            setCurrentRound(2);
            setExistingVote(null);
            loadMatchVotes(match.id); 
          }
          setTimeLeft(`2º TURNO (Desempate): ${formatTime(t2End - now)}`);
          setIsVotingOpen(true);
          setVotingPhase("T2");
        } else {
          setTimeLeft("Votação encerrada (Sem empates).");
          setIsVotingOpen(false);
          setVotingPhase("CLOSED");
        }
      } else {
        setTimeLeft("Votação encerrada.");
        setIsVotingOpen(false);
        setVotingPhase("CLOSED");
      }
    };

    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [selectedMatchId, matches, currentRound, runoffCandidates, activeGroup]);

  // === CALCULA O STATUS DA VOTAÇÃO PARA O DROPDOWN ===
  const getVotingStatusLabel = (match, index) => {
    if (index !== 0) return "🔒 Encerrada"; 
    if (!match.is_drawn) return "⏳ Aguardando jogo";

    const now = new Date();
    const horaCrua = activeGroup?.hora_jogo_grupo || "22:30:00"; 
    const [ano, mes, dia] = match.date.split("-").map(Number);
    const [hora, minuto, segundo] = horaCrua.split(":").map(Number);
    
    const matchStart = new Date(ano, mes - 1, dia, hora, minuto, segundo || 0);
    if (isNaN(matchStart.getTime())) return "🔒 Encerrada";
    
    const t1Start = new Date(matchStart.getTime() + 90 * 60 * 1000); 
    const t2End = new Date(t1Start.getTime() + DURACAO_T1 + INTERVALO + DURACAO_T2);

    if (now < t1Start) return "⏳ Aguardando";
    if (now > t2End) return "🔒 Encerrada";
    return "🟢 Aberta";
  };

  const getRunoffCandidates = (votesT1) => {
    const counts = votesT1.reduce((acc, v) => {
      if (v.bola_cheia_player_id) acc.c[v.bola_cheia_player_id] = (acc.c[v.bola_cheia_player_id] || 0) + 1;
      if (v.bola_murcha_player_id) acc.m[v.bola_murcha_player_id] = (acc.m[v.bola_murcha_player_id] || 0) + 1;
      return acc;
    }, { c: {}, m: {} });

    const calc = (obj) => {
      const max = Math.max(...Object.values(obj), 0);
      const tied = max > 0 ? Object.keys(obj).filter(k => obj[k] === max).map(Number) : [];
      return tied.length > 1 ? tied : []; 
    };
    return { cheia: calc(counts.c), murcha: calc(counts.m) };
  };

  const handleSaveVote = async () => {
    if (loadingVote) return; 

    const needsCheia = currentRound === 1 || runoffCandidates.cheia.length > 1;
    const needsMurcha = currentRound === 1 || runoffCandidates.murcha.length > 1;

    if (needsCheia && !bolaCheiaId) return alert("Selecione o Bola Cheia!");
    if (needsMurcha && !bolaMurchaId) return alert("Selecione o Bola Murcha!");
    if (needsCheia && needsMurcha && bolaCheiaId === bolaMurchaId) return alert("Não pode ser a mesma pessoa!");
    
    setLoadingVote(true);

    const { data, error } = await supabase
      .from("match_votes")
      .insert([{
        id_grupo: activeGroup.id_grupo, 
        match_id: selectedMatchId,
        voter_player_id: user.player_id,
        bola_cheia_player_id: needsCheia ? bolaCheiaId : null,
        bola_murcha_player_id: needsMurcha ? bolaMurchaId : null,
        round: currentRound
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

  const isUserAllowedToVote = players.some(
    (p) => Number(p.id) === Number(user?.player_id)
  );

  const renderVotingArea = (round) => {
    const isRoundActive = currentRound === round && isVotingOpen;
    const hasVotedThisRound = existingVote && existingVote.round === round;
    
    const canVote = isRoundActive && isUserAllowedToVote && !hasVotedThisRound;

    const selectedMatch = matches.find(m => String(m.id) === String(selectedMatchId));

    const needsCheia = round === 1 || runoffCandidates.cheia.length > 1;
    const needsMurcha = round === 1 || runoffCandidates.murcha.length > 1;

    const canSubmit = canVote && (!needsCheia || bolaCheiaId) && (!needsMurcha || bolaMurchaId) && !loadingVote;

    const sortedPlayers = [...players].sort((a, b) => {
      const teamA = a.team || "Z"; 
      const teamB = b.team || "Z";
      if (teamA !== teamB) return teamA.localeCompare(teamB);
      return a.name.localeCompare(b.name);
    });

    return (
      <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #eee", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <h4 style={{ margin: "0 0 15px 0" }}>{round === 1 ? "📝 1º Turno" : "🔥 2º Turno (Desempate)"}</h4>
        
        {bolaCheiaId && bolaMurchaId && bolaCheiaId === bolaMurchaId && (
          <div style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "8px", padding: "10px", fontSize: "14px", marginBottom: "12px" }}>
            ⚠️ O mesmo jogador não pode ser bola cheia e bola murcha.
          </div>
        )}

        {!isUserAllowedToVote && (
          <div style={{ background: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "8px", padding: "10px", fontSize: "14px", marginBottom: "12px" }}>
            ❌ Você não participou desta partida e não pode votar.
          </div>
        )}

        {hasVotedThisRound ? (
          <div style={{ padding: "12px", background: "#d4edda", color: "#155724", borderRadius: "8px", fontWeight: "500", border: "1px solid #c3e6cb" }}>
            ✅ Seu voto foi registrado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sortedPlayers.map((p, index) => {
              const canCheia = round === 1 || runoffCandidates.cheia.includes(p.id);
              const canMurcha = round === 1 || runoffCandidates.murcha.includes(p.id);
              
              if (!canCheia && !canMurcha) return null;

              const disableClick = !canVote || p.id === user?.player_id;

              const teamName = p.team === "A" ? (selectedMatch?.team_a_name || "Time A") : 
                               p.team === "B" ? (selectedMatch?.team_b_name || "Time B") : 
                               p.team === "C" ? (selectedMatch?.team_c_name || "Time C") : "";
                               
              const teamColor = p.team === "A" ? (selectedMatch?.team_a_color || "#333") : 
                                p.team === "B" ? (selectedMatch?.team_b_color || "#333") : 
                                p.team === "C" ? (selectedMatch?.team_c_color || "#333") : "transparent";

              const isFirstOfNewTeam = index > 0 && p.team && sortedPlayers[index - 1].team !== p.team;

              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8f9fa", borderRadius: "8px", opacity: disableClick ? 0.6 : 1, marginTop: isFirstOfNewTeam ? "8px" : "0" }}>
                  
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, paddingRight: "8px" }}>
                    {p.team && selectedMatch?.is_drawn && (
                      <span style={{ 
                        color: teamColor, 
                        fontSize: "10px", 
                        fontWeight: "900",
                        textTransform: "uppercase",
                        marginBottom: "2px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: teamColor }}></span>
                        {teamName}
                      </span>
                    )}

                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#333", whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.2" }}>
                      {p.name} {p.id === user?.player_id && <small style={{color: "#888", fontWeight: "normal"}}>(Você)</small>}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    {canCheia && (
                      <button 
                        onClick={() => setBolaCheiaId(p.id)} 
                        disabled={disableClick}
                        style={{ padding: "6px 8px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: disableClick ? "not-allowed" : "pointer", background: bolaCheiaId === p.id ? "#28a745" : "#e9ecef", color: bolaCheiaId === p.id ? "#fff" : "#333" }}
                      >
                        ⚽ Cheia
                      </button>
                    )}
                    {canMurcha && (
                      <button 
                        onClick={() => setBolaMurchaId(p.id)} 
                        disabled={disableClick}
                        style={{ padding: "6px 8px", fontSize: "11px", borderRadius: "6px", border: "none", cursor: disableClick ? "not-allowed" : "pointer", background: bolaMurchaId === p.id ? "#dc3545" : "#e9ecef", color: bolaMurchaId === p.id ? "#fff" : "#333" }}
                      >
                        🎈 Murcha
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
            
            <button 
              onClick={handleSaveVote} 
              disabled={!canSubmit}
              style={{ 
                width: "100%",
                marginTop: "10px", 
                padding: "14px", 
                borderRadius: "8px", 
                border: "none", 
                background: canSubmit ? "#007bff" : "#ced4da", 
                color: canSubmit ? "white" : "#6c757d", 
                fontWeight: "bold", 
                fontSize: "15px",
                cursor: canSubmit ? "pointer" : "not-allowed" 
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
    const votesT1 = allVotes.filter(v => v.round === 1);
    const votesT2 = allVotes.filter(v => v.round === 2);

    const showCheia = round === 1 || runoffCandidates.cheia.length > 1;
    const showMurcha = round === 1 || runoffCandidates.murcha.length > 1;

    let vencedoresC = [];
    let vencedoresM = [];
    let rankingCheia = [];
    let rankingMurcha = [];

    const processRanking = (type, votesToUse) => {
      const map = {};
      votesToUse.forEach(v => {
        const id = type === 'C' ? v.bola_cheia_player_id : v.bola_murcha_player_id;
        if (id) map[id] = (map[id] || 0) + 1;
      });

      return Object.entries(map)
        .map(([id, total]) => {
          const p = players.find(player => player.id === Number(id));
          return p ? { ...p, total } : null;
        })
        .filter(Boolean) 
        .sort((a, b) => {
          if (round === 2 && isVotingOpen) return a.name.localeCompare(b.name); 
          return b.total - a.total || a.name.localeCompare(b.name); 
        });
    };

    // AQUI O CARD DE RESUMO MOSTRA A REALIDADE EXATA DAQUELE TURNO (SE NÃO HOUVE VOTOS, FICA VAZIO)
    if (showCheia) rankingCheia = processRanking('C', round === 2 ? votesT2 : votesT1);
    if (showMurcha) rankingMurcha = processRanking('M', round === 2 ? votesT2 : votesT1);

    const getWinners = (ranking) => {
      if (ranking.length === 0) return [];
      const max = Math.max(...ranking.map(r => r.total));
      return ranking.filter(r => r.total === max);
    };

    vencedoresC = getWinners(rankingCheia);
    vencedoresM = getWinners(rankingMurcha);

    const gridColumns = (showCheia && showMurcha) ? "1fr 1fr" : "1fr";

    return (
      <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e0e0e0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 20px 0", textAlign: "center", color: "#333", borderBottom: "2px solid #f0f0f0", paddingBottom: "10px" }}>{title}</h3>

        {(!showCheia || rankingCheia.length === 0) && (!showMurcha || rankingMurcha.length === 0) ? (
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "10px", padding: "12px", textAlign: "center", color: "#777", fontSize: "14px" }}>
            Nenhum voto registrado.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: "15px", marginBottom: "25px" }}>
              {showCheia && (
                <div style={{ background: "#ebfbee", padding: "15px", borderRadius: "12px", textAlign: "center", border: "1px solid #c3e6cb" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#2f9e44", textTransform: "uppercase" }}>⚽ CHEIA</div>
                  {vencedoresC.map(v => (
                    <div key={v.id} style={{ fontSize: "16px", fontWeight: "800", color: "#1b5e20", marginTop: "5px" }}>{v.name}</div>
                  ))}
                </div>
              )}

              {showMurcha && (
                <div style={{ background: "#fff5f5", padding: "15px", borderRadius: "12px", textAlign: "center", border: "1px solid #f5c6cb" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#e03131", textTransform: "uppercase" }}>🎈 MURCHA</div>
                  {vencedoresM.map(v => (
                    <div key={v.id} style={{ fontSize: "16px", fontWeight: "800", color: "#c92a2a", marginTop: "5px" }}>{v.name}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: "20px" }}>
              {showCheia && (
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", color: "#888", marginBottom: "8px" }}>Votados:</p>
                  {rankingCheia.map(r => (
                    <div key={r.id} style={{ fontSize: "10px", padding: "4px 0", borderBottom: "1px solid #f5f5f5", color: "#444" }}>
                      <strong>{r.name}</strong> <strong>({r.total})</strong>
                    </div>
                  ))}
                </div>
              )}

              {showMurcha && (
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "bold", color: "#888", marginBottom: "8px" }}>Votados:</p>
                  {rankingMurcha.map(r => (
                    <div key={r.id} style={{ fontSize: "10px", padding: "4px 0", borderBottom: "1px solid #f5f5f5", color: "#444" }}>
                      <strong>{r.name}</strong> <strong>({r.total})</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderFinalWinnersCard = () => {
    const getWinners = (type, targetRound) => {
      const votes = allVotes.filter(v => v.round === targetRound);
      const map = {};
      votes.forEach(v => {
        const id = type === 'C' ? v.bola_cheia_player_id : v.bola_murcha_player_id;
        if (id) map[id] = (map[id] || 0) + 1;
      });
      const ranking = Object.entries(map)
        .map(([id, total]) => {
          const p = players.find(player => player.id === Number(id));
          return p ? { ...p, total } : null;
        })
        .filter(Boolean);
      if (ranking.length === 0) return [];
      const max = Math.max(...ranking.map(r => r.total));
      return ranking.filter(r => r.total === max);
    };

    // === PROTEÇÃO DE FALLBACK APENAS PARA O PÓDIO FINAL ===
    // Analisamos se a urna do 2º turno não ficou completamente vazia
    const votesT2 = allVotes.filter(v => v.round === 2);
    const hasT2CheiaVotes = votesT2.some(v => v.bola_cheia_player_id);
    const hasT2MurchaVotes = votesT2.some(v => v.bola_murcha_player_id);

    // Se houve desempate mas NINGUÉM votou na categoria (T2 vazio), buscamos os empatados do 1º turno!
    let finalCheia = (runoffCandidates.cheia.length > 1 && hasT2CheiaVotes) ? getWinners('C', 2) : getWinners('C', 1);
    let finalMurcha = (runoffCandidates.murcha.length > 1 && hasT2MurchaVotes) ? getWinners('M', 2) : getWinners('M', 1);

    if (finalCheia.length === 0 && finalMurcha.length === 0) return null;

    return (
      <div style={{ background: "linear-gradient(135deg, #ffd700 0%, #ffb300 100%)", borderRadius: "16px", padding: "4px", boxShadow: "0 6px 15px rgba(255, 215, 0, 0.2)", marginBottom: "5px" }}>
        <div style={{ background: "#fff", borderRadius: "14px", padding: "20px", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 20px 0", color: "#333", fontSize: "20px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            🏆 Eleitos da Rodada 🏆
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div style={{ background: "#ebfbee", padding: "15px", borderRadius: "12px", border: "2px solid #51cf66", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: "900", color: "#2b8a3e", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>⚽ Bola Cheia</div>
              {finalCheia.length > 0 ? finalCheia.map(v => (
                <div key={v.id} style={{ fontSize: "18px", fontWeight: "900", color: "#1b5e20", lineHeight: "1.2" }}>{v.name}</div>
              )) : <div style={{color: "#888", fontSize: "14px"}}>Sem votos</div>}
            </div>

            <div style={{ background: "#fff5f5", padding: "15px", borderRadius: "12px", border: "2px solid #ff8787", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: "900", color: "#c92a2a", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>🎈 Bola Murcha</div>
              {finalMurcha.length > 0 ? finalMurcha.map(v => (
                <div key={v.id} style={{ fontSize: "18px", fontWeight: "900", color: "#c92a2a", lineHeight: "1.2" }}>{v.name}</div>
              )) : <div style={{color: "#888", fontSize: "14px"}}>Sem votos</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "5px" }}>
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#444", fontSize: "14px" }}>
          📅 Selecione a Partida
        </label>
        
        {/* Envolvendo em um display flex para forçar a fluidez correta no celular */}
        <div style={{ display: "flex", width: "100%" }}>
          <select value={selectedMatchId} onChange={(e) => {
            setSelectedMatchId(e.target.value);
            loadConfirmedPlayers(e.target.value);
            }} 
            style={{ 
              width: "auto",               /* 1. Flexível: A caixa cresce e abraça o texto */
              maxWidth: "100%",            /* 2. Limite: Trava no limite máximo do celular */
              boxSizing: "border-box",     /* 3. Segurança: Impede o padding de estourar a tela */
              padding: "12px", 
              borderRadius: "8px", 
              border: "1px solid #ccc", 
              fontSize: "13px", 
              background: "#f8f9fa", 
              color: "#333", 
              outline: "none", 
              cursor: "pointer",
              whiteSpace: "nowrap",        /* ⛔ A TRAVA MÁGICA: Proíbe terminantemente a quebra de linha! */
              overflow: "hidden",          /* Esconde qualquer rebarba visual */
              textOverflow: "ellipsis"     /* Se a tela do celular for microscópica, ele põe "..." em vez de quebrar */
            }}
          >
            <option value="">Selecione a data...</option>
            {matches.map((m, index) => (
              <option key={m.id} value={m.id}>
                {m.date.split("-").reverse().join("/")} - {getVotingStatusLabel(m, index)}
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ marginTop: "10px", fontWeight: "bold", color: "#007bff" }}>{timeLeft}</div>
      </div>

      {selectedMatchId && votingPhase !== "WAITING" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* Aparece APENAS quando toda a votação acaba (Máquina de Estado no CLOSED) */}
          {votingPhase === "CLOSED" && renderFinalWinnersCard()}

          <section>
            {votingPhase === "T1" 
              ? renderVotingArea(1) 
              : renderSummaryArea(1, "📊 Resultado 1º Turno")}
          </section>

          {(runoffCandidates.cheia.length > 1 || runoffCandidates.murcha.length > 1) && (votingPhase === "T2" || votingPhase === "CLOSED") && (
            <section>
              <hr style={{ border: "none", borderTop: "1px dashed #ccc", margin: "10px 0 25px 0" }} />
              {votingPhase === "T2" 
                ? renderVotingArea(2) 
                : renderSummaryArea(2, "🏁 Resultado Final do Desempate")}
            </section>
          )}

        </div>
      )}
    </div>
  );
}