import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

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
  const [isMatchEligible, setIsMatchEligible] = useState(false);
  const [loadingVote, setLoadingVote] = useState(false);

  const [voteSummary, setVoteSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoadingMatches(true);

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("date", { ascending: false });

    setLoadingMatches(false);

    if (error) {
      console.error("Erro ao carregar partidas:", error);
      return;
    }

    setMatches(data || []);
  };

  const loadConfirmedPlayers = async (matchId) => {
    if (!matchId) {
      setPlayers([]);
      return;
    }

    setLoadingPlayers(true);

    const { data: matchPlayersData, error: mpError } = await supabase
      .from("match_player")
      .select("*")
      .eq("match_id", matchId);

    if (mpError) {
      console.error("Erro ao carregar match_player:", mpError);
      setLoadingPlayers(false);
      return;
    }

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("is_hidden", false);

    setLoadingPlayers(false);

    if (playersError) {
      console.error("Erro ao carregar players:", playersError);
      return;
    }

    const confirmados = (matchPlayersData || [])
      .filter((item) => String(item.status || "").trim().toLowerCase() === "confirmado")
      .map((item) => {
        const player = (playersData || []).find(
          (p) => Number(p.id) === Number(item.player_id)
        );

        if (!player) return null;

        return {
          id: player.id,
          name: player.name,
          position: player.position,
          rating: player.rating,
          shirt_number: item.shirt_number ?? player.shirt_number ?? null,
          team: item.team || null
        };
      })
      .filter(Boolean);

    const pesosPosicao = { GOL: 1, ZAG: 2, LAT: 3, MEI: 4, ATA: 5 };
    const pesosTime = { A: 1, B: 2 };

    confirmados.sort((a, b) => {
      const teamDiff = (pesosTime[a.team] || 99) - (pesosTime[b.team] || 99);
      if (teamDiff !== 0) return teamDiff;

      const posDiff = (pesosPosicao[a.position] || 99) - (pesosPosicao[b.position] || 99);
      if (posDiff !== 0) return posDiff;

      return a.name.localeCompare(b.name);
    });

    setPlayers(confirmados);
    setBolaCheiaId(null);
    setBolaMurchaId(null);
    setVoteSummary(null);
  };

  const loadExistingVote = async (matchId) => {
    if (!matchId || !user?.player_id) {
      setExistingVote(null);
      return;
    }

    const { data, error } = await supabase
      .from("match_votes")
      .select("*")
      .eq("match_id", matchId)
      .eq("voter_player_id", user.player_id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar voto existente:", error);
      return;
    }

    setExistingVote(data || null);

    if (data) {
      setBolaCheiaId(data.bola_cheia_player_id);
      setBolaMurchaId(data.bola_murcha_player_id);
    }
  };

  const selectedMatch = useMemo(
    () => matches.find((m) => String(m.id) === String(selectedMatchId)),
    [matches, selectedMatchId]
  );

  const matchDateLabel = selectedMatch
    ? selectedMatch.date.split("-").reverse().join("/")
    : "";

  const bolaCheiaPlayer = players.find((p) => p.id === bolaCheiaId);
  const bolaMurchaPlayer = players.find((p) => p.id === bolaMurchaId);

  const getVotingWindow = (matchDate) => {
    if (!matchDate) return null;

    const start = new Date(`${matchDate}T22:30:00-03:00`);
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    return { start, end };
  };

  const formatTimeLeft = (ms) => {
    if (ms <= 0) return "00:00:00";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  };

  const isVotingFinished = useMemo(() => {
    if (!selectedMatch) return false;
    const windowData = getVotingWindow(selectedMatch.date);
    if (!windowData) return false;
    return new Date() > windowData.end;
  }, [selectedMatch, timeLeft]);

  useEffect(() => {
    if (!selectedMatch) {
      setIsVotingOpen(false);
      setIsMatchEligible(false);
      setTimeLeft("");
      return;
    }

    const matchClosed = !!selectedMatch.is_drawn;
    setIsMatchEligible(matchClosed);

    const updateTimer = () => {
      const windowData = getVotingWindow(selectedMatch.date);
      if (!windowData) return;

      const now = new Date();
      const { start, end } = windowData;

      const open = matchClosed && now >= start && now <= end;
      setIsVotingOpen(open);

      if (!matchClosed) {
        setTimeLeft("A votação será liberada após o fechamento da partida.");
      } else if (open) {
        setTimeLeft(formatTimeLeft(end.getTime() - now.getTime()));
      } else if (now < start) {
        setTimeLeft("A votação ainda não começou.");
      } else {
        setTimeLeft("Votação encerrada.");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [selectedMatch]);

  const loadVoteSummary = async (matchId, eligiblePlayers) => {
    if (!matchId) return;

    setLoadingSummary(true);

    const { data, error } = await supabase
      .from("match_votes")
      .select("*")
      .eq("match_id", matchId);

    setLoadingSummary(false);

    if (error) {
      console.error("Erro ao carregar resumo da votação:", error);
      return;
    }

    const cheiaCount = {};
    const murchaCount = {};

    (data || []).forEach((vote) => {
      cheiaCount[vote.bola_cheia_player_id] =
        (cheiaCount[vote.bola_cheia_player_id] || 0) + 1;

      murchaCount[vote.bola_murcha_player_id] =
        (murchaCount[vote.bola_murcha_player_id] || 0) + 1;
    });

    const mapPlayer = (countMap) =>
      (eligiblePlayers || [])
        .map((player) => ({
          ...player,
          votes: countMap[player.id] || 0
        }))
        .filter((player) => player.votes > 0)
        .sort((a, b) => {
          if (b.votes !== a.votes) return b.votes - a.votes;
          return a.name.localeCompare(b.name);
        });

    const cheiaRanking = mapPlayer(cheiaCount);
    const murchaRanking = mapPlayer(murchaCount);

    const maxCheia = cheiaRanking.length > 0 ? cheiaRanking[0].votes : 0;
    const maxMurcha = murchaRanking.length > 0 ? murchaRanking[0].votes : 0;

    const vencedoresCheia = cheiaRanking.filter((p) => p.votes === maxCheia);
    const vencedoresMurcha = murchaRanking.filter((p) => p.votes === maxMurcha);

    setVoteSummary({
      totalVotes: (data || []).length,
      cheiaRanking,
      murchaRanking,
      vencedoresCheia,
      vencedoresMurcha
    });
  };

  useEffect(() => {
    if (selectedMatch && isVotingFinished && selectedMatch.is_drawn) {
      loadVoteSummary(selectedMatch.id, players);
    }
  }, [selectedMatch, isVotingFinished, players]);

  const canVote =
    !!selectedMatchId &&
    !!bolaCheiaId &&
    !!bolaMurchaId &&
    bolaCheiaId !== bolaMurchaId &&
    isVotingOpen &&
    !existingVote;

  const formatPlayerLine = (p) => {
    const teamLabel =
      p.team === "A"
        ? "Preto/Rosa"
        : p.team === "B"
        ? "Vermelho/Branco"
        : "Sem time";

    return `${p.name} (${p.position}) - ${teamLabel}`;
  };

  const handleSaveVote = async () => {
    if (!selectedMatch || !isVotingOpen || existingVote) return;

    if (!bolaCheiaId || !bolaMurchaId || bolaCheiaId === bolaMurchaId) {
      alert("⚠️ Escolha jogadores diferentes para bola cheia e bola murcha.");
      return;
    }

    setLoadingVote(true);

    const { error } = await supabase
      .from("match_votes")
      .insert([
        {
          match_id: selectedMatch.id,
          voter_player_id: user.player_id,
          bola_cheia_player_id: bolaCheiaId,
          bola_murcha_player_id: bolaMurchaId
        }
      ]);

    setLoadingVote(false);

    if (error) {
      console.error("Erro ao salvar votação:", error);
      alert(`❌ Erro ao salvar votação: ${error.message}`);
      return;
    }

    alert("✅ Votação registrada com sucesso!");
    await loadExistingVote(selectedMatch.id);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "16px",
          border: "1px solid #eee",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          marginBottom: "20px"
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "bold",
            color: "#444",
            marginBottom: "8px"
          }}
        >
          Partida
        </label>

        <select
          value={selectedMatchId}
          onChange={async (e) => {
            const matchId = e.target.value;
            setSelectedMatchId(matchId);
            await loadConfirmedPlayers(matchId);
            await loadExistingVote(matchId);
          }}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "15px",
            background: "#fff",
            color: "#000"
          }}
        >
          <option value="" style={{ color: "#000" }}>Selecione uma partida</option>
          {(matches || []).map((match) => (
            <option key={match.id} value={match.id} style={{ color: "#000" }}>
              {match.date.split("-").reverse().join("/")} {match.is_drawn ? " - Jogo fechado" : " - Jogo aberto"}
            </option>
          ))}
        </select>

        {loadingMatches && (
          <div style={{ marginTop: "10px", fontSize: "13px", color: "#777" }}>
            Carregando partidas...
          </div>
        )}
      </div>

      {selectedMatchId && (
        <>
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid #eee",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              marginBottom: "20px"
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                color: "#333",
                marginBottom: "8px",
                fontSize: "16px"
              }}
            >
              ⏳ {timeLeft}
            </div>

            {!isMatchEligible && (
              <div
                style={{
                  background: "#fff3cd",
                  color: "#856404",
                  border: "1px solid #ffeeba",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "14px"
                }}
              >
                🔒 A votação só é liberada após o fechamento da partida.
              </div>
            )}

            {existingVote && isVotingOpen && (
              <div
                style={{
                  marginTop: "10px",
                  background: "#d4edda",
                  color: "#155724",
                  border: "1px solid #c3e6cb",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "14px"
                }}
              >
                ✅ Você já registrou seu voto e não pode mais alterá-lo.
              </div>
            )}
          </div>

          {!isVotingFinished && (
            <>
              <div
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "16px",
                  border: "1px solid #eee",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  marginBottom: "20px"
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: "14px", color: "#333" }}>
                  ✅ Jogadores elegíveis — {matchDateLabel}
                </h4>

                {loadingPlayers ? (
                  <div style={{ color: "#777" }}>Carregando jogadores confirmados...</div>
                ) : players.length === 0 ? (
                  <div style={{ color: "#777" }}>Nenhum jogador confirmado nesta partida.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {players.map((p) => {
                      const isCheia = bolaCheiaId === p.id;
                      const isMurcha = bolaMurchaId === p.id;
                      const isSelf = Number(user?.player_id) === Number(p.id);
                      const voteLocked = !!existingVote || !isVotingOpen || !selectedMatch?.is_drawn;

                      return (
                        <div
                          key={p.id}
                          style={{
                            background: "#f8f9fa",
                            border: "1px solid #e9ecef",
                            borderRadius: "10px",
                            padding: "10px 12px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                            opacity: isSelf ? 0.75 : 1
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "500",
                              color: "#333",
                              fontSize: "14px",
                              flex: 1,
                              minWidth: "180px",
                              textAlign: "left"
                            }}
                          >
                            {formatPlayerLine(p)}
                            {isSelf && (
                              <span style={{ marginLeft: "8px", fontSize: "12px", color: "#888" }}>
                                (você)
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap"
                            }}
                          >
                            <button
                              onClick={() => setBolaCheiaId(p.id)}
                              disabled={isSelf || voteLocked}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "none",
                                cursor: isSelf || voteLocked ? "not-allowed" : "pointer",
                                fontWeight: "bold",
                                background: isCheia ? "#28a745" : "#e9ecef",
                                color: isCheia ? "white" : "#333",
                                fontSize: "13px",
                                opacity: isSelf || voteLocked ? 0.6 : 1
                              }}
                            >
                              ⚽ Cheia
                            </button>

                            <button
                              onClick={() => setBolaMurchaId(p.id)}
                              disabled={isSelf || voteLocked}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "none",
                                cursor: isSelf || voteLocked ? "not-allowed" : "pointer",
                                fontWeight: "bold",
                                background: isMurcha ? "#dc3545" : "#e9ecef",
                                color: isMurcha ? "white" : "#333",
                                fontSize: "13px",
                                opacity: isSelf || voteLocked ? 0.6 : 1
                              }}
                            >
                              🎈 Murcha
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isVotingOpen && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "16px",
                    border: "1px solid #eee",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                  }}
                >
                  {bolaCheiaId && bolaMurchaId && bolaCheiaId === bolaMurchaId && (
                    <div
                      style={{
                        background: "#fff3cd",
                        color: "#856404",
                        border: "1px solid #ffeeba",
                        borderRadius: "8px",
                        padding: "10px",
                        fontSize: "14px",
                        marginBottom: "12px"
                      }}
                    >
                      ⚠️ O mesmo jogador não pode ser bola cheia e bola murcha.
                    </div>
                  )}

                  <button
                    onClick={handleSaveVote}
                    disabled={!canVote || loadingVote}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: canVote && !loadingVote ? "pointer" : "not-allowed",
                      fontWeight: "bold",
                      fontSize: "15px",
                      background: canVote && !loadingVote ? "#007bff" : "#ced4da",
                      color: canVote && !loadingVote ? "white" : "#6c757d"
                    }}
                  >
                    {loadingVote ? "Salvando..." : "💾 Salvar votação"}
                  </button>
                </div>
              )}
            </>
          )}

          {isVotingFinished && selectedMatch?.is_drawn && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid #eee",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
              }}
            >
              <h4 style={{ marginTop: 0, marginBottom: "14px", color: "#333" }}>
                🏁 Resultado final da votação
              </h4>

              {loadingSummary ? (
                <div style={{ color: "#777" }}>Carregando resultado...</div>
              ) : !voteSummary || voteSummary.totalVotes === 0 ? (
                <div style={{ color: "#777" }}>Nenhum voto registrado para esta partida.</div>
              ) : (
                <>
                  <div
                    style={{
                      background: "#f8f9fa",
                      border: "1px solid #e9ecef",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      marginBottom: "16px",
                      fontSize: "14px",
                      color: "#444"
                    }}
                  >
                    Total de votos registrados: <strong>{voteSummary.totalVotes}</strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div
                      style={{
                        background: "#f8fff9",
                        border: "1px solid #d4edda",
                        borderRadius: "10px",
                        padding: "12px"
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: "#155724", marginBottom: "8px" }}>
                        ⚽ Bola cheia
                      </div>

                      {voteSummary.vencedoresCheia.length === 0 ? (
                        <div style={{ color: "#555" }}>Nenhum voto.</div>
                      ) : voteSummary.vencedoresCheia.length === 1 ? (
                        <div style={{ color: "#333", marginBottom: "25px" }}>
                          {/*<strong>Vencedor:</strong>*/} 
                          <strong>{formatPlayerLine(voteSummary.vencedoresCheia[0])} </strong>
                           {/*{" "}—{" "} <strong>{voteSummary.vencedoresCheia[0].votes}</strong> voto(s) */}
                        </div>
                      ) : (
                        <div style={{ color: "#333", marginBottom: "10px" }}>
                          <strong>Empate:</strong>{" "}
                          {voteSummary.vencedoresCheia
                            .map((p) => `${p.name} (${p.votes})`)
                            .join(" • ")}
                        </div>
                      )}

                      {voteSummary.cheiaRanking.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {voteSummary.cheiaRanking.map((p, index) => (
                            <div key={p.id} style={{ marginLeft: "5px", textAlign: "left", fontSize: "11px", color: "#444" }}>
                              <strong>{index + 1}.</strong> {formatPlayerLine(p)} — {p.votes} voto(s)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        background: "#fff8f8",
                        border: "1px solid #f5c6cb",
                        borderRadius: "10px",
                        padding: "12px"
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: "#721c24", marginBottom: "8px" }}>
                        🎈 Bola murcha
                      </div>

                      {voteSummary.vencedoresMurcha.length === 0 ? (
                        <div style={{ color: "#555" }}>Nenhum voto.</div>
                      ) : voteSummary.vencedoresMurcha.length === 1 ? (
                        <div style={{ color: "#333", marginBottom: "25px" }}>
                          {/*<strong>Vencedor:</strong>*/} 
                          <strong>{formatPlayerLine(voteSummary.vencedoresMurcha[0])} </strong>
                          {/*—{" "} <strong>{voteSummary.vencedoresMurcha[0].votes}</strong> voto(s)*/}
                        </div>
                      ) : (
                        <div style={{ color: "#333", marginBottom: "10px" }}>
                          <strong>Empate:</strong>{" "}
                          {voteSummary.vencedoresMurcha
                            .map((p) => `${p.name} (${p.votes})`)
                            .join(" • ")}
                        </div>
                      )}

                      {voteSummary.murchaRanking.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {voteSummary.murchaRanking.map((p, index) => (
                            <div key={p.id} style={{marginLeft: "5px", textAlign: "left", fontSize: "11px", color: "#444" }}>
                              <strong>{index + 1}.</strong> {formatPlayerLine(p)} — {p.votes} voto(s)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
