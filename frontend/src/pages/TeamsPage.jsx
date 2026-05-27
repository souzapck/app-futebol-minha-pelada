import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext"; 

const DURACAO_T1 = 15 * 60 * 1000; 
const INTERVALO = 1 * 60 * 1000;
const DURACAO_T2 = 10 * 60 * 1000;

const getEmojiForColor = (hex) => {
  if (!hex) return "👕";
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;

  const colors = [
    { emoji: '⚫', r: 0, g: 0, b: 0 },
    { emoji: '⚪', r: 255, g: 255, b: 255 },
    { emoji: '🔴', r: 255, g: 0, b: 0 },
    { emoji: '🔴', r: 139, g: 0, b: 0 }, 
    { emoji: '🔵', r: 0, g: 0, b: 255 },
    { emoji: '🔵', r: 0, g: 191, b: 255 }, 
    { emoji: '🟡', r: 255, g: 255, b: 0 },
    { emoji: '🟢', r: 0, g: 128, b: 0 },
    { emoji: '🟢', r: 0, g: 255, b: 0 }, 
    { emoji: '🟠', r: 255, g: 165, b: 0 },
    { emoji: '🟣', r: 128, g: 0, b: 128 },
    { emoji: '🟤', r: 165, g: 42, b: 42 }
  ];

  let closestEmoji = "👕";
  let minDistance = Infinity;

  colors.forEach(c => {
    const distance = Math.sqrt(Math.pow(c.r - r, 2) + Math.pow(c.g - g, 2) + Math.pow(c.b - b, 2));
    if (distance < minDistance) {
      minDistance = distance;
      closestEmoji = c.emoji;
    }
  });

  return closestEmoji;
};

