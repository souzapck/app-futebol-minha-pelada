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
  name: "",
  rating: 3,
  position: "MEI",
  shirt_number: "",
  phone: "",
  is_spectator: false
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
      // === BUSCA CORRETA: Bate na grupo_membros e puxa apenas os dados globais de players ===
      const { data: membrosData, error: membrosError } = await supabase
        .from("grupo_membros")
        .select(`
          perfil, position, rating, shirt_number, is_spectator,
          players!inner(id, name, phone)
        `)
        .eq("id_grupo", activeGroup.id_grupo)
        .eq("is_hidden", false)
        .neq("player_id", 1); // <--- ADICIONE ESTA LINHA (Esconde o Master Admin)

      if (membrosError) {
        console.error("Erro ao carregar jogadores da pelada:", membrosError);
        return;
      }

      // Achata os dados para o layout do React continuar funcionando igual
      const playersList = (membrosData || []).map((m) => ({
        id: m.players.id,
        name: m.players.name,
        phone: m.players.phone,
        position: m.position,
        rating: m.rating,
        shirt_number: m.shirt_number,
        is_spectator: m.is_spectator,
        is_admin: m.perfil === "admin"
      }));

      setPlayers(playersList);
    } catch (err) {
      console.error("Erro geral ao carregar jogadores:", err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const phoneNormalizado = newForm.phone ? normalizePhone(newForm.phone) : null;

    if (phoneNormalizado && phoneNormalizado.length !== 11) {
      alert("❌ O telefone deve ter 11 dígitos com DDD.");
      return;
    }

    let finalPlayerId = null;

    // 1. Busca se o cara já existe na plataforma global (players)
    if (phoneNormalizado) {
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id")
        .eq("phone", phoneNormalizado)
        .maybeSingle();

      if (existingPlayer) finalPlayerId = existingPlayer.id;
    }

    // 2. Se não existir, cria o cadastro global dele (Apenas Nome e Telefone)
    if (!finalPlayerId) {
      const { data: createdPlayer, error: insertError } = await supabase
        .from("players")
        .insert({ 
          name: newForm.name, 
          phone: phoneNormalizado
        })
        .select()
        .maybeSingle();

      if (insertError) {
        if (insertError.code === '23505') {
          alert("⚠️ Este telefone já pertence a um jogador oculto. Peça suporte ao Master.");
        } else {
          alert(`❌ Erro ao criar jogador na base global: ${insertError.message}`);
        }
        return;
      }
      
      if (createdPlayer) {
        finalPlayerId = createdPlayer.id;
      }

      // Cria a senha de acesso padrão caso tenha telefone
      if (phoneNormalizado && finalPlayerId) {
        const senhaPadrao = phoneNormalizado.slice(-4);
        await supabase.from("users").insert({
            phone: phoneNormalizado,
            password: senhaPadrao,
            player_id: finalPlayerId,
            is_admin: false
        });
      }
    }

    // 3. Salva o Vínculo (Camisa, posição e estrelas EXCLUSIVAS desta pelada)
    if (finalPlayerId) {
      const { data: jaVinculado } = await supabase
        .from("grupo_membros")
        .select("player_id")
        .eq("id_grupo", activeGroup.id_grupo)
        .eq("player_id", finalPlayerId)
        .maybeSingle();

      const payloadMembros = {
        perfil: newForm.is_spectator ? 'espectador' : 'jogador',
        position: newForm.is_spectator ? null : newForm.position,
        rating: newForm.is_spectator ? null : newForm.rating,
        shirt_number: newForm.is_spectator ? null : (newForm.shirt_number ? parseInt(newForm.shirt_number) : null),
        is_spectator: newForm.is_spectator,
        is_hidden: false
      };

      if (jaVinculado) {
        const { error: updateError } = await supabase
          .from("grupo_membros")
          .update(payloadMembros)
          .eq("id_grupo", activeGroup.id_grupo)
          .eq("player_id", finalPlayerId);
          
        if (updateError) alert(`⚠️ Erro ao atualizar vínculo: ${updateError.message}`);
        else alert("✅ Jogador readicionado/atualizado com sucesso na pelada!");
      } else {
        const { error: insertMembrosError } = await supabase
          .from("grupo_membros")
          .insert({
            id_grupo: activeGroup.id_grupo,
            player_id: finalPlayerId,
            ...payloadMembros
          });
          
        if (insertMembrosError) alert(`⚠️ Erro ao vincular à pelada: ${insertMembrosError.message}`);
        else alert("✅ Jogador vinculado à pelada com sucesso!");
      }
    }

    setNewForm(INITIAL_FORM);
    setShowNewForm(false);
    loadPlayers();
  };

  const toggleAdmin = async (jogadorId) => {
    const confirma = window.confirm("Deseja dar ou retirar o acesso de Administrador deste jogador?");
    if (!confirma) return;

    try {
      const jogador = players.find((p) => Number(p.id) === Number(jogadorId));
      if (!jogador) return;

      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("player_id", jogadorId)
        .maybeSingle();

      if (userError) throw userError;

      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") {
          alert("❌ Este jogador não tem telefone. Cadastre primeiro.");
          return;
        }

        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        const senhaPadrao = phoneLimpo.slice(-4);
        const { error: insertError } = await supabase
          .from("users")
          .insert([{ phone: phoneLimpo, password: senhaPadrao, player_id: jogadorId, is_admin: false }]);

        if (insertError) {
          alert(`❌ Erro ao criar usuário base: ${insertError.message}`);
          return;
        }
      }

      const novoPerfil = jogador.is_admin ? 'jogador' : 'admin';
      await supabase
        .from("grupo_membros")
        .update({ perfil: novoPerfil })
        .eq("id_grupo", activeGroup.id_grupo)
        .eq("player_id", jogadorId);

      alert(novoPerfil === 'admin' ? "✅ Jogador virou Administrador nesta pelada!" : "❌ Jogador perdeu o Admin nesta pelada.");
      await loadPlayers();
    } catch (e) {
      console.error(e);
      alert("❌ Erro inesperado.");
    }
  };

  const resetarSenha = async (jogadorId, nomeJogador) => {
    const novaSenha = window.prompt(`🔄 Digite a nova senha provisória para ${nomeJogador}:`);
    if (!novaSenha) return;

    if (!/^\d{4}$/.test(novaSenha)) {
      alert("❌ A senha deve ter exatamente 4 dígitos numéricos.");
      return;
    }

    try {
      const jogador = players.find((p) => Number(p.id) === Number(jogadorId));
      if (!jogador) return;

      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("player_id", jogadorId)
        .maybeSingle();

      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") {
          alert("❌ Cadastre o telefone primeiro.");
          return;
        }
        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        await supabase.from("users").insert([{ phone: phoneLimpo, password: novaSenha, player_id: jogadorId, is_admin: false }]);
        alert(`✅ Usuário criado e senha definida!`);
      } else {
        await supabase.from("users").update({ password: novaSenha }).eq("player_id", jogadorId);
        alert(`✅ A senha foi alterada para: ${novaSenha}`);
      }
      await loadPlayers();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      rating: p.rating,
      position: p.position,
      shirt_number: p.shirt_number || "",
      phone: p.phone || "",
      is_spectator: Boolean(p.is_spectator)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditSubmit = async (e, playerId) => {
    e.preventDefault();

    const phoneNormalizado = editForm.phone ? normalizePhone(editForm.phone) : null;
    if (phoneNormalizado && phoneNormalizado.length !== 11) {
      alert("❌ O telefone deve ter 11 dígitos.");
      return;
    }

    // 1. Atualiza Nome e Telefone Global (Tabela Players)
    await supabase.from("players").update({ name: editForm.name, phone: phoneNormalizado }).eq("id", playerId);

    // Se mudou o telefone, tenta atualizar no login também
    const { data: existingUser } = await supabase.from("users").select("id").eq("player_id", playerId).maybeSingle();
    if (existingUser && phoneNormalizado) {
      await supabase.from("users").update({ phone: phoneNormalizado }).eq("player_id", playerId);
    } else if (existingUser && !phoneNormalizado) {
      await supabase.from("users").update({ phone: null }).eq("player_id", playerId);
    }

    // 2. Atualiza Estatísticas e Camisa Locais (Tabela grupo_membros)
    const payloadMembros = {
      position: editForm.is_spectator ? null : editForm.position,
      rating: editForm.is_spectator ? null : editForm.rating,
      shirt_number: editForm.is_spectator ? null : (editForm.shirt_number ? parseInt(editForm.shirt_number) : null),
      is_spectator: editForm.is_spectator
    };

    const { error: membroError } = await supabase
      .from("grupo_membros")
      .update(payloadMembros)
      .eq("id_grupo", activeGroup.id_grupo)
      .eq("player_id", playerId);

    if (membroError) {
      alert("❌ Erro ao atualizar estatísticas da pelada.");
    }

    setEditingId(null);
    loadPlayers();
  };

  const jogadoresOrdenados = [...players].sort((a, b) => {
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
            <div style={{ display: "flex", gap: "200px" }}>
              <span style={{ textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px" }}>👤 Nome *</span>
              <span style={{ width: "80px", color: "#374151", fontSize: "12px" }}>📱 WhatsApp</span>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <input style={{ flex: 1 }} placeholder="Nome *" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
              <input placeholder="WhatsApp" type="tel" value={formatPhone(newForm.phone)} onChange={(e) => setNewForm({ ...newForm, phone: normalizePhone(e.target.value) })} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <input type="checkbox" checked={newForm.is_spectator} onChange={(e) => setNewForm({ ...newForm, is_spectator: e.target.checked }) } />
              <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>👀 Apenas espectador</span>
            </div>

            {!newForm.is_spectator && (
              <>
                <div style={{ display: "flex", gap: "35px" }}>
                  <span style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</span>
                  <span style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</span>
                  <span style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</span>
                </div>

                <div style={{ display: "flex", gap: "50px" }}>
                  <select style={{ flex: 2 }} value={newForm.position} onChange={(e) => setNewForm({ ...newForm, position: e.target.value }) }>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input style={{ flex: 2 }} type="number" step="0.5" min="0.5" max="5" required value={newForm.rating} onChange={(e) => setNewForm({ ...newForm, rating: parseFloat(e.target.value) || 0 }) } title="Estrelas" />
                  <input style={{ width: "70px" }} placeholder="Nº 👕" type="number" value={newForm.shirt_number} onChange={(e) => setNewForm({ ...newForm, shirt_number: e.target.value }) } />
                </div>
              </>
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
        <span style={{ background: "#eee", padding: "4px 10px", borderRadius: "15px", fontSize: "14px", fontWeight: "bold" }}>{players.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {jogadoresOrdenados.map((p) => {
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: "10px", borderLeft: "6px solid #667eea", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              {editingId !== p.id ? (
                <div style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "16px", color: "#333" }}>
                      {!p.is_spectator && p.shirt_number ? <span style={{ color: "#007bff", marginRight: "5px" }}>#{p.shirt_number}</span> : ""}
                      {p.name} <span style={{ fontSize: "14px", marginLeft: "4px" }}>{p.is_spectator ? "👀" : Boolean(p.is_admin) ? "🔑" : "⚽"}</span>
                    </div>

                    {p.is_spectator ? (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Espectador</span>
                        {p.phone && `📱 ${formatPhone(p.phone)}`}
                      </div>
                    ) : (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><CampoIcon size={14} />{p.position}  | ⭐ {p.rating}</span> 
                        {p.phone && `📱 ${formatPhone(p.phone)}`}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch", minWidth: "110px" }}>
                    <button onClick={() => toggleAdmin(p.id)} disabled={p.id === user.player_id} style={{ background: p.id === user.player_id ? "#e9ecef" : "#ffffff", color: p.id === user.player_id ? "#a1a1a1" : "#333", border: p.id === user.player_id ? "1px solid #ddd" : "1px solid #ccc", borderRadius: "6px", cursor: p.id === user.player_id ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "bold", padding: "6px", width: "100%", textAlign: "center", boxShadow: p.id !== user.player_id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                      {p.id === user.player_id ? "🔒 Você" : p.is_admin ? "🔑 Tirar Admin" : "⚽ Dar Admin"}
                    </button>
                    <button onClick={() => resetarSenha(p.id, p.name)} style={{ background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" }}>🔄 Resetar Senha</button>
                    <button onClick={() => startEdit(p)} style={{ background: "#f8f9fa", color: "#555", border: "1px solid #ddd", padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" }}>✏️ Editar</button>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#ffffff", padding: "15px", borderRadius: "12px", border: "2px dashed #0022ff", marginBottom: "0px" }}>
                  <form onSubmit={(e) => handleEditSubmit(e, p.id)} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "200px" }}>
                      <span style={{ textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px" }}>👤 Nome *</span>
                      <span style={{ width: "80px", color: "#374151", fontSize: "12px" }}>📱 WhatsApp</span>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <input style={{ flex: 1 }} placeholder="Nome *" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value }) } />
                      <input placeholder="WhatsApp" type="tel" value={formatPhone(editForm.phone)} onChange={(e) => setEditForm({ ...editForm, phone: normalizePhone(e.target.value) }) } />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <input type="checkbox" checked={Boolean(editForm.is_spectator)} onChange={(e) => setEditForm({ ...editForm, is_spectator: e.target.checked }) } />
                      <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>👀 Apenas espectador</span>
                    </div>

                    {!editForm.is_spectator && (
                      <>
                        <div style={{ display: "flex", gap: "35px" }}>
                          <span style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</span>
                          <span style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</span>
                          <span style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</span>
                        </div>

                        <div style={{ display: "flex", gap: "35px" }}>
                          <select style={{ flex: 2 }} value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value }) }>
                            {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                          </select>
                          <input style={{ flex: 2 }} type="number" step="0.5" min="0.5" max="5" required value={editForm.rating} onChange={(e) => setEditForm({ ...editForm, rating: parseFloat(e.target.value) || 0 }) } title="Estrelas" />
                          <input style={{ width: "70px" }} placeholder="Nº 👕" type="number" value={editForm.shirt_number} onChange={(e) => setEditForm({ ...editForm, shirt_number: e.target.value }) } />
                        </div>
                      </>
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