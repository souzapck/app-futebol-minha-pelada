import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function TeamsPage({ user }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [goals, setGoals] = useState({});
  const [ownGoals, setOwnGoals] = useState({});
  const [shirtMap, setShirtMap] = useState({});
  const [confirmedList, setConfirmedList] = useState([]);

  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [playerToReplace, setPlayerToReplace] = useState(null);
  const [replacementOptions, setReplacementOptions] = useState([]);
  const [selectedReplacementId, setSelectedReplacementId] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [targetTeam, setTargetTeam] = useState(null);

  const [actionMenuPlayerId, setActionMenuPlayerId] = useState(null);

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setActionMenuPlayerId(null);
    };

    if (actionMenuPlayerId !== null) {
      window.addEventListener("click", handleClickOutside);
    }

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [actionMenuPlayerId]);

  const buildPlayerView = (player, matchItem) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    rating: player.rating,
    shirt_number: matchItem?.shirt_number ?? player.shirt_number ?? null,
    fixed_shirt_number: player.shirt_number ?? null,
    phone: player.phone,
    status: matchItem?.status ?? null,
    team: matchItem?.team ?? null,
    goals: matchItem?.goals || 0,
    own_goals: matchItem?.own_goals || 0,
    post_draw_action: matchItem?.post_draw_action ?? null,
    replaced_by_player_id: matchItem?.replaced_by_player_id ?? null,
    replaced_player_id: matchItem?.replaced_player_id ?? null
  });

  const handleShirtChange = (playerId, value) => {
    const player =
      players.find((p) => p.id === playerId) ||
      teamA.find((p) => p.id === playerId) ||
      teamB.find((p) => p.id === playerId);

    if (player?.fixed_shirt_number) return;

    const numberValue =
      value === "" ? "" : Math.max(0, Math.min(99, parseInt(value) || 0));

    setShirtMap((prev) => ({
      ...prev,
      [playerId]: numberValue
    }));

    setTeamA((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? { ...p, shirt_number: numberValue === "" ? null : numberValue }
          : p
      )
    );

    setTeamB((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? { ...p, shirt_number: numberValue === "" ? null : numberValue }
          : p
      )
    );
  };

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
      .eq("match_id", match.id)
      .order("id", { ascending: true });

    if (mpError) {
      console.error("Erro ao carregar match_player:", mpError);
      return;
    }

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("is_hidden", false);

    if (playersError) {
      console.error("Erro ao carregar players:", playersError);
      return;
    }

    setAllPlayers(playersData || []);

    const confirmedOriginals = (matchPlayersData || [])
      .filter(
        (item) => String(item.status || "").trim().toLowerCase() === "confirmado"
      )
      .map((item) => {
        const player = (playersData || []).find(
          (p) => Number(p.id) === Number(item.player_id)
        );
        if (!player) return null;
        return buildPlayerView(player, item);
      })
      .filter(Boolean);

    setPlayers(confirmedOriginals);

    const listaConfirmados = confirmedOriginals.map((p, index) => ({
      ordem: index + 1,
      position: p.position,
      name: p.name
    }));
    setConfirmedList(listaConfirmados);

    const playersInTeams = (matchPlayersData || [])
      .filter((item) => item.team === "A" || item.team === "B")
      .map((item) => {
        const player = (playersData || []).find(
          (p) => Number(p.id) === Number(item.player_id)
        );
        if (!player) return null;
        return buildPlayerView(player, item);
      })
      .filter(Boolean);

    const camisaMap = {};
    playersInTeams.forEach((p) => {
      camisaMap[p.id] = p.shirt_number ?? "";
    });
    confirmedOriginals.forEach((p) => {
      if (camisaMap[p.id] === undefined) camisaMap[p.id] = p.shirt_number ?? "";
    });
    setShirtMap(camisaMap);

    if (match.is_drawn) {
      setTeamA(playersInTeams.filter((p) => p.team === "A"));
      setTeamB(playersInTeams.filter((p) => p.team === "B"));
      setScoreA(match.score_a || 0);
      setScoreB(match.score_b || 0);

      const goalsMap = {};
      const ownGoalsMap = {};

      playersInTeams.forEach((p) => {
        goalsMap[p.id] = p.goals || 0;
        ownGoalsMap[p.id] = p.own_goals || 0;
      });

      setGoals(goalsMap);
      setOwnGoals(ownGoalsMap);
    } else {
      setTeamA([]);
      setTeamB([]);
      setScoreA(0);
      setScoreB(0);
      setGoals({});
      setOwnGoals({});
    }

    setActionMenuPlayerId(null);
    setReplacementModalOpen(false);
    setPlayerToReplace(null);
    setReplacementOptions([]);
    setSelectedReplacementId("");
    setModalMode(null);
    setTargetTeam(null);
  };

  const sortearTimes = () => {
    if (players.length < 2) {
      alert("Não há jogadores suficientes para sortear os times!");
      return;
    }

    const embaralhar = (lista) => [...lista].sort(() => Math.random() - 0.5);

    const porPosicao = {
      GOL: [],
      ZAG: [],
      LAT: [],
      MEI: [],
      ATA: []
    };

    players.forEach((p) => {
      const pos = porPosicao[p.position] ? p.position : "MEI";
      porPosicao[pos].push(p);
    });

    Object.keys(porPosicao).forEach((pos) => {
      porPosicao[pos] = embaralhar(porPosicao[pos]).sort(
        (a, b) => b.rating - a.rating
      );
    });

    let tA = [];
    let tB = [];
    let forcaA = 0;
    let forcaB = 0;

    const addToTeam = (player, team) => {
      if (team === "A") {
        tA.push(player);
        forcaA += Number(player.rating) || 0;
      } else {
        tB.push(player);
        forcaB += Number(player.rating) || 0;
      }
    };

    const weakerTeam = () => {
      if (tA.length < tB.length) return "A";
      if (tB.length < tA.length) return "B";
      return forcaA <= forcaB ? "A" : "B";
    };

    const distribuirBasePorPosicao = (pos) => {
      const lista = [...porPosicao[pos]];
      if (lista.length === 0) return;

      if (lista.length >= 2) {
        const primeiro = lista.shift();
        const segundo = lista.shift();

        const timePrimeiro = weakerTeam();
        const timeSegundo = timePrimeiro === "A" ? "B" : "A";

        addToTeam(primeiro, timePrimeiro);
        addToTeam(segundo, timeSegundo);
      } else {
        addToTeam(lista.shift(), weakerTeam());
      }

      porPosicao[pos] = lista;
    };

    ["ZAG", "LAT", "MEI", "ATA"].forEach(distribuirBasePorPosicao);

    ["ZAG", "LAT", "MEI", "ATA"].forEach((pos) => {
      porPosicao[pos].forEach((player) => {
        addToTeam(player, weakerTeam());
      });
      porPosicao[pos] = [];
    });

    if (porPosicao.GOL.length > 0) {
      const goleiros = [...porPosicao.GOL].sort((a, b) => b.rating - a.rating);

      if (goleiros.length >= 2) {
        const g1 = goleiros.shift();
        const g2 = goleiros.shift();

        const timeG1 = weakerTeam();
        const timeG2 = timeG1 === "A" ? "B" : "A";

        addToTeam(g1, timeG1);
        addToTeam(g2, timeG2);
      }

      goleiros.forEach((g) => {
        addToTeam(g, weakerTeam());
      });
    }

    const diferenca = Math.abs(forcaA - forcaB);

    if (diferenca > 1.5) {
      const semGoleiroA = tA.filter((p) => p.position !== "GOL");
      const semGoleiroB = tB.filter((p) => p.position !== "GOL");

      let melhorTroca = null;
      let melhorDiferenca = diferenca;

      semGoleiroA.forEach((a) => {
        semGoleiroB.forEach((b) => {
          if (a.position !== b.position) return;

          const novoA = forcaA - a.rating + b.rating;
          const novoB = forcaB - b.rating + a.rating;
          const novaDif = Math.abs(novoA - novoB);

          if (novaDif < melhorDiferenca) {
            melhorDiferenca = novaDif;
            melhorTroca = { a, b };
          }
        });
      });

      if (melhorTroca) {
        tA = tA.map((p) => (p.id === melhorTroca.a.id ? melhorTroca.b : p));
        tB = tB.map((p) => (p.id === melhorTroca.b.id ? melhorTroca.a : p));
      }
    }

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
      const updatesA = teamA.map((p) =>
        supabase
          .from("match_player")
          .update({
            team: "A",
            shirt_number:
              shirtMap[p.id] === "" || shirtMap[p.id] === undefined
                ? null
                : Number(shirtMap[p.id])
          })
          .eq("match_id", selectedMatch.id)
          .eq("player_id", p.id)
      );

      const updatesB = teamB.map((p) =>
        supabase
          .from("match_player")
          .update({
            team: "B",
            shirt_number:
              shirtMap[p.id] === "" || shirtMap[p.id] === undefined
                ? null
                : Number(shirtMap[p.id])
          })
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

  const getEligibleNonConfirmedPlayers = async (excludePlayerId = null) => {
    const { data, error } = await supabase
      .from("match_player")
      .select("*")
      .eq("match_id", selectedMatch.id);

    if (error) {
      console.error("Erro ao carregar opções:", error);
      alert("❌ Erro ao carregar opções.");
      return [];
    }

    const statusOrder = {
      null_status: 1,
      duvida: 2,
      nao_vai: 3
    };

    return (data || [])
      .filter((item) =>
        excludePlayerId !== null
          ? Number(item.player_id) !== Number(excludePlayerId)
          : true
      )
      .filter((item) => !item.team)
      .filter((item) => String(item.status || "").trim().toLowerCase() !== "confirmado")
      .map((item) => {
        const playerData = allPlayers.find(
          (p) => Number(p.id) === Number(item.player_id)
        );

        if (!playerData) return null;

        const normalizedStatus = item.status
          ? String(item.status).trim().toLowerCase()
          : "null_status";

        return {
          id: playerData.id,
          name: playerData.name,
          position: playerData.position,
          rating: playerData.rating,
          shirt_number: item.shirt_number ?? playerData.shirt_number ?? null,
          fixed_shirt_number: playerData.shirt_number ?? null,
          status: item.status,
          post_draw_action: item.post_draw_action ?? null,
          sortStatus: statusOrder[normalizedStatus] || 99
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.sortStatus !== b.sortStatus) return a.sortStatus - b.sortStatus;
        return a.name.localeCompare(b.name);
      });
  };

  const abrirSubstituicao = async (player) => {
    if (!selectedMatch || !selectedMatch.is_drawn) return;

    const elegiveis = await getEligibleNonConfirmedPlayers(player.id);

    setModalMode("replace");
    setTargetTeam(player.team);
    setPlayerToReplace(player);
    setReplacementOptions(elegiveis);
    setSelectedReplacementId("");
    setReplacementModalOpen(true);
    setActionMenuPlayerId(null);
  };

  const abrirInclusao = async (team) => {
    if (!selectedMatch || !selectedMatch.is_drawn) return;

    const elegiveis = await getEligibleNonConfirmedPlayers();

    setModalMode("include");
    setTargetTeam(team);
    setPlayerToReplace(null);
    setReplacementOptions(elegiveis);
    setSelectedReplacementId("");
    setReplacementModalOpen(true);
    setActionMenuPlayerId(null);
  };

  const cancelarSubstituicao = () => {
    setReplacementModalOpen(false);
    setPlayerToReplace(null);
    setReplacementOptions([]);
    setSelectedReplacementId("");
    setModalMode(null);
    setTargetTeam(null);
  };

  const confirmarSubstituicao = async () => {
    if (!playerToReplace || !selectedReplacementId || !selectedMatch) {
      alert("⚠️ Selecione um jogador para substituir.");
      return;
    }

    try {
      const replacementId = Number(selectedReplacementId);
      const substituto = replacementOptions.find(
        (item) => Number(item.id) === Number(replacementId)
      );

      const teamDestino = playerToReplace.team;

      const camisaFinal =
        substituto?.fixed_shirt_number !== null &&
        substituto?.fixed_shirt_number !== undefined &&
        substituto?.fixed_shirt_number !== ""
          ? substituto.fixed_shirt_number
          : null;

      const { error: oldPlayerError } = await supabase
        .from("match_player")
        .update({
          team: null,
          goals: 0,
          own_goals: 0,
          shirt_number: null,
          post_draw_action: "substituido",
          replaced_by_player_id: replacementId
        })
        .eq("match_id", selectedMatch.id)
        .eq("player_id", playerToReplace.id);

      if (oldPlayerError) {
        console.error(oldPlayerError);
        alert("❌ Erro ao remover o jogador atual do time.");
        return;
      }

      const { error: newPlayerError } = await supabase
        .from("match_player")
        .update({
          team: teamDestino,
          goals: 0,
          own_goals: 0,
          shirt_number: camisaFinal,
          post_draw_action: "incluido",
          replaced_player_id: playerToReplace.id
        })
        .eq("match_id", selectedMatch.id)
        .eq("player_id", replacementId);

      if (newPlayerError) {
        console.error(newPlayerError);
        alert("❌ Erro ao incluir o substituto no time.");
        return;
      }

      alert("✅ Substituição realizada com sucesso!");
      cancelarSubstituicao();
      await loadMatchData(selectedMatch);
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao confirmar substituição.");
    }
  };

  const confirmarInclusao = async () => {
    if (!selectedReplacementId || !selectedMatch || !targetTeam) {
      alert("⚠️ Selecione um jogador para incluir.");
      return;
    }

    try {
      const replacementId = Number(selectedReplacementId);
      const jogador = replacementOptions.find(
        (item) => Number(item.id) === Number(replacementId)
      );

      const camisaFinal =
        jogador?.fixed_shirt_number !== null &&
        jogador?.fixed_shirt_number !== undefined &&
        jogador?.fixed_shirt_number !== ""
          ? jogador.fixed_shirt_number
          : null;

      const { error } = await supabase
        .from("match_player")
        .update({
          team: targetTeam,
          goals: 0,
          own_goals: 0,
          shirt_number: camisaFinal,
          post_draw_action: "incluido",
          replaced_player_id: null
        })
        .eq("match_id", selectedMatch.id)
        .eq("player_id", replacementId);

      if (error) {
        console.error(error);
        alert("❌ Erro ao incluir jogador no time.");
        return;
      }

      alert("✅ Jogador incluído com sucesso!");
      cancelarSubstituicao();
      await loadMatchData(selectedMatch);
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao confirmar inclusão.");
    }
  };

  const excluirDaEscalacao = async (player) => {
    if (!selectedMatch) return;

    const confirm = window.confirm(`🗑️ Excluir ${player.name} da escalação?`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("match_player")
        .update({
          team: null,
          goals: 0,
          own_goals: 0,
          shirt_number: null,
          post_draw_action: "excluido",
          replaced_by_player_id: null
        })
        .eq("match_id", selectedMatch.id)
        .eq("player_id", player.id);

      if (error) {
        console.error(error);
        alert("❌ Erro ao excluir jogador da escalação.");
        return;
      }

      setActionMenuPlayerId(null);
      alert("✅ Jogador excluído da escalação!");
      await loadMatchData(selectedMatch);
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao excluir jogador.");
    }
  };

  const desfazerSorteio = async () => {
    const confirm = window.confirm(
      "⚠️ Deseja REABRIR esta partida? Isso apagará os placares e times gravados."
    );
    if (!confirm) return;

    try {
      const { error: mpError } = await supabase
        .from("match_player")
        .update({
          team: null,
          goals: 0,
          own_goals: 0,
          post_draw_action: null,
          replaced_by_player_id: null,
          replaced_player_id: null
        })
        .eq("match_id", selectedMatch.id);

      if (mpError) {
        console.error(mpError);
        alert("❌ Erro ao limpar os dados da partida.");
        return;
      }

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
    setGoals((prev) => ({
      ...prev,
      [playerId]: Math.max(0, parseInt(amount) || 0)
    }));
  };

  const handleOwnGoalChange = (playerId, amount) => {
    setOwnGoals((prev) => ({
      ...prev,
      [playerId]: Math.max(0, parseInt(amount) || 0)
    }));
  };

  const salvarEstatisticas = async () => {
    try {
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

      const playerIds = Array.from(
        new Set([...Object.keys(goals), ...Object.keys(ownGoals)])
      );

      const goalUpdates = playerIds.map((playerId) =>
        supabase
          .from("match_player")
          .update({
            goals: Number(goals[playerId]) || 0,
            own_goals: Number(ownGoals[playerId]) || 0
          })
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

  const calcForca = (time) =>
    time.reduce((soma, p) => soma + p.rating, 0).toFixed(1);

  const formatarJogador = (p) => {
    const num =
      p.shirt_number !== null &&
      p.shirt_number !== undefined &&
      p.shirt_number !== ""
        ? String(p.shirt_number).padStart(2, "0")
        : "--";
    return `${num} - ${p.name} - (${p.position})`;
  };

  const ordenarPorPosicao = (time) => {
    const pesos = { GOL: 1, ZAG: 2, LAT: 3, MEI: 4, ATA: 5 };
    return [...time].sort(
      (a, b) => (pesos[a.position] || 99) - (pesos[b.position] || 99)
    );
  };

  const copiarWhatsApp = () => {
    let texto = `⚽ *JOGO DA QUINTA* (${selectedMatch.date
      .split("-")
      .reverse()
      .join("/")})\n\n`;

    const timeAOrdenado = ordenarPorPosicao(teamA);
    const timeBOrdenado = ordenarPorPosicao(teamB);

    texto += `⚫ *TIME Preto/Rosa* (⭐ ${calcForca(teamA)})\n${timeAOrdenado
      .map((p) => `• ${formatarJogador(p)}`)
      .join("\n")}\n\n`;

    texto += `🔴 *TIME Vermelho/Branco* (⭐ ${calcForca(teamB)})\n${timeBOrdenado
      .map((p) => `• ${formatarJogador(p)}`)
      .join("\n")}\n\n`;

    navigator.clipboard.writeText(texto);
    alert("Copiado para área de transferência, pode colar no WhatsApp!");
  };

  const renderActionMenu = (p) => {
    if (!user?.is_admin || !selectedMatch?.is_drawn) return null;

    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActionMenuPlayerId((prev) => (prev === p.id ? null : p.id));
          }}
          style={{
            borderRadius: "4px",
            border: "1px solid #999",
            backgroundColor: "#ffffff",
            color: "#333",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "11px",
            width: "24px",
            height: "24px",
            lineHeight: "1"
          }}
          title="Opções"
        >
          ☰
        </button>

        {actionMenuPlayerId === p.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "28px",
              right: 0,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "8px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              minWidth: "150px",
              zIndex: 30,
              overflow: "hidden"
            }}
          >
            <button
              onClick={() => abrirSubstituicao(p)}
              style={{
                width: "100%",
                background: "#fff",
                border: "none",
                padding: "10px 12px",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: "bold",
                color: "#333",
                borderBottom: "1px solid #eee"
              }}
            >
              🔁 Substituir
            </button>

            <button
              onClick={() => excluirDaEscalacao(p)}
              style={{
                width: "100%",
                background: "#fff",
                border: "none",
                padding: "10px 12px",
                textAlign: "left",
                cursor: "pointer",
                fontWeight: "bold",
                color: "#dc3545"
              }}
            >
              🗑️ Excluir
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTeamCard = (title, borderColor, team, score, setScore, teamKey) => (
    <div
      style={{
        width: "100%",
        background: "#fff",
        padding: "15px",
        borderRadius: "10px",
        border: `3px solid ${borderColor}`,
        boxShadow: "0 4px 6px rgba(0,0,0,0.06)"
      }}
    >
      <h3
        style={{
          textAlign: "center",
          color: "#000102",
          marginTop: 0,
          marginBottom: "15px",
          fontWeight: "bold",
          fontSize: "16px"
        }}
      >
        {title}{" "}
        <span style={{ fontSize: "10px", color: "#666", fontWeight: "normal" }}>
          (⭐ {calcForca(team)})
        </span>
      </h3>

      {selectedMatch.is_drawn && user?.is_admin && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <button
            onClick={() => abrirInclusao(teamKey)}
            style={{
              background: "#e8f5e9",
              color: "#1b5e20",
              border: "1px solid #c8e6c9",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px"
            }}
          >
            ➕ Incluir jogador
          </button>
        </div>
      )}

      {selectedMatch.is_drawn && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "12px",
            background: "#e9ecef",
            padding: "6px",
            borderRadius: "8px"
          }}
        >
          <label
            style={{
              fontWeight: "bold",
              marginRight: "10px",
              color: "#333",
              fontSize: "14px"
            }}
          >
            Placar:
          </label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            style={{
              width: "50px",
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "bold",
              padding: "4px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              color: "#000",
              backgroundColor: "#fff"
            }}
          />
        </div>
      )}

      {selectedMatch.is_drawn && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            fontSize: "11px",
            fontWeight: "bold",
            color: "#666"
          }}
        >
          <span>Jogador</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{ width: "30px", textAlign: "center" }}>⚽</span>
            <span style={{ width: "30px", textAlign: "center" }}>🥅</span>
            {user?.is_admin && <span style={{ width: "24px", textAlign: "center" }}></span>}
          </div>
        </div>
      )}

      {ordenarPorPosicao(team)
        .filter(Boolean)
        .map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #f1f1f1",
              alignItems: "center",
              fontSize: "15px",
              color: "#333",
              gap: "5px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: "30px",
                  minWidth: "30px",
                  display: "flex",
                  justifyContent: "flex-end",
                  marginRight: "10px"
                }}
              >
                {p.fixed_shirt_number ? (
                  <span
                    style={{
                      width: "30px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "11px",
                      color: "#333",
                      display: "inline-block"
                    }}
                  >
                    {String(p.shirt_number).padStart(2, "0")}
                  </span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={shirtMap?.[p.id] ?? ""}
                    onChange={(e) => handleShirtChange(p.id, e.target.value)}
                    disabled={selectedMatch.is_drawn}
                    style={{
                      width: "40px",
                      padding: "3px",
                      textAlign: "center",
                      borderRadius: "4px",
                      border: "1px solid #999",
                      backgroundColor: "#fff",
                      color: "#000",
                      fontWeight: "bold",
                      fontSize: "11px",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                    placeholder=" "
                  />
                )}
              </div>

              <span
                style={{
                  textAlign: "left",
                  fontSize: "11px",
                  fontWeight: "500",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {`(${p.position}) - ${p.name}`}
              </span>
            </div>

            {selectedMatch.is_drawn && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="number"
                  min="0"
                  value={goals?.[p.id] || 0}
                  onChange={(e) => handleGoalChange(p.id, e.target.value)}
                  style={{
                    width: "30px",
                    padding: "3px",
                    textAlign: "center",
                    borderRadius: "4px",
                    border: "1px solid #999",
                    backgroundColor: "#f8f9fa",
                    color: "#048804",
                    fontWeight: "bold",
                    fontSize: "11px",
                    outline: "none"
                  }}
                  title="Gols"
                />

                <input
                  type="number"
                  min="0"
                  value={ownGoals?.[p.id] || 0}
                  onChange={(e) => handleOwnGoalChange(p.id, e.target.value)}
                  style={{
                    width: "30px",
                    padding: "3px",
                    textAlign: "center",
                    borderRadius: "4px",
                    border: "1px solid #c77d7d",
                    backgroundColor: "#fff5f5",
                    color: "#8b0000",
                    fontWeight: "bold",
                    fontSize: "11px",
                    outline: "none"
                  }}
                  title="Gols contra"
                />

                {renderActionMenu(p)}
              </div>
            )}
          </div>
        ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      <div
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          marginBottom: "20px",
          paddingBottom: "10px"
        }}
      >
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => loadMatchData(m)}
            style={{
              minWidth: "120px",
              padding: "10px",
              borderRadius: "8px",
              cursor: "pointer",
              border:
                selectedMatch?.id === m.id
                  ? "2px solid #007bff"
                  : "1px solid #ddd",
              background: selectedMatch?.id === m.id ? "#e7f1ff" : "#fff",
              color: "#333",
              fontWeight: selectedMatch?.id === m.id ? "bold" : "normal"
            }}
          >
            {m.date.split("-").reverse().join("/")} {m.is_drawn && "🔒"}
          </button>
        ))}
      </div>

      {selectedMatch && (
        <div
          style={{
            minWidth: "300px",
            maxWidth: "570px",
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #dddddd"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}
          >
            <h2 style={{ margin: 0, color: "#333" }}>
              {selectedMatch.is_drawn ? "🔒 Jogo Fechado" : "🎲 Escalação não realizada"}
            </h2>

            {teamA.length > 0 && (
              <button
                onClick={copiarWhatsApp}
                style={{
                  background: "#25D366",
                  color: "white",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  boxShadow: "0 2px 5px rgba(37,211,102,0.3)"
                }}
              >
                📱 WhatsApp
              </button>
            )}
          </div>

          {(teamA.length > 0 || teamB.length > 0) && (
            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                justifyContent: "center",
                marginBottom: "25px"
              }}
            >
              {renderTeamCard("⚫ Time Preto/Rosa", "#0b0b0b", teamA, scoreA, setScoreA, "A")}
              {renderTeamCard("🔴 Time Vermelho/Branco", "#c00707", teamB, scoreB, setScoreB, "B")}
            </div>
          )}

          {user?.is_admin && (
            <>
              {!selectedMatch.is_drawn ? (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexDirection: "column",
                    background: "#fff",
                    padding: "15px",
                    borderRadius: "10px",
                    border: "1px solid #dee2e6"
                  }}
                >
                  {teamA.length === 0 && (
                    <button
                      onClick={sortearTimes}
                      style={{
                        width: "100%",
                        padding: "16px",
                        background: "#007bff",
                        color: "white",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        fontWeight: "bold",
                        boxShadow: "0 4px 6px rgba(0,123,255,0.2)"
                      }}
                    >
                      🎲 Sortear Times Equilibrados
                    </button>
                  )}

                  {teamA.length > 0 && (
                    <>
                      <button
                        onClick={confirmarSorteio}
                        style={{
                          width: "100%",
                          padding: "16px",
                          background: "#28a745",
                          color: "white",
                          borderRadius: "8px",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          boxShadow: "0 4px 6px rgba(40,167,69,0.2)"
                        }}
                      >
                        🔒 Confirmar Sorteio e Travar Jogo
                      </button>

                      <button
                        onClick={sortearTimes}
                        style={{
                          width: "100%",
                          padding: "10px",
                          background: "#f8f9fa",
                          color: "#6c757d",
                          borderRadius: "8px",
                          border: "1px solid #ced4da",
                          cursor: "pointer",
                          fontSize: "14px",
                          marginTop: "5px"
                        }}
                      >
                        🔄 Não gostei, refazer sorteio
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexDirection: "column",
                    background: "#fff",
                    padding: "15px",
                    borderRadius: "10px",
                    border: "1px solid #dee2e6"
                  }}
                >
                  <button
                    onClick={salvarEstatisticas}
                    style={{
                      width: "100%",
                      padding: "16px",
                      background: "#ffc107",
                      color: "#333",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "18px",
                      fontWeight: "bold",
                      boxShadow: "0 4px 6px rgba(255,193,7,0.2)"
                    }}
                  >
                    💾 Salvar Estatísticas
                  </button>

                  {(Number(scoreA) === 0 &&
                    Number(scoreB) === 0 &&
                    Object.values(goals).every((g) => Number(g) === 0) &&
                    Object.values(ownGoals).every((g) => Number(g) === 0)) && (
                    <button
                      onClick={desfazerSorteio}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: "#fff",
                        color: "#dc3545",
                        borderRadius: "8px",
                        border: "2px solid #dc3545",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "bold",
                        marginTop: "10px"
                      }}
                    >
                      ⚠️ Reabrir Jogo (Desfazer Sorteio)
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {!selectedMatch.is_drawn && teamA.length === 0 && confirmedList.length > 0 && (
            <div
              style={{
                marginTop: "15px",
                background: "#f8f9fa",
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                padding: "12px"
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "14px",
                  color: "#333",
                  marginBottom: "8px"
                }}
              >
                ✅ Confirmados para esta partida
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {confirmedList.map((jogador) => (
                  <div
                    key={jogador.ordem}
                    style={{ textAlign: "left", fontSize: "14px", color: "#555" }}
                  >
                    <strong>{jogador.ordem}.</strong> {jogador.position} - {jogador.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {replacementModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#fff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}
          >
            <h3 style={{ marginTop: 0, color: "#333" }}>
              {modalMode === "replace" ? "🔁 Substituir jogador" : "➕ Incluir jogador"}
            </h3>

            {modalMode === "replace" && (
              <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
                Jogador atual: <strong>{playerToReplace?.name}</strong>
              </div>
            )}

            {modalMode === "include" && (
              <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
                Time destino: <strong>{targetTeam === "A" ? "Preto/Rosa" : "Vermelho/Branco"}</strong>
              </div>
            )}

            {replacementOptions.length === 0 ? (
              <div
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "#666",
                  marginBottom: "16px"
                }}
              >
                Nenhum jogador elegível disponível.
              </div>
            ) : (
              <select
                value={selectedReplacementId}
                onChange={(e) => setSelectedReplacementId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  marginBottom: "16px",
                  color: "#000",
                  background: "#fff"
                }}
              >
                <option value="">Selecione o jogador</option>
                {replacementOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.position}) - {j.status ? j.status : "sem resposta"}
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={cancelarSubstituicao}
                style={{
                  padding: "10px 14px",
                  background: "#6c757d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Cancelar
              </button>

              <button
                onClick={modalMode === "replace" ? confirmarSubstituicao : confirmarInclusao}
                disabled={!selectedReplacementId}
                style={{
                  padding: "10px 14px",
                  background: selectedReplacementId ? "#28a745" : "#ced4da",
                  color: selectedReplacementId ? "#fff" : "#6c757d",
                  border: "none",
                  borderRadius: "8px",
                  cursor: selectedReplacementId ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}