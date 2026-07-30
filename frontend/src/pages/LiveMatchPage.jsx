import React, { useState, useEffect } from "react";
import { useGroup } from "../contexts/GroupContext";
import { supabase } from "../supabaseClient";

export default function LiveMatchPage({ user, onNavigate }) {
  const { activeGroup } = useGroup();

  // === ESTADOS DA PARTIDA E JOGADORES ===
  const [partida, setPartida] = useState(null);
  const [jogadores, setJogadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroTela, setErroTela] = useState(null);

  // === ESTADO DOS EVENTOS (GOLS) VINDO DO BANCO DE DADOS ===
  const [eventos, setEventos] = useState([]);

  // === ESTADOS DO MODAL DE REGISTRO DE GOL ===
  const [modalOpen, setModalOpen] = useState(false);
  const [artilheiro, setArtilheiro] = useState(null);
  const [assistente, setAssistente] = useState("solo");
  const [golContra, setGolContra] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // 1. CARREGAR PARTIDA, JOGADORES E EVENTOS DO BANCO
  useEffect(() => {
    const carregarDadosPartida = async () => {
      if (!activeGroup) return;
      setLoading(true);
      setErroTela(null);

      const dataHoje = new Date().toISOString().split("T")[0];

      try {
        // A) Busca a partida sorteada de hoje
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .eq("id_grupo", activeGroup.id_grupo)
          .eq("date", dataHoje)
          .eq("is_drawn", true)
          .maybeSingle();

        if (matchError) throw matchError;
        if (!matchData) {
          setErroTela("⚠️ Nenhuma partida sorteada foi encontrada para hoje.");
          setLoading(false);
          return;
        }

        // 👉 TRAVA DE SEGURANÇA: Impede reabrir se o placar oficial já tiver sido gravado
        const temGolsGravados =
          (matchData.score_a || 0) > 0 ||
          (matchData.score_b || 0) > 0 ||
          (matchData.score_c || 0) > 0;

        if (temGolsGravados) {
          alert(
            "🔒 Esta súmula já foi finalizada e o placar oficial foi gravado! Não é possível reabrir para evitar sobrescrever estatísticas."
          );
          onNavigate("home");
          return;
        }

        setPartida(matchData);

        // B) Busca jogadores escalados em match_player
        const { data: escData, error: escError } = await supabase
          .from("match_player")
          .select("player_id, team, shirt_number, status")
          .eq("match_id", matchData.id);

        if (escError) throw escError;

        const listaEscalados = escData || [];

        // C) Mapeamento seguro de nomes dos jogadores na tabela players
        const ids = listaEscalados.map((j) => j.player_id).filter(Boolean);
        let mapaNomes = {};

        if (ids.length > 0) {
          const { data: playersData } = await supabase
            .from("players")
            .select("id, name")
            .in("id", ids);

          (playersData || []).forEach((p) => {
            mapaNomes[p.id] = p.name;
          });
        }

        const confirmados = listaEscalados
          .filter((j) => j.status?.toLowerCase() === "confirmado" && j.team)
          .map((j) => ({
            player_id: j.player_id,
            nome: mapaNomes[j.player_id] || `Jogador #${j.player_id}`,
            camisa: j.shirt_number || "--",
            team: String(j.team || "").toLowerCase().trim(),
          }));

        setJogadores(confirmados);

        // D) Busca a timeline de gols em match_events (Compartilhado entre todos os celulares)
        const { data: evData, error: evError } = await supabase
          .from("match_events")
          .select("*")
          .eq("match_id", matchData.id)
          .order("created_at", { ascending: false });

        if (evError) throw evError;

        // Monta os eventos relacionando com os dados dos jogadores confirmados
        const eventosFormatados = (evData || []).map((ev) => {
          const art = confirmados.find((j) => j.player_id === ev.scorer_id) || {
            player_id: ev.scorer_id,
            nome: `Jogador #${ev.scorer_id}`,
            camisa: "--",
          };
          const ass = ev.assist_id
            ? confirmados.find((j) => j.player_id === ev.assist_id) || {
                player_id: ev.assist_id,
                nome: `Jogador #${ev.assist_id}`,
              }
            : null;

          return {
            id: ev.id,
            hora: new Date(ev.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            artilheiro: art,
            assistente: ass,
            golContra: ev.is_own_goal,
            teamLetter: ev.team_letter,
          };
        });

        setEventos(eventosFormatados);
      } catch (error) {
        console.error("Erro ao carregar partida ao vivo:", error);
        setErroTela("❌ Ocorreu um erro ao buscar os dados da partida.");
      } finally {
        setLoading(false);
      }
    };

    carregarDadosPartida();
  }, [activeGroup, onNavigate]);

  // === CÁLCULO DINÂMICO DO PLACAR (BASEADO NOS EVENTOS DO BANCO) ===
  const calcularPlacar = () => {
    const placar = { a: 0, b: 0, c: 0 };
    eventos.forEach((ev) => {
      const teamKey = ev.teamLetter || "a";
      if (placar[teamKey] !== undefined) {
        placar[teamKey] += 1;
      }
    });
    return placar;
  };

  const placarAtual = calcularPlacar();

  const getTeamLetter = (teamString) => {
    if (!teamString) return "a";
    const t = String(teamString).toLowerCase().trim();
    if (t === "a" || t === "time a") return "a";
    if (t === "b" || t === "time b") return "b";
    if (t === "c" || t === "time c") return "c";
    return "a";
  };

  const getNomeTime = (teamLetter) => {
    if (!partida) return "Time";
    if (teamLetter === "a") return partida.team_a_name || "Time A";
    if (teamLetter === "b") return partida.team_b_name || "Time B";
    if (teamLetter === "c") return partida.team_c_name || "Time C";
    return "Time";
  };

  // === INSERIR NOVO GOL NA TABELA match_events (COM BLINDAGEM DE TIPOS) ===
  const handleSalvarGol = async () => {
    if (!artilheiro || !partida) return;

    let teamLetter = getTeamLetter(artilheiro.team);
    if (golContra) {
      teamLetter = teamLetter === "a" ? "b" : "a";
    }

    try {
      // 👉 Garantimos que IDs sejam números (Number) e a letra tenha 1 caractere
      const novoRegistro = {
        match_id: Number(partida.id),
        scorer_id: Number(artilheiro.player_id),
        assist_id: (assistente === "solo" || !assistente) ? null : Number(assistente.player_id),
        is_own_goal: Boolean(golContra),
        team_letter: String(teamLetter).charAt(0).toLowerCase(),
        created_by: user?.player_id ? Number(user.player_id) : null,
      };

      const { data: evInserido, error } = await supabase
        .from("match_events")
        .insert([novoRegistro])
        .select()
        .single();

      if (error) {
        console.error("Detalhes do erro Supabase:", error);
        throw error;
      }

      // Adiciona na hora ao topo da tela sem precisar recarregar a página
      const eventoVisual = {
        id: evInserido.id,
        hora: new Date(evInserido.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        artilheiro: artilheiro,
        assistente: assistente === "solo" ? null : assistente,
        golContra: golContra,
        teamLetter: teamLetter,
      };

      setEventos([eventoVisual, ...eventos]);
      setModalOpen(false);
      setArtilheiro(null);
      setAssistente("solo");
      setGolContra(false);
    } catch (error) {
      console.error("Erro ao gravar evento de gol:", error);
      // 👉 Alerta explicativo mostrando a mensagem exata do Postgres em caso de falha
      const msgErro = error?.message || error?.details || JSON.stringify(error);
      alert(`❌ Erro ao salvar gol: ${msgErro}`);
    }
  };

  // === REMOVER GOL DA TABELA match_events (DESFAZER ERRO) ===
  const handleRemoverEvento = async (idEvento) => {
    if (!window.confirm("🗑️ Deseja remover este gol da súmula oficial?")) return;

    try {
      const { error } = await supabase
        .from("match_events")
        .delete()
        .eq("id", idEvento);

      if (error) throw error;

      setEventos(eventos.filter((ev) => ev.id !== idEvento));
    } catch (error) {
      console.error("Erro ao remover evento:", error);
      alert("❌ Erro ao excluir gol do banco de dados.");
    }
  };

  // === FINALIZAR PARTIDA E GRAVAR PLACAR OFICIAL ===
  const handleFinalizarPartida = async () => {
    if (!partida) return;
    const confirmou = window.confirm(
      "🏁 Encerrar partida e gravar placar oficial na súmula? Esta ação atualizará os gols e assistências definitivas dos jogadores no ranking."
    );
    if (!confirmou) return;

    setSalvando(true);

    try {
      const stats = {};
      jogadores.forEach((j) => {
        stats[j.player_id] = { goals: 0, assists: 0, own_goals: 0 };
      });

      // Consolida todos os gols registrados em match_events
      eventos.forEach((ev) => {
        const idArt = ev.artilheiro?.player_id;
        if (idArt && stats[idArt]) {
          if (ev.golContra) {
            stats[idArt].own_goals += 1;
          } else {
            stats[idArt].goals += 1;
          }
        }
        const idAss = ev.assistente?.player_id;
        if (!ev.golContra && idAss && stats[idAss]) {
          stats[idAss].assists += 1;
        }
      });

      // 1. Atualiza as estatísticas individuais em match_player
      const promises = Object.entries(stats).map(
        async ([playerId, contadores]) => {
          if (
            contadores.goals > 0 ||
            contadores.assists > 0 ||
            contadores.own_goals > 0
          ) {
            return supabase
              .from("match_player")
              .update({
                goals: contadores.goals,
                assists: contadores.assists,
                own_goals: contadores.own_goals,
              })
              .eq("match_id", partida.id)
              .eq("player_id", Number(playerId));
          }
        }
      );

      await Promise.all(promises);

      // 2. Grava o placar final em matches (Isso trava a reabertura automática da súmula!)
      const { error: matchUpdateError } = await supabase
        .from("matches")
        .update({
          score_a: placarAtual.a,
          score_b: placarAtual.b,
          score_c: placarAtual.c,
        })
        .eq("id", partida.id);

      if (matchUpdateError) throw matchUpdateError;

      alert("✅ GOLAÇO! Súmula finalizada e estatísticas oficiais gravadas com sucesso.");
      onNavigate("home");
    } catch (error) {
      console.error("Erro ao gravar súmula:", error);
      alert("❌ Ocorreu um erro ao salvar a súmula no banco de dados.");
    } finally {
      setSalvando(false);
    }
  };

  const timeA = jogadores.filter((j) => getTeamLetter(j.team) === "a");
  const timeB = jogadores.filter((j) => getTeamLetter(j.team) === "b");
  const timeC = jogadores.filter((j) => getTeamLetter(j.team) === "c");

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "50px",
          color: "#666",
          fontFamily: "Arial, sans-serif",
        }}
      >
        ⚽ Abrindo Súmula de Jogo...
      </div>
    );
  }

  if (erroTela) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "15px" }}
        >
          {erroTela}
        </div>
        <button
          onClick={() => onNavigate("home")}
          style={{
            background: "#007bff",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ⬅ Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "15px",
        maxWidth: "500px",
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Botão de Voltar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <button
          onClick={() => onNavigate("home")}
          style={{
            background: "#f1f3f5",
            border: "none",
            padding: "8px 14px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            color: "#495057",
          }}
        >
          ⬅ Voltar ao Início
        </button>
        <span
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            color: "#dc3545",
            alignSelf: "center",
          }}
        >
          🔴 AO VIVO
        </span>
      </div>

      {/* BLOCO 1: PLACAR GERAL EM TEMPO REAL */}
      <div
        style={{
          background: "#1e293b",
          color: "#fff",
          padding: "20px 10px",
          borderRadius: "16px",
          textAlign: "center",
          boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#94a3b8",
            marginBottom: "12px",
            fontWeight: "bold",
          }}
        >
          Placar em Tempo Real
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: "12px", fontWeight: "bold", color: "#cbd5e1" }}
            >
              {getNomeTime("a")}
            </div>
            <div
              style={{ fontSize: "36px", fontWeight: "900", color: "#38bdf8" }}
            >
              {placarAtual.a}
            </div>
          </div>

          <div
            style={{ fontSize: "20px", fontWeight: "bold", color: "#64748b" }}
          >
            X
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: "12px", fontWeight: "bold", color: "#cbd5e1" }}
            >
              {getNomeTime("b")}
            </div>
            <div
              style={{ fontSize: "36px", fontWeight: "900", color: "#f87171" }}
            >
              {placarAtual.b}
            </div>
          </div>

          {partida?.team_c_name && (
            <>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#64748b",
                }}
              >
                X
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#cbd5e1",
                  }}
                >
                  {getNomeTime("c")}
                </div>
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: "900",
                    color: "#4ade80",
                  }}
                >
                  {placarAtual.c}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BLOCO 2: BOTÃO GIGANTE DE REGISTRO DE GOL */}
      <button
        onClick={() => setModalOpen(true)}
        style={{
          width: "100%",
          padding: "18px",
          background: "#16a34a",
          color: "white",
          border: "none",
          borderRadius: "14px",
          fontSize: "18px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
          marginBottom: "25px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
        }}
      >
        <span>⚽</span> + REGISTRAR NOVO GOL
      </button>

      {/* BLOCO 3: TIMELINE / HISTÓRICO DA PARTIDA */}
      <div style={{ marginBottom: "30px", textAlign: "left" }}>
        <h3
          style={{
            fontSize: "14px",
            color: "#475569",
            marginBottom: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          📋 Histórico da Partida
        </h3>

        {eventos.length === 0 ? (
          <div
            style={{
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              padding: "25px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            Nenhum gol registrado na partida ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {eventos.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#64748b",
                      background: "#f1f5f9",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {ev.hora}
                  </span>

                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#1e293b",
                      }}
                    >
                      ⚽ {ev.artilheiro?.nome}{" "}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "normal",
                          color: "#64748b",
                        }}
                      >
                        (Camisa {ev.artilheiro?.camisa})
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "11px",
                        color: ev.golContra ? "#dc3545" : "#64748b",
                        marginTop: "2px",
                      }}
                    >
                      {ev.golContra
                        ? "⚠️ Gol Contra"
                        : ev.assistente
                        ? `👟 Assistência: ${ev.assistente.nome}`
                        : "⚡ Gol Solo"}
                    </div>
                  </div>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background:
                        ev.teamLetter === "a"
                          ? "#e0f2fe"
                          : ev.teamLetter === "b"
                          ? "#fee2e2"
                          : "#dcfce7",
                      color:
                        ev.teamLetter === "a"
                          ? "#0369a1"
                          : ev.teamLetter === "b"
                          ? "#b91c1c"
                          : "#15803d",
                    }}
                  >
                    {getNomeTime(ev.teamLetter)}
                  </span>
                  <button
                    onClick={() => handleRemoverEvento(ev.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      opacity: 0.6,
                    }}
                    title="Remover este gol"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BLOCO 4: BOTÃO DE ENCERRAMENTO E GRAVAÇÃO */}
      <button
        onClick={handleFinalizarPartida}
        disabled={salvando}
        style={{
          width: "100%",
          padding: "16px",
          background: salvando ? "#cbd5e1" : "#ea580c",
          color: "white",
          border: "none",
          borderRadius: "12px",
          fontSize: "15px",
          fontWeight: "bold",
          cursor: salvando ? "not-allowed" : "pointer",
          boxShadow: "0 4px 10px rgba(234, 88, 12, 0.2)",
        }}
      >
        {salvando
          ? "Gravando Súmula..."
          : "🏁 FINALIZAR PARTIDA E GRAVAR SÚMULA"}
      </button>

      {/* MODAL / POPUP DE REGISTRO DE GOL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            padding: "15px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "450px",
              borderRadius: "16px",
              padding: "20px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>
                ⚽ Quem fez o gol?
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setArtilheiro(null);
                  setAssistente("solo");
                  setGolContra(false);
                }}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                marginBottom: "20px",
              }}
            >
              {timeA.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#0369a1",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    {getNomeTime("a")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    {timeA.map((jog) => (
                      <button
                        key={jog.player_id}
                        onClick={() => {
                          setArtilheiro(jog);
                          setAssistente("solo");
                          setGolContra(false);
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: "8px",
                          border:
                            artilheiro?.player_id === jog.player_id
                              ? "2px solid #0284c7"
                              : "1px solid #e2e8f0",
                          background:
                            artilheiro?.player_id === jog.player_id
                              ? "#e0f2fe"
                              : "#fff",
                          fontWeight: "bold",
                          fontSize: "13px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        #{jog.camisa} {jog.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {timeB.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#b91c1c",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    {getNomeTime("b")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    {timeB.map((jog) => (
                      <button
                        key={jog.player_id}
                        onClick={() => {
                          setArtilheiro(jog);
                          setAssistente("solo");
                          setGolContra(false);
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: "8px",
                          border:
                            artilheiro?.player_id === jog.player_id
                              ? "2px solid #dc2626"
                              : "1px solid #e2e8f0",
                          background:
                            artilheiro?.player_id === jog.player_id
                              ? "#fee2e2"
                              : "#fff",
                          fontWeight: "bold",
                          fontSize: "13px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        #{jog.camisa} {jog.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {timeC.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: "#15803d",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    {getNomeTime("c")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    {timeC.map((jog) => (
                      <button
                        key={jog.player_id}
                        onClick={() => {
                          setArtilheiro(jog);
                          setAssistente("solo");
                          setGolContra(false);
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: "8px",
                          border:
                            artilheiro?.player_id === jog.player_id
                              ? "2px solid #16a34a"
                              : "1px solid #e2e8f0",
                          background:
                            artilheiro?.player_id === jog.player_id
                              ? "#dcfce7"
                              : "#fff",
                          fontWeight: "bold",
                          fontSize: "13px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        #{jog.camisa} {jog.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {artilheiro && (
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "15px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: "bold",
                      color: "#334155",
                    }}
                  >
                    👟 Quem deu a assistência?
                  </label>
                  <button
                    onClick={() => {
                      setGolContra(!golContra);
                      setAssistente("solo");
                    }}
                    style={{
                      background: golContra ? "#dc3545" : "#f1f5f9",
                      color: golContra ? "#fff" : "#64748b",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    ⚠️ Gol Contra
                  </button>
                </div>

                {!golContra ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      onClick={() => setAssistente("solo")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "20px",
                        border:
                          assistente === "solo"
                            ? "2px solid #007bff"
                            : "1px solid #cbd5e1",
                        background:
                          assistente === "solo" ? "#eef2ff" : "#fff",
                        fontSize: "12px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Gol Solo / Sem Assist.
                    </button>

                    {jogadores
                      .filter(
                        (j) =>
                          getTeamLetter(j.team) ===
                            getTeamLetter(artilheiro.team) &&
                          j.player_id !== artilheiro.player_id
                      )
                      .map((parceiro) => (
                        <button
                          key={parceiro.player_id}
                          onClick={() => setAssistente(parceiro)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "20px",
                            border:
                              assistente?.player_id === parceiro.player_id
                                ? "2px solid #007bff"
                                : "1px solid #cbd5e1",
                            background:
                              assistente?.player_id === parceiro.player_id
                                ? "#eef2ff"
                                : "#fff",
                            fontSize: "12px",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          #{parceiro.camisa} {parceiro.nome}
                        </button>
                      ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#dc3545",
                      fontStyle: "italic",
                    }}
                  >
                    * Ponto será computado para o time adversário.
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSalvarGol}
              disabled={!artilheiro}
              style={{
                width: "100%",
                padding: "14px",
                background: !artilheiro ? "#cbd5e1" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: !artilheiro ? "not-allowed" : "pointer",
              }}
            >
              ✔ Confirmar Gol
            </button>
          </div>
        </div>
      )}
    </div>
  );
}