export default function TeamsPage({ user }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [teamC, setTeamC] = useState([]); 
  
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [scoreC, setScoreC] = useState(0); 
  
  const [goals, setGoals] = useState({});
  const [ownGoals, setOwnGoals] = useState({});
  const [assists, setAssists] = useState({});
  const [shirtMap, setShirtMap] = useState({});
  const [confirmedList, setConfirmedList] = useState([]);

  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [playerToReplace, setPlayerToReplace] = useState(null);
  const [replacementOptions, setReplacementOptions] = useState([]);
  const [selectedReplacementId, setSelectedReplacementId] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [targetTeam, setTargetTeam] = useState(null);

  const [actionMenuPlayerId, setActionMenuPlayerId] = useState(null);

  const { activeGroup, isAdmin } = useGroup();

  const [config, setConfig] = useState({
    cor_a: "#0b0b0b", cor_b: "#c00707", cor_c: "#28a745",
    nome_a: "Time A", nome_b: "Time B", nome_c: "Time C",
    qtd_times: 2, dia_jogo: "QUINTA-FEIRA",
    pt_vitoria_ativo: true, pt_gol_ativo: true, 
    pt_gol_contra_ativo: true, pt_assistencia_ativo: true
  });

  // === LÓGICA DE DETECÇÃO DE HISTÓRICO ===
  const displayCorA = (selectedMatch?.is_drawn && selectedMatch?.team_a_color) ? selectedMatch.team_a_color : config.cor_a;
  const displayCorB = (selectedMatch?.is_drawn && selectedMatch?.team_b_color) ? selectedMatch.team_b_color : config.cor_b;
  const displayCorC = (selectedMatch?.is_drawn && selectedMatch?.team_c_color) ? selectedMatch.team_c_color : config.cor_c;
  
  const displayNomeA = (selectedMatch?.is_drawn && selectedMatch?.team_a_name) ? selectedMatch.team_a_name : config.nome_a;
  const displayNomeB = (selectedMatch?.is_drawn && selectedMatch?.team_b_name) ? selectedMatch.team_b_name : config.nome_b;
  const displayNomeC = (selectedMatch?.is_drawn && selectedMatch?.team_c_name) ? selectedMatch.team_c_name : config.nome_c;

  const isTresTimes = selectedMatch?.is_drawn 
    ? Boolean(selectedMatch.team_c_name && selectedMatch.team_c_name.trim() !== "")
    : Number(config.qtd_times) === 3;                  

  useEffect(() => {
    if (activeGroup) {
      loadGroupConfig();
      loadMatches();
      setSelectedMatch(null);
      setTeamA([]); setTeamB([]); setTeamC([]);
      setScoreA(0); setScoreB(0); setScoreC(0);
      setConfirmedList([]);
    }
  }, [activeGroup]);

  useEffect(() => {
    const handleClickOutside = () => setActionMenuPlayerId(null);
    if (actionMenuPlayerId !== null) window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [actionMenuPlayerId]);

  const loadGroupConfig = async () => {
    try {
      const { data } = await supabase
        .from("grupos_pelada")
        .select("cor_time_a, cor_time_b, cor_time_c, nome_time_a, nome_time_b, nome_time_c, dia_jogo_grupo, qtd_times, pt_vitoria_ativo, pt_gol_ativo, pt_gol_contra_ativo, pt_assistencia_ativo")
        .eq("id_grupo", activeGroup.id_grupo)
        .single();

      if (data) {
        setConfig({
          cor_a: data.cor_time_a || "#0b0b0b",
          cor_b: data.cor_time_b || "#c00707",
          cor_c: data.cor_time_c || "#28a745",
          nome_a: data.nome_time_a || "Time A",
          nome_b: data.nome_time_b || "Time B",
          nome_c: data.nome_time_c || "Time C",
          qtd_times: data.qtd_times || 2,
          dia_jogo: data.dia_jogo_grupo || "QUINTA-FEIRA",
          pt_vitoria_ativo: data.pt_vitoria_ativo !== false,
          pt_gol_ativo: data.pt_gol_ativo !== false,
          pt_gol_contra_ativo: data.pt_gol_contra_ativo !== false,
          pt_assistencia_ativo: data.pt_assistencia_ativo !== false
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do grupo", err);
    }
  };

  const buildPlayerView = (player, matchItem) => ({
    id: player.id, name: player.name, position: player.position, rating: player.rating,
    shirt_number: matchItem?.shirt_number ?? player.shirt_number ?? null,
    fixed_shirt_number: player.shirt_number ?? null, phone: player.phone,
    status: matchItem?.status ?? null, team: matchItem?.team ?? null,
    goals: matchItem?.goals || 0, own_goals: matchItem?.own_goals || 0,
    assists: matchItem?.assists || 0,
    post_draw_action: matchItem?.post_draw_action ?? null,
    replaced_by_player_id: matchItem?.replaced_by_player_id ?? null,
    replaced_player_id: matchItem?.replaced_player_id ?? null
  });

  const handleShirtChange = (playerId, value) => {
    const player = players.find((p) => p.id === playerId) || [...teamA, ...teamB, ...teamC].find((p) => p.id === playerId);
    if (player?.fixed_shirt_number) return;
    const numberValue = value === "" ? "" : Math.max(0, Math.min(99, parseInt(value) || 0));

    setShirtMap((prev) => ({ ...prev, [playerId]: numberValue }));
    setTeamA((prev) => prev.map((p) => p.id === playerId ? { ...p, shirt_number: numberValue === "" ? null : numberValue } : p));
    setTeamB((prev) => prev.map((p) => p.id === playerId ? { ...p, shirt_number: numberValue === "" ? null : numberValue } : p));
    setTeamC((prev) => prev.map((p) => p.id === playerId ? { ...p, shirt_number: numberValue === "" ? null : numberValue } : p));
  };

  const loadMatches = async () => {
    const { data } = await supabase.from("matches").select("*").eq("id_grupo", activeGroup.id_grupo).order("date", { ascending: false });
    setMatches(data || []);
  };

  const loadMatchData = async (match) => {
    setSelectedMatch(match);
    const { data: matchPlayersData } = await supabase.from("match_player").select("*").eq("match_id", match.id).order("id", { ascending: true });
    
    const { data: membrosData } = await supabase
      .from("grupo_membros")
      .select(`
        position, rating, shirt_number, is_spectator, is_hidden,
        players!inner(id, name, phone)
      `)
      .eq("id_grupo", activeGroup.id_grupo)
      .eq("is_hidden", false);

    const playersData = (membrosData || []).map((m) => ({
      id: m.players.id, name: m.players.name, phone: m.players.phone,
      position: m.position, rating: m.rating, shirt_number: m.shirt_number, is_spectator: m.is_spectator
    }));

    setAllPlayers(playersData || []);

    const confirmedOriginals = (matchPlayersData || []).filter((item) => String(item.status || "").trim().toLowerCase() === "confirmado").map((item) => {
      const player = (playersData || []).find((p) => Number(p.id) === Number(item.player_id));
      if (!player) return null;
      return buildPlayerView(player, item);
    }).filter(Boolean);

    setPlayers(confirmedOriginals);
    setConfirmedList(confirmedOriginals.map((p, index) => ({ ordem: index + 1, position: p.position, name: p.name })));

    const playersInTeams = (matchPlayersData || []).filter((item) => ["A", "B", "C"].includes(item.team)).map((item) => {
      const player = (playersData || []).find((p) => Number(p.id) === Number(item.player_id));
      if (!player) return null;
      return buildPlayerView(player, item);
    }).filter(Boolean);

    const camisaMap = {};
    playersInTeams.forEach((p) => { camisaMap[p.id] = p.shirt_number ?? ""; });
    confirmedOriginals.forEach((p) => { if (camisaMap[p.id] === undefined) camisaMap[p.id] = p.shirt_number ?? ""; });
    setShirtMap(camisaMap);

    if (match.is_drawn) {
      setTeamA(playersInTeams.filter((p) => p.team === "A"));
      setTeamB(playersInTeams.filter((p) => p.team === "B"));
      setTeamC(playersInTeams.filter((p) => p.team === "C"));
      
      setScoreA(match.score_a || 0); 
      setScoreB(match.score_b || 0);
      setScoreC(match.score_c || 0);
      
      const goalsMap = {}; const ownGoalsMap = {}; const assistsMap = {};
      playersInTeams.forEach((p) => { 
        goalsMap[p.id] = p.goals || 0; 
        ownGoalsMap[p.id] = p.own_goals || 0; 
        assistsMap[p.id] = p.assists || 0;
      });
      setGoals(goalsMap); setOwnGoals(ownGoalsMap); setAssists(assistsMap);
    } else {
      setTeamA([]); setTeamB([]); setTeamC([]); 
      setScoreA(0); setScoreB(0); setScoreC(0);
      setGoals({}); setOwnGoals({}); setAssists({});
    }

    setActionMenuPlayerId(null); setReplacementModalOpen(false); setPlayerToReplace(null); setReplacementOptions([]); setSelectedReplacementId(""); setModalMode(null); setTargetTeam(null);
  };

  const sortearTimes = () => {
    if (players.length < Number(config.qtd_times)) { 
        alert(`Não há jogadores suficientes para preencher os ${config.qtd_times} times!`); 
        return; 
    }
    
    const embaralhar = (lista) => [...lista].sort(() => Math.random() - 0.5);
    
    let tA = []; let tB = []; let tC = [];
    let forcaA = 0; let forcaB = 0; let forcaC = 0;

    const agruparPorPosicao = () => {
      const porPosicao = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };
      players.forEach((p) => { 
        const pos = porPosicao[p.position] ? p.position : "MEI"; 
        porPosicao[pos].push(p); 
      });
      Object.keys(porPosicao).forEach((pos) => { 
        porPosicao[pos] = embaralhar(porPosicao[pos]).sort((a, b) => b.rating - a.rating); 
      });
      return porPosicao;
    };

    if (Number(config.qtd_times) === 3) {
      const porPosicao = agruparPorPosicao();

      const addToTeam3 = (player, team) => {
        if (team === "A") { tA.push(player); forcaA += Number(player.rating) || 0; } 
        else if (team === "B") { tB.push(player); forcaB += Number(player.rating) || 0; }
        else { tC.push(player); forcaC += Number(player.rating) || 0; }
      };

      const weakerTeam3 = () => {
        const minSize = Math.min(tA.length, tB.length, tC.length);
        const timesDisponiveis = [];
        if (tA.length === minSize) timesDisponiveis.push({ nome: "A", forca: forcaA });
        if (tB.length === minSize) timesDisponiveis.push({ nome: "B", forca: forcaB });
        if (tC.length === minSize) timesDisponiveis.push({ nome: "C", forca: forcaC });

        timesDisponiveis.sort((a, b) => a.forca - b.forca);
        return timesDisponiveis[0].nome;
      };

      const distribuirBasePorPosicao3 = (pos) => {
        const lista = [...porPosicao[pos]];
        while (lista.length > 0) {
           addToTeam3(lista.shift(), weakerTeam3());
        }
      };

      ["ZAG", "LAT", "MEI", "ATA"].forEach(distribuirBasePorPosicao3);

      if (porPosicao.GOL.length > 0) {
        const goleiros = [...porPosicao.GOL];
        const weakestOverallTeam3 = () => {
          const times = [ { nome: "A", forca: forcaA }, { nome: "B", forca: forcaB }, { nome: "C", forca: forcaC } ];
          times.sort((a, b) => a.forca - b.forca);
          return times[0].nome;
        };

        while (goleiros.length > 0) {
          addToTeam3(goleiros.shift(), weakestOverallTeam3());
        }
      }

      setTeamA(tA); setTeamB(tB); setTeamC(tC);
      return;
    }

    const porPosicao = agruparPorPosicao();

    const addToTeam = (player, team) => {
      if (team === "A") { tA.push(player); forcaA += Number(player.rating) || 0; } 
      else { tB.push(player); forcaB += Number(player.rating) || 0; }
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
        const primeiro = lista.shift(); const segundo = lista.shift();
        const timePrimeiro = weakerTeam(); const timeSegundo = timePrimeiro === "A" ? "B" : "A";
        addToTeam(primeiro, timePrimeiro); addToTeam(segundo, timeSegundo);
      } else { addToTeam(lista.shift(), weakerTeam()); }
      porPosicao[pos] = lista;
    };

    ["ZAG", "LAT", "MEI", "ATA"].forEach(distribuirBasePorPosicao);
    ["ZAG", "LAT", "MEI", "ATA"].forEach((pos) => { porPosicao[pos].forEach((player) => { addToTeam(player, weakerTeam()); }); porPosicao[pos] = []; });

    if (porPosicao.GOL.length > 0) {
      const goleiros = [...porPosicao.GOL]; 
      if (goleiros.length >= 2) {
        const g1 = goleiros.shift(); const g2 = goleiros.shift();
        const timeG1 = weakerTeam(); const timeG2 = timeG1 === "A" ? "B" : "A";
        addToTeam(g1, timeG1); addToTeam(g2, timeG2);
      }
      goleiros.forEach((g) => { addToTeam(g, weakerTeam()); });
    }

    const diferenca = Math.abs(forcaA - forcaB);
    if (diferenca > 1.5) {
      const semGoleiroA = tA.filter((p) => p.position !== "GOL");
      const semGoleiroB = tB.filter((p) => p.position !== "GOL");
      let melhorTroca = null; let melhorDiferenca = diferenca;
      semGoleiroA.forEach((a) => {
        semGoleiroB.forEach((b) => {
          if (a.position !== b.position) return;
          const novaDif = Math.abs((forcaA - a.rating + b.rating) - (forcaB - b.rating + a.rating));
          if (novaDif < melhorDiferenca) { melhorDiferenca = novaDif; melhorTroca = { a, b }; }
        });
      });
      if (melhorTroca) {
        tA = tA.map((p) => (p.id === melhorTroca.a.id ? melhorTroca.b : p));
        tB = tB.map((p) => (p.id === melhorTroca.b.id ? melhorTroca.a : p));
      }
    }
    setTeamA(tA); setTeamB(tB);
  };

  const confirmarSorteio = async () => {
    if (teamA.length === 0 || teamB.length === 0) return;
    if (!window.confirm("🔒 Deseja travar o jogo? \nNinguém mais poderá alterar presença após isso.\n")) return;

    try {
      const updatesA = teamA.map((p) => supabase.from("match_player").update({ team: "A", shirt_number: shirtMap[p.id] === "" ? null : Number(shirtMap[p.id]) }).eq("match_id", selectedMatch.id).eq("player_id", p.id));
      const updatesB = teamB.map((p) => supabase.from("match_player").update({ team: "B", shirt_number: shirtMap[p.id] === "" ? null : Number(shirtMap[p.id]) }).eq("match_id", selectedMatch.id).eq("player_id", p.id));
      
      let updatesC = [];
      if (Number(config.qtd_times) === 3) {
        updatesC = teamC.map((p) => supabase.from("match_player").update({ team: "C", shirt_number: shirtMap[p.id] === "" ? null : Number(shirtMap[p.id]) }).eq("match_id", selectedMatch.id).eq("player_id", p.id));
      }
      
      await Promise.all([...updatesA, ...updatesB, ...updatesC]);

      await supabase.from("matches").update({ 
          is_drawn: true, 
          team_a_name: config.nome_a, team_a_color: config.cor_a, 
          team_b_name: config.nome_b, team_b_color: config.cor_b,
          team_c_name: Number(config.qtd_times) === 3 ? config.nome_c : null, 
          team_c_color: Number(config.qtd_times) === 3 ? config.cor_c : null 
      }).eq("id", selectedMatch.id);
      
      alert("✅ Sorteio confirmado e jogo travado!");
      await loadMatches();
      
      await loadMatchData({ 
        ...selectedMatch, 
        is_drawn: true, 
        team_a_name: config.nome_a, team_a_color: config.cor_a, 
        team_b_name: config.nome_b, team_b_color: config.cor_b, 
        team_c_name: Number(config.qtd_times) === 3 ? config.nome_c : null, 
        team_c_color: Number(config.qtd_times) === 3 ? config.cor_c : null 
      });
    } catch (error) { console.error(error); alert("❌ Erro ao confirmar o sorteio."); }
  };

  const getEligibleNonConfirmedPlayers = async (excludePlayerId = null) => {
    const { data } = await supabase.from("match_player").select("*").eq("match_id", selectedMatch.id);
    const statusOrder = { null_status: 1, duvida: 2, nao_vai: 3 };

    return (data || [])
      .filter((item) => excludePlayerId !== null ? Number(item.player_id) !== Number(excludePlayerId) : true)
      .filter((item) => !item.team)
      .filter((item) => String(item.status || "").trim().toLowerCase() !== "confirmado")
      .map((item) => {
        const playerData = allPlayers.find((p) => Number(p.id) === Number(item.player_id));
        if (!playerData) return null;
        const normalizedStatus = item.status ? String(item.status).trim().toLowerCase() : "null_status";
        return {
          id: playerData.id, name: playerData.name, position: playerData.position, rating: playerData.rating,
          shirt_number: item.shirt_number ?? playerData.shirt_number ?? null, fixed_shirt_number: playerData.shirt_number ?? null,
          status: item.status, post_draw_action: item.post_draw_action ?? null, sortStatus: statusOrder[normalizedStatus] || 99
        };
      }).filter(Boolean).sort((a, b) => {
        if (a.sortStatus !== b.sortStatus) return a.sortStatus - b.sortStatus;
        return a.name.localeCompare(b.name);
      });
  };

  const abrirSubstituicao = async (player) => {
    if (!selectedMatch || !selectedMatch.is_drawn) return;
    const elegiveis = await getEligibleNonConfirmedPlayers(player.id);
    setModalMode("replace"); setTargetTeam(player.team); setPlayerToReplace(player); setReplacementOptions(elegiveis); setSelectedReplacementId(""); setReplacementModalOpen(true); setActionMenuPlayerId(null);
  };

  const abrirInclusao = async (team) => {
    if (!selectedMatch || !selectedMatch.is_drawn) return;
    const elegiveis = await getEligibleNonConfirmedPlayers();
    setModalMode("include"); setTargetTeam(team); setPlayerToReplace(null); setReplacementOptions(elegiveis); setSelectedReplacementId(""); setReplacementModalOpen(true); setActionMenuPlayerId(null);
  };

  const cancelarSubstituicao = () => {
    setReplacementModalOpen(false); setPlayerToReplace(null); setReplacementOptions([]); setSelectedReplacementId(""); setModalMode(null); setTargetTeam(null);
  };

  const confirmarSubstituicao = async () => {
    if (!playerToReplace || !selectedReplacementId || !selectedMatch) return;
    try {
      const replacementId = Number(selectedReplacementId);
      const substituto = replacementOptions.find((item) => Number(item.id) === Number(replacementId));
      const camisaFinal = substituto?.fixed_shirt_number !== null && substituto?.fixed_shirt_number !== undefined && substituto?.fixed_shirt_number !== "" ? substituto.fixed_shirt_number : null;

      await supabase.from("match_player").update({ team: null, goals: 0, own_goals: 0, assists: 0, shirt_number: null, post_draw_action: "substituido", replaced_by_player_id: replacementId }).eq("match_id", selectedMatch.id).eq("player_id", playerToReplace.id);
      await supabase.from("match_player").update({ team: playerToReplace.team, goals: 0, own_goals: 0, assists: 0, shirt_number: camisaFinal, post_draw_action: "incluido", replaced_player_id: playerToReplace.id }).eq("match_id", selectedMatch.id).eq("player_id", replacementId);

      alert("✅ Substituição realizada!");
      cancelarSubstituicao();
      await loadMatchData(selectedMatch);
    } catch (error) { console.error(error); alert("❌ Erro."); }
  };

  const confirmarInclusao = async () => {
    if (!selectedReplacementId || !selectedMatch || !targetTeam) return;
    try {
      const replacementId = Number(selectedReplacementId);
      const jogador = replacementOptions.find((item) => Number(item.id) === Number(replacementId));
      const camisaFinal = jogador?.fixed_shirt_number !== null && jogador?.fixed_shirt_number !== undefined && jogador?.fixed_shirt_number !== "" ? jogador.fixed_shirt_number : null;

      await supabase.from("match_player").update({ team: targetTeam, goals: 0, own_goals: 0, assists: 0, shirt_number: camisaFinal, post_draw_action: "incluido", replaced_player_id: null }).eq("match_id", selectedMatch.id).eq("player_id", replacementId);

      alert("✅ Jogador incluído!");
      cancelarSubstituicao();
      await loadMatchData(selectedMatch);
    } catch (error) { console.error(error); alert("❌ Erro."); }
  };

  const excluirDaEscalacao = async (player) => {
    if (!selectedMatch) return;
    if (!window.confirm(`🗑️ Excluir ${player.name} da escalação?`)) return;
    try {
      await supabase.from("match_player").update({ team: null, goals: 0, own_goals: 0, assists: 0, shirt_number: null, post_draw_action: "excluido", replaced_by_player_id: null }).eq("match_id", selectedMatch.id).eq("player_id", player.id);
      setActionMenuPlayerId(null);
      alert("✅ Jogador excluído!");
      await loadMatchData(selectedMatch);
    } catch (error) { console.error(error); alert("❌ Erro."); }
  };

  const desfazerSorteio = async () => {
    if (!window.confirm("⚠️ Deseja REABRIR esta partida?")) return;
    try {
      await supabase.from("match_player").update({ team: null, goals: 0, own_goals: 0, assists: 0, post_draw_action: null, replaced_by_player_id: null, replaced_player_id: null }).eq("match_id", selectedMatch.id);
      await supabase.from("matches").update({ is_drawn: false, score_a: 0, score_b: 0, score_c: 0, team_a_name: null, team_a_color: null, team_b_name: null, team_b_color: null, team_c_name: null, team_c_color: null }).eq("id", selectedMatch.id);
      
      alert("✅ Jogo reaberto!");
      await loadMatches();
      await loadMatchData({ ...selectedMatch, is_drawn: false, score_a: 0, score_b: 0, score_c: 0, team_a_name: null, team_a_color: null, team_b_name: null, team_b_color: null, team_c_name: null, team_c_color: null });
    } catch (error) { console.error(error); alert("❌ Erro."); }
  };

  const handleGoalChange = (playerId, amount) => { setGoals((prev) => ({ ...prev, [playerId]: Math.max(0, parseInt(amount) || 0) })); };
  const handleOwnGoalChange = (playerId, amount) => { setOwnGoals((prev) => ({ ...prev, [playerId]: Math.max(0, parseInt(amount) || 0) })); };
  const handleAssistsChange = (playerId, amount) => { setAssists((prev) => ({ ...prev, [playerId]: Math.max(0, parseInt(amount) || 0) })); };

  const salvarEstatisticas = async () => {
    try {
      await supabase.from("matches").update({ 
        score_a: Number(scoreA), 
        score_b: Number(scoreB), 
        score_c: isTresTimes ? Number(scoreC) : 0 
      }).eq("id", selectedMatch.id);
      
      const playerIds = Array.from(new Set([...Object.keys(goals), ...Object.keys(ownGoals), ...Object.keys(assists)]));
      const statsUpdates = playerIds.map((playerId) => 
        supabase.from("match_player").update({ 
          goals: Number(goals[playerId]) || 0, 
          own_goals: Number(ownGoals[playerId]) || 0,
          assists: Number(assists[playerId]) || 0 
        }).eq("match_id", selectedMatch.id).eq("player_id", Number(playerId))
      );
      await Promise.all(statsUpdates);

      alert("✅ Estatísticas do jogo salvas!");
      await loadMatchData({ ...selectedMatch, score_a: Number(scoreA), score_b: Number(scoreB), score_c: isTresTimes ? Number(scoreC) : 0 });
    } catch (error) { console.error(error); alert("❌ Erro."); }
  };

  const calcForca = (time) => time.reduce((soma, p) => soma + p.rating, 0).toFixed(1);
  const formatarJogador = (p) => { const num = p.shirt_number !== null && p.shirt_number !== undefined && p.shirt_number !== "" ? String(p.shirt_number).padStart(2, "0") : "--"; return `${num} - ${p.name} - (${p.position})`; };
  const ordenarPorPosicao = (time) => { const pesos = { GOL: 1, ZAG: 2, LAT: 3, MEI: 4, ATA: 5 }; return [...time].sort((a, b) => (pesos[a.position] || 99) - (pesos[b.position] || 99)); };

  const copiarWhatsApp = () => {
    const nomePelada = activeGroup?.nome_grupo ? activeGroup.nome_grupo.toUpperCase() : "PELADA";
    
    let texto = `⚽ *${nomePelada}* (${selectedMatch.date.split("-").reverse().join("/")})\n\n`;

    const timesToRender = [
        { nome: displayNomeA, cor: displayCorA, time: teamA },
        { nome: displayNomeB, cor: displayCorB, time: teamB }
    ];
    if (isTresTimes) {
        timesToRender.push({ nome: displayNomeC, cor: displayCorC, time: teamC });
    }

    timesToRender.forEach(t => {
        const timeOrdenado = ordenarPorPosicao(t.time);
        const emoji = getEmojiForColor(t.cor);
        texto += `${emoji} *${t.nome.toUpperCase()}* (⭐ ${calcForca(t.time)})\n${timeOrdenado.map((p) => `• ${formatarJogador(p)}`).join("\n")}\n\n`;
    });

    navigator.clipboard.writeText(texto);
    alert("Copiado para área de transferência, pode colar no WhatsApp!");
  };

  const renderActionMenu = (p) => {
    if (!isAdmin || !selectedMatch?.is_drawn) return null;
    return (
      <div style={{ position: "relative" }}>
        <button onClick={(e) => { e.stopPropagation(); setActionMenuPlayerId((prev) => (prev === p.id ? null : p.id)); }} style={{ borderRadius: "4px", border: "1px solid #999", backgroundColor: "#ffffff", color: "#333", cursor: "pointer", fontWeight: "bold", fontSize: "11px", width: "24px", height: "24px", lineHeight: "1" }}>☰</button>
        {actionMenuPlayerId === p.id && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "28px", right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", minWidth: "150px", zIndex: 30, overflow: "hidden" }}>
            <button onClick={() => abrirSubstituicao(p)} style={{ width: "100%", background: "#fff", border: "none", padding: "10px 12px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#333", borderBottom: "1px solid #eee" }}>🔁 Substituir</button>
            <button onClick={() => excluirDaEscalacao(p)} style={{ width: "100%", background: "#fff", border: "none", padding: "10px 12px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#dc3545" }}>🗑️ Excluir</button>
          </div>
        )}
      </div>
    );
  };

  const renderTeamCard = (title, borderColor, team, score, setScore, teamKey) => (
    <div style={{ width: "100%", background: "#fff", padding: "15px", borderRadius: "10px", border: `3px solid ${borderColor}`, boxShadow: "0 4px 6px rgba(0,0,0,0.06)", boxSizing: "border-box" }}>
      <h3 style={{ textAlign: "center", color: "#000102", marginTop: 0, marginBottom: "15px", fontWeight: "bold", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
        {title} <span style={{ fontSize: "10px", color: "#666", fontWeight: "normal" }}>(⭐ {calcForca(team)})</span>
      </h3>

      {selectedMatch.is_drawn && isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
          <button onClick={() => abrirInclusao(teamKey)} style={{ background: "#e8f5e9", color: "#1b5e20", border: "1px solid #c8e6c9", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>➕ Incluir jogador</button>
        </div>
      )}

      {selectedMatch.is_drawn && config.pt_vitoria_ativo && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "12px", background: "#e9ecef", padding: "6px", borderRadius: "8px" }}>
          <label style={{ fontWeight: "bold", marginRight: "10px", color: "#333", fontSize: "14px" }}>Placar (Vitórias):</label>
          <input type="number" value={score} onChange={(e) => setScore(e.target.value)} style={{ width: "50px", textAlign: "center", fontSize: "18px", fontWeight: "bold", padding: "4px", borderRadius: "6px", border: "1px solid #ccc", color: "#000", backgroundColor: "#fff" }} />
        </div>
      )}

      {selectedMatch.is_drawn && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px", fontSize: "11px", fontWeight: "bold", color: "#666" }}>
          <span>Jogador</span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {config.pt_gol_ativo && <span style={{ width: "30px", textAlign: "center", fontSize: "14px" }} title="Gols Marcados">⚽</span>}
            {config.pt_gol_contra_ativo && <span style={{ width: "30px", textAlign: "center", fontSize: "14px" }} title="Gols Contra">🥅</span>}
            {config.pt_assistencia_ativo && <span style={{ width: "30px", textAlign: "center", fontSize: "14px" }} title="Assistências (AS)">👟</span>}
            {isAdmin && <span style={{ width: "24px", textAlign: "center" }}></span>}
          </div>
        </div>
      )}

      {ordenarPorPosicao(team).filter(Boolean).map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f1f1", alignItems: "center", fontSize: "15px", color: "#333", gap: "5px" }}>
          
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: "4px" }}>
            <span style={{ textAlign: "left", fontSize: "13px", fontWeight: "bold", color: "#333", lineHeight: "1.2", wordWrap: "break-word" }}>
              {p.name}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "33px", display: "flex", justifyContent: "flex-start" }}>
                {p.fixed_shirt_number ? (
                  <span style={{ width: "30px", textAlign: "center", fontWeight: "bold", fontSize: "11px", color: "#555", background: "#f1f1f1", padding: "2px", borderRadius: "4px", display: "inline-block" }}>
                    {String(p.shirt_number).padStart(2, "0")}
                  </span>
                ) : (
                  <input type="number" min="0" max="99" value={shirtMap?.[p.id] ?? ""} onChange={(e) => handleShirtChange(p.id, e.target.value)} disabled={selectedMatch.is_drawn} style={{ width: "38px", padding: "2px", textAlign: "center", borderRadius: "4px", border: "1px solid #999", backgroundColor: "#fff", color: "#000", fontWeight: "bold", fontSize: "11px", outline: "none", boxSizing: "border-box" }} placeholder="-" />
                )}
              </div>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#666" }}>
                {p.position}
              </span>
            </div>
          </div>

          {selectedMatch.is_drawn && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {config.pt_gol_ativo && <input type="number" min="0" value={goals?.[p.id] || 0} onChange={(e) => handleGoalChange(p.id, e.target.value)} style={{ width: "30px", padding: "3px", textAlign: "center", borderRadius: "4px", border: "1px solid #999", backgroundColor: "#f8f9fa", color: "#048804", fontWeight: "bold", fontSize: "11px", outline: "none" }} />}
              {config.pt_gol_contra_ativo && <input type="number" min="0" value={ownGoals?.[p.id] || 0} onChange={(e) => handleOwnGoalChange(p.id, e.target.value)} style={{ width: "30px", padding: "3px", textAlign: "center", borderRadius: "4px", border: "1px solid #c77d7d", backgroundColor: "#fff5f5", color: "#8b0000", fontWeight: "bold", fontSize: "11px", outline: "none" }} />}
              {config.pt_assistencia_ativo && <input type="number" min="0" value={assists?.[p.id] || 0} onChange={(e) => handleAssistsChange(p.id, e.target.value)} style={{ width: "30px", padding: "3px", textAlign: "center", borderRadius: "4px", border: "1px solid #999", backgroundColor: "#f8f9fa", color: "#0d6efd", fontWeight: "bold", fontSize: "11px", outline: "none" }} />}
              {renderActionMenu(p)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* NOVO SELETOR DE PARTIDA */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#444", fontSize: "14px" }}>
          📅 Selecione a Partida
        </label>
        <select 
          value={selectedMatch?.id || ""} 
          onChange={(e) => {
            const matchId = e.target.value;
            if (!matchId) {
              setSelectedMatch(null);
              setTeamA([]); setTeamB([]); setTeamC([]);
              setScoreA(0); setScoreB(0); setScoreC(0);
              setConfirmedList([]);
            } else {
              const match = matches.find(m => String(m.id) === String(matchId));
              if (match) loadMatchData(match);
            }
          }} 
          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", background: "#f8f9fa", color: "#333", outline: "none", cursor: "pointer" }}
        >
          <option value="">Selecione a data...</option>
          {matches.map(m => (
            <option key={m.id} value={m.id}>
              {m.date.split("-").reverse().join("/")} {m.is_drawn ? "🔒 (Fechada)" : "🎲 (Aberto)"}
            </option>
          ))}
        </select>
      </div>

      {selectedMatch && (
        <div style={{ width: "100%", background: "#f8f9fa", padding: "20px", borderRadius: "12px", border: "1px solid #dddddd", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, color: "#333", fontSize: "18px" }}>{selectedMatch.is_drawn ? "🔒 Jogo Fechado" : "🎲 Escalação"}</h2>
            {teamA.length > 0 && <button onClick={copiarWhatsApp} style={{ background: "#25D366", color: "white", padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 5px rgba(37,211,102,0.3)", fontSize: "13px" }}>📱 WhatsApp</button>}
          </div>

          {(teamA.length > 0 || teamB.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "25px", width: "100%" }}>
              {renderTeamCard(<><span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: displayCorA }}></span> {displayNomeA}</>, displayCorA, teamA, scoreA, setScoreA, "A")}
              {renderTeamCard(<><span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: displayCorB }}></span> {displayNomeB}</>, displayCorB, teamB, scoreB, setScoreB, "B")}
              {isTresTimes && renderTeamCard(<><span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: displayCorC }}></span> {displayNomeC}</>, displayCorC, teamC, scoreC, setScoreC, "C")}
            </div>
          )}

          {isAdmin && (
            <>
              {!selectedMatch.is_drawn ? (
                <div style={{ display: "flex", gap: "12px", flexDirection: "column", background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6" }}>
                  {teamA.length === 0 && <button onClick={sortearTimes} style={{ padding: "16px", background: "#007bff", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold", fontSize: "18px" }}>🎲 Sortear Times Equilibrados</button>}
                  {teamA.length > 0 && (
                    <>
                      <button onClick={confirmarSorteio} style={{ padding: "16px", background: "#28a745", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold", fontSize: "18px" }}>🔒 Confirmar Sorteio e Travar Jogo</button>
                      <button onClick={sortearTimes} style={{ padding: "10px", background: "#f8f9fa", color: "#6c757d", borderRadius: "8px", border: "1px solid #ced4da", cursor: "pointer", fontSize: "14px", marginTop: "5px" }}>🔄 Não gostei, refazer sorteio</button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "12px", flexDirection: "column", background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6" }}>
                  <button onClick={salvarEstatisticas} style={{ padding: "16px", background: "#ffc107", color: "#333", borderRadius: "8px", border: "none", fontWeight: "bold", fontSize: "18px" }}>💾 Salvar Estatísticas</button>
                  
                  {/* Se placares, gols, gols contra E assistências estiverem zerados, permite reabrir o jogo */}
                  {(Number(scoreA) === 0 && Number(scoreB) === 0 && (!isTresTimes || Number(scoreC) === 0) && Object.values(goals).every((g) => Number(g) === 0) && Object.values(ownGoals).every((g) => Number(g) === 0) && Object.values(assists).every((a) => Number(a) === 0)) && (
                    <button onClick={desfazerSorteio} style={{ padding: "14px", background: "#fff", color: "#dc3545", borderRadius: "8px", border: "2px solid #dc3545", cursor: "pointer", fontSize: "16px", fontWeight: "bold", marginTop: "10px" }}>⚠️ Reabrir Jogo (Desfazer Sorteio)</button>
                  )}
                </div>
              )}
            </>
          )}

          {!selectedMatch.is_drawn && teamA.length === 0 && confirmedList.length > 0 && (
            <div style={{ marginTop: "15px", background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontWeight: "bold", fontSize: "14px", color: "#333", marginBottom: "8px" }}>✅ Confirmados para esta partida</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {confirmedList.map((jogador) => <div key={jogador.ordem} style={{ textAlign: "left", fontSize: "14px", color: "#555" }}><strong>{jogador.ordem}.</strong> {jogador.position} - {jogador.name}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {replacementModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, color: "#333" }}>{modalMode === "replace" ? "🔁 Substituir jogador" : "➕ Incluir jogador"}</h3>
            {modalMode === "replace" && <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>Jogador atual: <strong>{playerToReplace?.name}</strong></div>}
            {modalMode === "include" && <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>Time destino: <strong>{targetTeam === "A" ? displayNomeA : targetTeam === "B" ? displayNomeB : displayNomeC}</strong></div>}
            {replacementOptions.length === 0 ? (
              <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "8px", padding: "12px", color: "#666", marginBottom: "16px" }}>Nenhum jogador elegível disponível.</div>
            ) : (
              <select value={selectedReplacementId} onChange={(e) => setSelectedReplacementId(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", marginBottom: "16px", color: "#000", background: "#fff" }}>
                <option value="">Selecione o jogador</option>
                {replacementOptions.map((j) => <option key={j.id} value={j.id}>{j.name} ({j.position}) - {j.status ? j.status : "sem resposta"}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={cancelarSubstituicao} style={{ padding: "10px 14px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Cancelar</button>
              <button onClick={modalMode === "replace" ? confirmarSubstituicao : confirmarInclusao} disabled={!selectedReplacementId} style={{ padding: "10px 14px", background: selectedReplacementId ? "#28a745" : "#ced4da", color: selectedReplacementId ? "#fff" : "#6c757d", border: "none", borderRadius: "8px", cursor: selectedReplacementId ? "pointer" : "not-allowed", fontWeight: "bold" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}