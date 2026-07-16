import { supabase } from "../supabaseClient";
import { useEffect, useState } from "react";
import CampoIcon from "../components/icons/CampoIcon";
import { useGroup } from "../contexts/GroupContext"; 

const normalizePhone = (value) => value.replace(/\D/g, "").slice(0, 11);

const formatPhone = (value) => {
  const digits = normalizePhone(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const POSITIONS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
const INITIAL_FORM = {
  tipo_jogador: "Mensalista",
  phone: "",
  name: "",
  rating: 3,
  position: "MEI",
  shirt_number: "",
  is_spectator: false,
  is_disabled: false
};

export default function PlayersPage({ user }) {
  const [players, setPlayers] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { activeGroup } = useGroup();

  useEffect(() => {
    if (activeGroup) {
      loadPlayers();
      setShowNewForm(false);
      cancelEdit();
    }
  }, [activeGroup]);

  const loadPlayers = async () => {
    try {
      const { data: membrosData, error: membrosError } = await supabase
        .from("grupo_membros")
        .select(`
          perfil, position, rating, shirt_number, is_spectator, tipo_jogador, is_disabled,
          players!inner(id, name, phone)
        `)
        .eq("id_grupo", activeGroup.id_grupo)
        .eq("is_hidden", false)
        .neq("player_id", 1); 

      if (membrosError) {
        console.error("Erro ao carregar jogadores:", membrosError);
        return;
      }

      const playersList = (membrosData || []).map((m) => ({
        id: m.players.id,
        name: m.players.name,
        phone: m.players.phone,
        position: m.position,
        rating: m.rating,
        shirt_number: m.shirt_number,
        is_spectator: m.is_spectator,
        tipo_jogador: m.tipo_jogador || "Mensalista",
        is_disabled: Boolean(m.is_disabled),
        is_admin: m.perfil === "admin"
      }));

      setPlayers(playersList);
    } catch (err) {
      console.error("Erro geral:", err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const phoneNormalizado = newForm.phone ? normalizePhone(newForm.phone) : null;

    if (newForm.tipo_jogador === "Mensalista" && (!phoneNormalizado || phoneNormalizado.length !== 11)) {
      alert("❌ O Mensalista deve obrigatoriamente ter o WhatsApp cadastrado (11 dígitos).");
      return;
    }
    if (newForm.tipo_jogador === "Convidado" && phoneNormalizado && phoneNormalizado.length !== 11) {
      alert("❌ O WhatsApp está incompleto. Se não tiver, apague e deixe em branco.");
      return;
    }

    let finalPlayerId = null;

    if (phoneNormalizado) {
      const { data: existingPlayer } = await supabase.from("players").select("id, name").eq("phone", phoneNormalizado).maybeSingle();
      if (existingPlayer) finalPlayerId = existingPlayer.id;
    }

    if (!finalPlayerId) {
      const { data: createdPlayer, error: insertError } = await supabase
        .from("players")
        .insert({ name: newForm.name, phone: phoneNormalizado })
        .select()
        .maybeSingle();

      if (insertError) {
        if (insertError.code === '23505') alert("⚠️ Este telefone já pertence a um jogador. Peça suporte.");
        else alert(`❌ Erro ao criar jogador na base global: ${insertError.message}`);
        return;
      }
      
      if (createdPlayer) finalPlayerId = createdPlayer.id;

      if (phoneNormalizado && finalPlayerId) {
        const senhaPadrao = phoneNormalizado.slice(-4);
        await supabase.from("users").insert({ phone: phoneNormalizado, password: senhaPadrao, player_id: finalPlayerId, is_admin: false });
      }
    }

    if (finalPlayerId) {
      const payloadMembros = {
        perfil: newForm.is_spectator ? 'espectador' : 'jogador',
        position: newForm.is_spectator ? null : newForm.position,
        rating: newForm.is_spectator ? null : newForm.rating,
        shirt_number: newForm.is_spectator ? null : (newForm.shirt_number ? parseInt(newForm.shirt_number) : null),
        is_spectator: newForm.is_spectator,
        tipo_jogador: newForm.tipo_jogador,
        is_disabled: newForm.is_disabled,
        is_hidden: false
        // Ao CRIAR um usuário pela primeira vez, o próprio banco de dados já injetará a data_inclusao automaticamente.
      };

      const { data: jaVinculado } = await supabase.from("grupo_membros").select("player_id").eq("id_grupo", activeGroup.id_grupo).eq("player_id", finalPlayerId).maybeSingle();

      if (jaVinculado) {
        await supabase.from("grupo_membros").update(payloadMembros).eq("id_grupo", activeGroup.id_grupo).eq("player_id", finalPlayerId);
        alert("✅ Jogador readicionado com sucesso!");
      } else {
        await supabase.from("grupo_membros").insert({ id_grupo: activeGroup.id_grupo, player_id: finalPlayerId, ...payloadMembros });
        alert("✅ Jogador cadastrado com sucesso!");
      }
    }

    setNewForm(INITIAL_FORM);
    setShowNewForm(false);
    loadPlayers();
  };

  const handleEditSubmit = async (e, playerId) => {
    e.preventDefault();

    const phoneNormalizado = editForm.phone ? normalizePhone(editForm.phone) : null;
    
    if (editForm.tipo_jogador === "Mensalista" && (!phoneNormalizado || phoneNormalizado.length !== 11)) {
        alert("❌ O Mensalista deve obrigatoriamente ter o WhatsApp cadastrado.");
        return;
    }
    if (editForm.tipo_jogador === "Convidado" && phoneNormalizado && phoneNormalizado.length !== 11) {
        alert("❌ O WhatsApp está incompleto. Se não tiver, apague e deixe em branco.");
        return;
    }

    if (phoneNormalizado && phoneNormalizado.length === 11) {
       const { error: mergeError } = await supabase.rpc("mesclar_jogador_por_telefone", { p_ghost_id: playerId, p_phone: phoneNormalizado });
       if (mergeError) alert("❌ Erro ao tentar unificar o WhatsApp do jogador.");
    }

    await supabase.from("players").update({ name: editForm.name }).eq("id", playerId);

    // === LÓGICA DE DATA DE DESATIVAÇÃO (Para o Financeiro) ===
    // Verifica qual era o status original do jogador antes de salvar
    const jogadorAntigo = players.find(p => p.id === playerId);
    let novaDataDesativacao = undefined; // Undefined significa "não mexa nisso por padrão"

    // Se ele ERA ATIVO e agora está sendo DESATIVADO, grava a hora atual!
    if (!jogadorAntigo.is_disabled && editForm.is_disabled) {
      novaDataDesativacao = new Date().toISOString();
    } 
    // Se ele ERA DESATIVADO e agora está sendo REATIVADO, limpa a data!
    else if (jogadorAntigo.is_disabled && !editForm.is_disabled) {
      novaDataDesativacao = null;
    }

    const payloadMembros = {
      position: editForm.is_spectator ? null : editForm.position,
      rating: editForm.is_spectator ? null : editForm.rating,
      shirt_number: editForm.is_spectator ? null : (editForm.shirt_number ? parseInt(editForm.shirt_number) : null),
      is_spectator: editForm.is_spectator,
      tipo_jogador: editForm.tipo_jogador,
      is_disabled: editForm.is_disabled
    };

    // Só adiciona a coluna no update se houver mudança de status
    if (novaDataDesativacao !== undefined) {
      payloadMembros.data_desativacao = novaDataDesativacao;
    }

    await supabase.from("grupo_membros").update(payloadMembros).eq("id_grupo", activeGroup.id_grupo).eq("player_id", playerId);

    setEditingId(null);
    setTimeout(() => { loadPlayers(); }, 500); 
  };

  const toggleAdmin = async (jogadorId) => {
    const confirma = window.confirm("Deseja dar ou retirar o acesso de Administrador deste jogador?");
    if (!confirma) return;
    try {
      const jogador = players.find((p) => Number(p.id) === Number(jogadorId));
      if (!jogador) return;
      const { data: existingUser } = await supabase.from("users").select("id").eq("player_id", jogadorId).maybeSingle();
      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") {
          alert("❌ Este jogador não tem telefone. Cadastre primeiro.");
          return;
        }
        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        const senhaPadrao = phoneLimpo.slice(-4);
        await supabase.from("users").insert([{ phone: phoneLimpo, password: senhaPadrao, player_id: jogadorId, is_admin: false }]);
      }
      const novoPerfil = jogador.is_admin ? 'jogador' : 'admin';
      await supabase.from("grupo_membros").update({ perfil: novoPerfil }).eq("id_grupo", activeGroup.id_grupo).eq("player_id", jogadorId);
      alert(novoPerfil === 'admin' ? "✅ Jogador virou Administrador nesta pelada!" : "❌ Jogador perdeu o Admin.");
      await loadPlayers();
    } catch (e) { alert("❌ Erro inesperado."); }
  };

  const resetarSenha = async (jogadorId, nomeJogador) => {
    const novaSenha = window.prompt(`🔄 Digite a nova senha provisória para ${nomeJogador}:`);
    if (!novaSenha) return;
    if (!/^\d{4}$/.test(novaSenha)) return alert("❌ A senha deve ter exatamente 4 dígitos numéricos.");
    try {
      const jogador = players.find((p) => Number(p.id) === Number(jogadorId));
      if (!jogador) return;
      const { data: existingUser } = await supabase.from("users").select("id").eq("player_id", jogadorId).maybeSingle();
      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") return alert("❌ Cadastre o telefone primeiro.");
        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        await supabase.from("users").insert([{ phone: phoneLimpo, password: novaSenha, player_id: jogadorId, is_admin: false }]);
        alert(`✅ Usuário criado e senha definida!`);
      } else {
        await supabase.from("users").update({ password: novaSenha }).eq("player_id", jogadorId);
        alert(`✅ A senha foi alterada!`);
      }
      await loadPlayers();
    } catch (e) { console.error(e); }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      tipo_jogador: p.tipo_jogador || "Mensalista",
      name: p.name,
      rating: p.rating,
      position: p.position,
      shirt_number: p.shirt_number || "",
      phone: p.phone || "",
      is_spectator: Boolean(p.is_spectator),
      is_disabled: Boolean(p.is_disabled)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const jogadoresOrdenados = [...players].sort((a, b) => {
    if (a.is_disabled !== b.is_disabled) return a.is_disabled ? 1 : -1;
    if (a.id === user?.player_id) return -1;
    if (b.id === user?.player_id) return 1;
    if (a.is_admin && !b.is_admin) return -1;
    if (!a.is_admin && b.is_admin) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          style={{ width: "100%", padding: "16px", background: "#28a745", color: "white", fontSize: "16px", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 10px rgba(40,167,69,0.3)" }}
        >
          ➕ Adicionar Novo Jogador
        </button>
      ) : (
        <div style={{ background: "#fff", padding: "15px", borderRadius: "12px", border: "2px dashed #007bff", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0, color: "#007bff" }}>👥 Novo Jogador</h3>
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            
            <div style={{ marginBottom: "5px" }}>
               <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>Tipo de Jogador *</span>
               <select 
                 style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} 
                 value={newForm.tipo_jogador} 
                 onChange={(e) => setNewForm({ ...newForm, tipo_jogador: e.target.value })}
               >
                 <option value="Mensalista">Mensalista</option>
                 <option value="Convidado">Convidado</option>
               </select>
            </div>

            <div style={{ display: "flex", gap: "15px" }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: "block", textAlign: "left", paddingLeft: "4px", fontWeight: "bold", color: newForm.tipo_jogador === "Mensalista" ? "#d9534f" : "#374151", fontSize: "12px", marginBottom: "4px" }}>
                  📱 WhatsApp {newForm.tipo_jogador === "Mensalista" ? "(Obrigatório) *" : "(Opcional)"}
                </span>
                <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="(48) 99999-9999" type="tel" required={newForm.tipo_jogador === "Mensalista"} value={formatPhone(newForm.phone)} onChange={(e) => setNewForm({ ...newForm, phone: normalizePhone(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: "block", textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>👤 Nome *</span>
                <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="Nome" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "15px", marginTop: "4px", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input type="checkbox" checked={newForm.is_spectator} onChange={(e) => setNewForm({ ...newForm, is_spectator: e.target.checked }) } />
                <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>👀 Apenas espectador</span>
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#d9534f" }}>
                <input type="checkbox" checked={newForm.is_disabled} onChange={(e) => setNewForm({ ...newForm, is_disabled: e.target.checked }) } />
                <span style={{ fontSize: "13px", fontWeight: "bold" }}>🚫 Desativado</span>
              </label>
            </div>

            {!newForm.is_spectator && (
              <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                <div style={{ flex: 2 }}>
                  <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>⚽ Posição *</span>
                  <select style={{ width: "100%", boxSizing: "border-box" }} value={newForm.position} onChange={(e) => setNewForm({ ...newForm, position: e.target.value }) }>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>⭐ Classificação *</span>
                  <input style={{ width: "100%", boxSizing: "border-box" }} type="number" step="0.5" min="0.5" max="5" required value={newForm.rating} onChange={(e) => setNewForm({ ...newForm, rating: parseFloat(e.target.value) || 0 }) } title="Estrelas" />
                </div>
                <div style={{ flex: 1 }}>
                   <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>👕 N°</span>
                   <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="Nº" type="number" value={newForm.shirt_number} onChange={(e) => setNewForm({ ...newForm, shirt_number: e.target.value }) } />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button type="submit" style={{ flex: 1, padding: "12px", background: "#28a745", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Salvar</button>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ padding: "12px", background: "#6c757d", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ color: "#504e4e", margin: 0 }}>Elenco</h3>
        <span style={{ background: "#eee", padding: "4px 10px", borderRadius: "15px", fontSize: "14px", fontWeight: "bold" }}>
          {players.filter(p => !p.is_disabled).length} Ativos
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {jogadoresOrdenados.map((p) => {
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: "10px", borderLeft: p.is_disabled ? "6px solid #ccc" : "6px solid #667eea", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", overflow: "hidden", opacity: p.is_disabled ? 0.6 : 1 }}>
              {editingId !== p.id ? (
                <div style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "16px", color: p.is_disabled ? "#999" : "#333", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {!p.is_spectator && p.shirt_number ? <span style={{ color: p.is_disabled ? "#999" : "#007bff" }}>#{p.shirt_number}</span> : ""}
                      {p.name} 
                      <span style={{ fontSize: "14px" }}>{p.is_spectator ? "👀" : Boolean(p.is_admin) ? "🔑" : "⚽"}</span>
                      {p.is_disabled && <span style={{ fontSize: "10px", background: "#dc3545", color: "#fff", padding: "2px 6px", borderRadius: "4px" }}>DESATIVADO</span>}
                    </div>

                    <div style={{ marginTop: "4px", marginBottom: "4px" }}>
                       <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", background: p.tipo_jogador === "Mensalista" ? "#e0f2fe" : "#fef3c7", color: p.tipo_jogador === "Mensalista" ? "#0369a1" : "#b45309" }}>
                         {p.tipo_jogador.toUpperCase()}
                       </span>
                    </div>

                    {p.is_spectator ? (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Espectador</span>
                        {p.phone ? `📱 ${formatPhone(p.phone)}` : "Sem WhatsApp"}
                      </div>
                    ) : (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><CampoIcon size={14} />{p.position}  | ⭐ {p.rating}</span> 
                        {p.phone ? `📱 ${formatPhone(p.phone)}` : "Sem WhatsApp"}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch", minWidth: "110px" }}>
                    <button onClick={() => toggleAdmin(p.id)} disabled={p.id === user.player_id} style={{ background: p.id === user.player_id ? "#e9ecef" : "#ffffff", color: p.id === user.player_id ? "#a1a1a1" : "#333", border: p.id === user.player_id ? "1px solid #ddd" : "1px solid #ccc", borderRadius: "6px", cursor: p.id === user.player_id ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "bold", padding: "6px", width: "100%", textAlign: "center" }}>
                      {p.id === user.player_id ? "🔒 Você" : p.is_admin ? "🔑 Tirar Admin" : "⚽ Dar Admin"}
                    </button>
                    {!p.is_disabled && <button onClick={() => resetarSenha(p.id, p.name)} style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" }}>🔄 Resetar Senha</button>}
                    <button onClick={() => startEdit(p)} style={{ background: "#f8f9fa", color: "#555", border: "1px solid #ddd", padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" }}>✏️ Editar</button>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#ffffff", padding: "15px", borderRadius: "12px", border: "2px dashed #0022ff", marginBottom: "0px", opacity: 1 }}>
                  <form onSubmit={(e) => handleEditSubmit(e, p.id)} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    
                    <div style={{ marginBottom: "5px" }}>
                       <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>Tipo de Jogador *</span>
                       <select 
                         style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }} 
                         value={editForm.tipo_jogador} 
                         onChange={(e) => setEditForm({ ...editForm, tipo_jogador: e.target.value })}
                       >
                         <option value="Mensalista">Mensalista</option>
                         <option value="Convidado">Convidado</option>
                       </select>
                    </div>

                    <div style={{ display: "flex", gap: "15px" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: "block", textAlign: "left", paddingLeft: "4px", fontWeight: "bold", color: editForm.tipo_jogador === "Mensalista" ? "#d9534f" : "#374151", fontSize: "12px", marginBottom: "4px" }}>
                          📱 WhatsApp {editForm.tipo_jogador === "Mensalista" ? "(Obrigatório) *" : "(Opcional)"}
                        </span>
                        <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="(48) 99999-9999" type="tel" required={editForm.tipo_jogador === "Mensalista"} value={formatPhone(editForm.phone)} onChange={(e) => setEditForm({ ...editForm, phone: normalizePhone(e.target.value) }) } />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: "block", textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>👤 Nome *</span>
                        <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="Nome" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value }) } />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "15px", marginTop: "4px", flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input type="checkbox" checked={Boolean(editForm.is_spectator)} onChange={(e) => setEditForm({ ...editForm, is_spectator: e.target.checked }) } />
                        <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>👀 Apenas espectador</span>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#d9534f" }}>
                        <input type="checkbox" checked={Boolean(editForm.is_disabled)} onChange={(e) => setEditForm({ ...editForm, is_disabled: e.target.checked }) } />
                        <span style={{ fontSize: "13px", fontWeight: "bold" }}>🚫 Desativado</span>
                      </label>
                    </div>

                    {!editForm.is_spectator && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                        <div style={{ flex: 2 }}>
                           <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>⚽ Posição *</span>
                           <select style={{ width: "100%", boxSizing: "border-box" }} value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value }) }>
                             {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                           </select>
                        </div>
                        <div style={{ flex: 2 }}>
                           <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>⭐ Classificação *</span>
                           <input style={{ width: "100%", boxSizing: "border-box" }} type="number" step="0.5" min="0.5" max="5" required value={editForm.rating} onChange={(e) => setEditForm({ ...editForm, rating: parseFloat(e.target.value) || 0 }) } title="Estrelas" />
                        </div>
                        <div style={{ flex: 1 }}>
                           <span style={{ display: "block", color: "#374151", fontSize: "12px", marginBottom: "4px" }}>👕 N°</span>
                           <input style={{ width: "100%", boxSizing: "border-box" }} placeholder="Nº" type="number" value={editForm.shirt_number} onChange={(e) => setEditForm({ ...editForm, shirt_number: e.target.value }) } />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      <button type="submit" style={{ flex: 1, padding: "12px", background: "#0022ff", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Salvar Edição</button>
                      <button type="button" onClick={cancelEdit} style={{ padding: "12px", background: "#6c757d", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Cancelar</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}