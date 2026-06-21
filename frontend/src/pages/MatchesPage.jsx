import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext"; 

// Função inteligente para pegar o próximo dia de jogo do grupo
const getNextMatchDate = (diaPreferido) => {
  const hoje = new Date();
  
  const formatLocal = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  if (!diaPreferido) return formatLocal(hoje);

  const mapaDias = { 
    "domingo": 0, "segunda": 1, "terca": 2, "quarta": 3, 
    "quinta": 4, "sexta": 5, "sabado": 6 
  };

  const diaLimpo = String(diaPreferido)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .trim() 
    .split("-")[0] 
    .trim(); 

  const targetDay = mapaDias[diaLimpo];

  if (targetDay === undefined) return formatLocal(hoje);

  let diff = targetDay - hoje.getDay();
  if (diff < 0) {
    diff += 7; 
  }

  const proximaData = new Date(hoje);
  proximaData.setDate(hoje.getDate() + diff);

  return formatLocal(proximaData);
};


export default function MatchesPage({ user }) {
  const { activeGroup, isAdmin } = useGroup(); 
  const [newMatchDate, setNewMatchDate] = useState(
    getNextMatchDate(activeGroup?.dia_jogo_grupo)
  );
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [shirtMap, setShirtMap] = useState({});

  const [showNewMatchForm, setShowNewMatchForm] = useState(false);
  
  useEffect(() => {
    if (activeGroup) {
      loadData();
      setSelectedMatch(null); 
      setStatusMap({});
      setShirtMap({});
      setShowNewMatchForm(false);
    }
  }, [activeGroup]);

  const loadData = async () => {
      const { data: grupoData } = await supabase
        .from("grupos_pelada")
        .select("dia_jogo_grupo")
        .eq("id_grupo", activeGroup.id_grupo) 
        .maybeSingle();

      if (grupoData && grupoData.dia_jogo_grupo) {
        setNewMatchDate(getNextMatchDate(grupoData.dia_jogo_grupo));
      } else {
        setNewMatchDate(getNextMatchDate(null)); 
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("id_grupo", activeGroup.id_grupo) 
        .order("date", { ascending: false });

      if (matchesError) {
        console.error("Erro ao carregar partidas:", matchesError);
        return;
      }

      const { data: membrosData, error: membrosError } = await supabase
        .from("grupo_membros")
        .select(`
          position, rating, shirt_number, is_spectator, is_hidden, is_disabled,
          players!inner(id, name)
        `)
        .eq("id_grupo", activeGroup.id_grupo) 
        .eq("is_hidden", false)
        .eq("is_spectator", false)
        .eq("is_disabled", false) 
        .neq("player_id", 1);

      if (membrosError) {
        console.error("Erro ao carregar jogadores:", membrosError);
        return;
      }

      const playersList = (membrosData || [])
        .map((m) => ({
          id: m.players.id,
          name: m.players.name,
          position: m.position,
          rating: m.rating,
          shirt_number: m.shirt_number
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setMatches(matchesData || []);
      setPlayers(playersList);
    };

  const loadConfirmations = async (matchId) => {
    const { data, error } = await supabase
      .from("match_player")
      .select("*")
      .eq("match_id", matchId);

    if (error) {
      console.error("Erro ao carregar confirmações:", error);
      return;
    }

    const novoStatusMap = {};
    const novoShirtMap = {};

    (data || []).forEach((item) => {
      novoStatusMap[item.player_id] = item.status;
      novoShirtMap[item.player_id] = item.shirt_number ?? "";
    });

    players.forEach((p) => {
      if (p.shirt_number && !novoShirtMap[p.id]) {
        novoShirtMap[p.id] = p.shirt_number;
      }
    });

    setStatusMap(novoStatusMap);
    setShirtMap(novoShirtMap);
  };

  const updateShirtNumber = async (playerId, value) => {
    if (!selectedMatch) return;

    const player = players.find((p) => p.id === playerId);
    if (player?.shirt_number) return;

    const numberValue = value === "" ? null : Number(value);

    if (numberValue !== null && (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 99)) {
      return;
    }

    setShirtMap((prev) => ({ ...prev, [playerId]: value }));

    const { error } = await supabase
      .from("match_player")
      .upsert(
        {
          match_id: selectedMatch.id,
          player_id: playerId,
          status: statusMap[playerId] ?? null,
          shirt_number: numberValue
        },
        { onConflict: "match_id,player_id" }
      );

    if (error) {
      console.error("Erro ao salvar número da camisa:", error);
      alert("❌ Erro ao salvar número da camisa.");
    }
  };

  const createMatch = async () => {
    if (!newMatchDate) {
      alert("⚠️ Selecione uma data para o jogo!");
      return;
    }

    const matchExists = matches.some((m) => m.date === newMatchDate);

    if (matchExists) {
      alert("⚠️ Já existe um jogo cadastrado para esta data!");
      return;
    }

    const { data, error } = await supabase
      .from("matches")
      .insert([
        {
          id_grupo: activeGroup.id_grupo, 
          date: newMatchDate,
          is_drawn: false,
          score_a: 0,
          score_b: 0
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Detalhe do erro no banco:", error);
      alert(`❌ Erro do Banco de Dados: ${error.message}`);
      return;
    }

    const { data: membrosData, error: membrosError } = await supabase
      .from("grupo_membros")
      .select("player_id")
      .eq("id_grupo", activeGroup.id_grupo) 
      .eq("is_hidden", false)
      .eq("is_spectator", false)
      .eq("is_disabled", false) 
      .neq("player_id", 1);

    if (membrosError) {
      console.error(membrosError);
      alert("❌ Partida criada, mas houve erro ao carregar jogadores.");
      return;
    }

    const matchPlayerRows = (membrosData || []).map((membro) => ({
      match_id: data.id,
      player_id: membro.player_id,
      status: null,
      team: null,
      goals: 0,
      own_goals: 0,
      shirt_number: null
    }));

    if (matchPlayerRows.length > 0) {
      const { error: matchPlayerError } = await supabase
        .from("match_player")
        .insert(matchPlayerRows);

      if (matchPlayerError) {
        console.error(matchPlayerError);
        alert("❌ Partida criada, mas houve erro ao preparar lista de jogadores.");
        return;
      }
    }

    const newMatches = [data, ...matches];
    setMatches(newMatches);
    selectMatch(data);
    
    setShowNewMatchForm(false);
    setNewMatchDate(getNextMatchDate(activeGroup?.dia_jogo_grupo));
  };

  const deleteMatch = async (matchId) => {
    if (selectedMatch?.is_drawn) {
      alert("❌ Partidas travadas não podem ser excluídas.");
      return;
    }

    const confirmDelete = window.confirm("🗑️ Tem certeza que deseja excluir este jogo? Todos os dados serão apagados.");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.rpc("delete_match_cascade", {
        p_match_id: matchId
      });

      if (error) {
        console.error(error);
        alert(`❌ Erro ao excluir o jogo: ${error.message}`);
        return;
      }

      setMatches(matches.filter((m) => m.id !== matchId));

      if (selectedMatch?.id === matchId) {
        setSelectedMatch(null);
        setStatusMap({});
        setShirtMap({});
      }

      alert("✅ Jogo excluído com sucesso!");
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao excluir o jogo.");
    }
  };

  const selectMatch = (match) => {
    setSelectedMatch(match);
    loadConfirmations(match.id);
  };

  const confirmPlayer = async (playerId, status) => {
    if (!selectedMatch) return;
    if (selectedMatch.is_drawn) {
      alert("🔒 Jogo fechado! Não é mais possível alterar presenças.");
      return;
    }
    
    if (!isAdmin && user?.player_id !== playerId) {
      alert("⚠️ Você só pode alterar a sua própria presença.");
      return;
    }

    setStatusMap((prev) => ({ ...prev, [playerId]: status }));

    const shirtNumberValue = shirtMap[playerId] === "" || shirtMap[playerId] === undefined ? null : Number(shirtMap[playerId]);

    const { error } = await supabase
      .from("match_player")
      .upsert(
        {
          match_id: selectedMatch.id,
          player_id: playerId,
          status: status,
          shirt_number: shirtNumberValue
        },
        { onConflict: "match_id,player_id" }
      );

    if (error) {
      console.error("Erro ao confirmar presença:", error);
      alert(`❌ Erro ao confirmar presença: ${error.message}`);
    }
  };

  const isMatchOpen = (matchDate) => {
    if (!matchDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchD = new Date(matchDate + "T00:00:00");
    matchD.setHours(0, 0, 0, 0);
    return matchD >= today;
  };

  const handleCopiarAvisoWhatsApp = async (matchDate) => {
    try {
      let dataFormatada = matchDate || "nesta semana";
      if (matchDate && matchDate.includes("-")) {
        dataFormatada = matchDate.split("-").reverse().join("/");
      }

      const nomePelada = activeGroup?.nome_grupo ? activeGroup.nome_grupo.toUpperCase() : "NOSSA PELADA";

      let texto = `⚽ *NOVA PARTIDA: ${nomePelada}* ⚽\n`;
      texto += `📅 *Data:* ${dataFormatada}\n\n`;
      texto += `Atenção, craques! A lista de presença já está aberta no nosso aplicativo.\n\n`;
      texto += `👉 Acessem o app e confirmem se vão pro jogo!`;

      await navigator.clipboard.writeText(texto);
      alert("✅ Mensagem copiada com sucesso! Agora é só abrir o grupo do WhatsApp e colar.");
    } catch (error) {
      console.error("Erro ao copiar a mensagem:", error);
      alert("❌ Erro ao copiar o aviso. Verifique se o seu navegador permite acesso à área de transferência.");
    }
  };

  const playersWithStatus = players.map((p) => {
    return { ...p, status: statusMap[p.id] || "sem_resposta" };
  });

  const statusWeight = { confirmado: 1, sem_resposta: 2, duvida: 3, nao_vai: 4 };

  playersWithStatus.sort((a, b) => {
    if (a.id === user?.player_id) return -1;
    if (b.id === user?.player_id) return 1;
    return statusWeight[a.status] - statusWeight[b.status];
  });

  const totalConfirmed = playersWithStatus.filter((p) => p.status === "confirmado").length;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "40px" }}>
      
      {isAdmin && (
        <div style={{ marginBottom: 20 }}>
          {!showNewMatchForm ? (
            <button
              onClick={() => setShowNewMatchForm(true)}
              style={{ width: "100%", padding: "16px", background: "#28a745", color: "white", fontSize: "16px", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer", boxShadow: "0 4px 10px rgba(40,167,69,0.3)" }}
            >
              📅 + Novo Jogo
            </button>
          ) : (
            <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>
                  Data do Jogo:
                </label>
                <input
                  type="date"
                  value={newMatchDate}
                  onChange={(e) => setNewMatchDate(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={createMatch}
                  style={{ flex: 1, padding: "12px", background: "#28a745", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: "pointer" }}
                >
                  ✅ Confirmar Criação
                </button>
                <button
                  onClick={() => setShowNewMatchForm(false)}
                  style={{ padding: "12px", background: "#6c757d", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SELETOR DE PARTIDA */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", color: "#444", fontSize: "14px" }}>
          📅 Selecione a Partida
        </label>
        {matches.length === 0 ? (
          <div style={{ padding: "10px", color: "#888", fontSize: "14px", fontStyle: "italic" }}>
            Nenhuma partida criada ainda. {isAdmin && "Clique em '+ Novo Jogo' para começar."}
          </div>
        ) : (
          <select 
            value={selectedMatch?.id || ""} 
            onChange={(e) => {
              const matchId = e.target.value;
              if (!matchId) {
                setSelectedMatch(null);
                setStatusMap({});
                setShirtMap({});
              } else {
                const match = matches.find(m => String(m.id) === String(matchId));
                if (match) selectMatch(match);
              }
            }} 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", background: "#f8f9fa", color: "#333", outline: "none", cursor: "pointer" }}
          >
            <option value="">Selecione a data...</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.date.split("-").reverse().join("/")} {m.is_drawn ? "🔒 Fechada" : "🎲 Aberto"}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedMatch && (
        <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "5px", border: "1px solid #eee" }}>
          
          {/* CABEÇALHO DA PARTIDA (Botões e Título organizados em linhas) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "15px" }}>
            
            {/* LINHA SUPERIOR: Botão do WhatsApp isolado e alinhado à direita */}
            {isAdmin && isMatchOpen(selectedMatch.date) && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button 
                  onClick={() => handleCopiarAvisoWhatsApp(selectedMatch.date)} 
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: "#25D366", color: "white", border: "none", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }}
                  title="Copiar aviso para o WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                  WhatsApp
                </button>
              </div>
            )}

            {/* LINHA INFERIOR: Presença, Confirmados e Excluir */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <h3 style={{ margin: 0, color: "#333" }}>Presença</h3>

              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ background: totalConfirmed >= 12 ? "#28a745" : totalConfirmed >= 10 ? "#ffc107" : "#dc3545", color: totalConfirmed >= 10 && totalConfirmed < 12 ? "black" : "white", padding: "4px 10px", borderRadius: "20px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  Confirmados: {totalConfirmed}
                </div>

                {isAdmin && !selectedMatch?.is_drawn && (
                  <button 
                    onClick={() => deleteMatch(selectedMatch.id)} 
                    style={{ background: "#dc3545", color: "white", border: "none", borderRadius: "8px", padding: "5px 8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* FIM DO CABEÇALHO */}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {playersWithStatus.map((p) => {
              const bloqueadoParaEsteUsuario = !isAdmin && user?.player_id !== p.id;
              const hasFixedNumber = !!p.shirt_number;

              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "12px", borderRadius: "10px", borderLeft: `6px solid ${p.status === "confirmado" ? "#28a745" : p.status === "nao_vai" ? "#dc3545" : p.status === "duvida" ? "#ffc107" : "#ddd"}`, boxShadow: "0 2px 5px rgba(0,0,0,0.05)", opacity: selectedMatch.is_drawn ? 0.7 : 1 }}>
                  <div>
                    <div style={{ textAlign: "left", fontWeight: "bold", fontSize: "16px", color: "#333" }}>
                      {p.name}
                      {user?.player_id === p.id && (
                        <span style={{ fontSize: "11px", color: "#28a745", background: "#e8f5e9", padding: "2px 6px", borderRadius: "10px", marginLeft: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Você
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                      <span>👕</span>
                      <input type="number" min="0" max="99" value={shirtMap[p.id] ?? ""} onChange={(e) => updateShirtNumber(p.id, e.target.value)} disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario || hasFixedNumber} style={{ width: "48px", padding: "4px", textAlign: "center", borderRadius: "6px", border: "1px solid #ccc", color: hasFixedNumber ? "#666" : "#007bff", fontWeight: "bold", fontSize: "13px", backgroundColor: hasFixedNumber ? "#e9ecef" : "#fff" }} title={hasFixedNumber ? "Número fixo" : "Número da camisa"} />
                      <span style={{ fontSize: "12px", color: "#888" }}>
                        ⚽ {p.position} | ⭐ {p.rating}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => confirmPlayer(p.id, "confirmado")} disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario} style={{ padding: "8px 12px", background: p.status === "confirmado" ? "#28a745" : "#f1f3f5", color: p.status === "confirmado" ? "white" : "#555", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: selectedMatch.is_drawn || bloqueadoParaEsteUsuario ? "not-allowed" : "pointer", opacity: bloqueadoParaEsteUsuario ? 0.4 : 1 }}>Vai</button>
                    <button onClick={() => confirmPlayer(p.id, "nao_vai")} disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario} style={{ padding: "8px 12px", background: p.status === "nao_vai" ? "#dc3545" : "#f1f3f5", color: p.status === "nao_vai" ? "white" : "#555", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: selectedMatch.is_drawn || bloqueadoParaEsteUsuario ? "not-allowed" : "pointer", opacity: bloqueadoParaEsteUsuario ? 0.4 : 1 }}>Não</button>
                    <button onClick={() => confirmPlayer(p.id, "duvida")} disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario} style={{ padding: "8px", background: p.status === "duvida" ? "#ffc107" : "#f1f3f5", color: p.status === "duvida" ? "black" : "#555", border: "none", borderRadius: "6px", fontSize: "14px", cursor: selectedMatch.is_drawn || bloqueadoParaEsteUsuario ? "not-allowed" : "pointer", opacity: bloqueadoParaEsteUsuario ? 0.4 : 1 }}>❓</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}