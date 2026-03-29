import { supabase } from "../supabaseClient";
import { useEffect, useState } from "react";
import CampoIcon from "../components/icons/CampoIcon";


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

  const toggleAdmin = async (jogadorId) => {
    const confirma = window.confirm(
      "Deseja dar ou retirar o acesso de Administrador deste jogador?"
    );
    if (!confirma) return;

    try {
      const jogador = players.find((p) => Number(p.id) === Number(jogadorId));

      if (!jogador) {
        alert("❌ Jogador não encontrado.");
        return;
      }

      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("id, player_id, phone, password, is_admin")
        .eq("player_id", jogadorId)
        .maybeSingle();

      if (userError) {
        console.error(userError);
        alert("❌ Erro ao localizar o usuário do jogador.");
        return;
      }

      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") {
          alert("❌ Este jogador não tem telefone. Cadastre o telefone primeiro.");
          return;
        }

        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        if (phoneLimpo.length !== 11) {
          alert("❌ O telefone do jogador precisa ter 11 dígitos.");
          return;
        }

        const senhaPadrao = phoneLimpo.slice(-4);

        const { error: insertError } = await supabase
          .from("users")
          .insert([
            {
              phone: phoneLimpo,
              password: senhaPadrao,
              player_id: jogadorId,
              is_admin: true
            }
          ]);

        if (insertError) {
          console.error(insertError);
          alert(`❌ Erro ao criar acesso de admin: ${insertError.message}`);
          return;
        }

        alert("✅ Usuário criado e acesso de Administrador concedido!");
      } else {
        const novoValorAdmin = !Boolean(existingUser.is_admin);

        const { error: updateError } = await supabase
          .from("users")
          .update({ is_admin: novoValorAdmin })
          .eq("player_id", jogadorId);

        if (updateError) {
          console.error(updateError);
          alert(`❌ Erro ao alterar acesso de admin: ${updateError.message}`);
          return;
        }

        alert(
          novoValorAdmin
            ? "✅ Agora este jogador é um Administrador!"
            : "❌ Este jogador perdeu o acesso de Administrador."
        );
      }

      await loadPlayers();
    } catch (e) {
      console.error(e);
      alert("❌ Erro inesperado ao alterar perfil de admin.");
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

      if (!jogador) {
        alert("❌ Jogador não encontrado.");
        return;
      }

      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("id, player_id, phone")
        .eq("player_id", jogadorId)
        .maybeSingle();

      if (userError) {
        console.error(userError);
        alert("❌ Erro ao localizar o usuário do jogador.");
        return;
      }

      if (!existingUser) {
        if (!jogador.phone || String(jogador.phone).trim() === "") {
          alert("❌ Este jogador não tem telefone. Cadastre o telefone primeiro.");
          return;
        }

        const phoneLimpo = String(jogador.phone).replace(/\D/g, "");
        if (phoneLimpo.length !== 11) {
          alert("❌ O telefone do jogador precisa ter 11 dígitos.");
          return;
        }

        const { error: insertError } = await supabase
          .from("users")
          .insert([
            {
              phone: phoneLimpo,
              password: novaSenha,
              player_id: jogadorId,
              is_admin: false
            }
          ]);

        if (insertError) {
          console.error(insertError);
          alert(`❌ Erro ao criar usuário: ${insertError.message}`);
          return;
        }

        alert(`✅ Usuário criado e senha definida para ${nomeJogador}!`);
      } else {
        const { error: updateError } = await supabase
          .from("users")
          .update({ password: novaSenha })
          .eq("player_id", jogadorId);

        if (updateError) {
          console.error(updateError);
          alert(`❌ Erro ao alterar senha: ${updateError.message}`);
          return;
        }

        alert(`✅ A senha de ${nomeJogador} foi alterada para: ${novaSenha}`);
      }

      await loadPlayers();
    } catch (e) {
      console.error(e);
      alert("❌ Erro inesperado ao resetar senha.");
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("*")
        .eq("is_hidden", false);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("player_id, is_admin");

      if (playersError || usersError) {
        console.error("Erro ao carregar jogadores/admins:", playersError || usersError);
        return;
      }

      const playersComAdmin = (playersData || []).map((player) => {
        const userMatch = (usersData || []).find(
          (u) => Number(u.player_id) === Number(player.id)
        );

        return {
          ...player,
          is_admin: Boolean(userMatch?.is_admin),
          is_spectator: Boolean(player.is_spectator)
        };
      });

      setPlayers(playersComAdmin);
    } catch (err) {
      console.error("Erro geral ao carregar jogadores:", err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...newForm,
      phone: newForm.phone ? normalizePhone(newForm.phone) : null,
      position: newForm.is_spectator ? null : newForm.position,
      rating: newForm.is_spectator ? null : newForm.rating,
      shirt_number: newForm.is_spectator
        ? null
        : newForm.shirt_number
        ? parseInt(newForm.shirt_number)
        : null
    };

    if (payload.phone && payload.phone.length !== 11) {
      alert("❌ O telefone deve ter 11 dígitos com DDD.");
      return;
    }

    const { data: createdPlayer, error } = await supabase
      .from("players")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar jogador:", error);

      if (String(error.message).toLowerCase().includes("duplicate")) {
        alert("❌ Já existe um jogador com este telefone.");
      } else {
        alert("❌ Erro ao criar jogador");
      }
      return;
    }

    if (payload.phone) {
      const senhaPadrao = payload.phone.slice(-4);

      const { error: userError } = await supabase
        .from("users")
        .insert([
          {
            phone: payload.phone,
            password: senhaPadrao,
            player_id: createdPlayer.id,
            is_admin: false
          }
        ]);

      if (userError) {
        console.error("Erro ao criar usuário:", userError);

        if (String(userError.message).toLowerCase().includes("duplicate")) {
          alert("❌ Jogador criado, mas já existe um login com este telefone.");
        } else {
          alert(`❌ Jogador criado, mas houve erro ao criar login: ${userError.message}`);
        }
      }
    }

    setNewForm(INITIAL_FORM);
    setShowNewForm(false);
    loadPlayers();
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

    const payload = {
      ...editForm,
      phone: phoneNormalizado,
      shirt_number: editForm.is_spectator
        ? undefined
        : editForm.shirt_number
        ? parseInt(editForm.shirt_number)
        : null,
      position: editForm.is_spectator ? undefined : editForm.position,
      rating: editForm.is_spectator ? undefined : editForm.rating
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    if (payload.phone && payload.phone.length !== 11) {
      alert("❌ O telefone deve ter 11 dígitos com DDD.");
      return;
    }

    const { error } = await supabase
      .from("players")
      .update(payload)
      .eq("id", playerId);

    if (error) {
      console.error("Erro ao editar jogador:", error);
      alert("❌ Erro ao editar jogador");
      return;
    }

    const { data: existingUser, error: userFetchError } = await supabase
      .from("users")
      .select("id, player_id")
      .eq("player_id", playerId)
      .maybeSingle();

    if (userFetchError) {
      console.error("Erro ao localizar usuário:", userFetchError);
      alert(`❌ Jogador editado, mas houve erro ao localizar login: ${userFetchError.message}`);
      setEditingId(null);
      loadPlayers();
      return;
    }

    if (existingUser) {
      if (payload.phone) {
        const senhaPadrao = payload.phone.slice(-4);

        const { error: updateUserError } = await supabase
          .from("users")
          .update({
            phone: payload.phone,
            password: senhaPadrao
          })
          .eq("player_id", playerId);

        if (updateUserError) {
          console.error("Erro ao atualizar usuário:", updateUserError);
          alert(`❌ Jogador editado, mas houve erro ao atualizar login: ${updateUserError.message}`);
        }
      } else {
        const { error: updateUserError } = await supabase
          .from("users")
          .update({
            phone: null
          })
          .eq("player_id", playerId);

        if (updateUserError) {
          console.error("Erro ao limpar telefone do usuário:", updateUserError);
          alert(`❌ Jogador editado, mas houve erro ao limpar telefone do login: ${updateUserError.message}`);
        }
      }
    } else if (payload.phone) {
      const senhaPadrao = payload.phone.slice(-4);

      const { error: insertUserError } = await supabase
        .from("users")
        .insert([
          {
            phone: payload.phone,
            password: senhaPadrao,
            player_id: playerId,
            is_admin: false
          }
        ]);

      if (insertUserError) {
        console.error("Erro ao criar usuário:", insertUserError);
        alert(`❌ Jogador editado, mas houve erro ao criar login: ${insertUserError.message}`);
      }
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
          style={{
            width: "100%",
            padding: "16px",
            background: "#28a745",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            marginBottom: 20,
            boxShadow: "0 4px 10px rgba(0,123,255,0.3)"
          }}
        >
          ➕ Adicionar Novo Jogador
        </button>
      ) : (
        <div
          style={{
            background: "#fff",
            padding: "15px",
            borderRadius: "12px",
            border: "2px dashed #007bff",
            marginBottom: "20px"
          }}
        >
          <h3 style={{ marginTop: 0, color: "#007bff" }}>👥 Novo Jogador</h3>
          <form
            onSubmit={handleCreateSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div style={{ display: "flex", gap: "200px" }}>
              <span
                style={{
                  textAlign: "left",
                  paddingLeft: "4px",
                  fontWeight: "500",
                  color: "#374151",
                  fontSize: "12px"
                }}
              >
                👤 Nome *
              </span>
              <span style={{ width: "80px", color: "#374151", fontSize: "12px" }}>
                📱 WhatsApp
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                style={{ flex: 1 }}
                placeholder="Nome *"
                required
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              />
              <input
                placeholder="WhatsApp"
                type="tel"
                value={formatPhone(newForm.phone)}
                onChange={(e) =>
                  setNewForm({ ...newForm, phone: normalizePhone(e.target.value) })
                }
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <input
                type="checkbox"
                checked={newForm.is_spectator}
                onChange={(e) =>
                  setNewForm({
                    ...newForm,
                    is_spectator: e.target.checked
                  })
                }
              />
              <span
                style={{
                  fontSize: "13px",
                  color: "#374151",
                  fontWeight: "500"
                }}
              >
                👀 Apenas espectador
              </span>
            </div>

            {!newForm.is_spectator && (
              <>
                <div style={{ display: "flex", gap: "35px" }}>
                  <span style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</span>
                  <span style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</span>
                  <span style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</span>
                </div>

                <div style={{ display: "flex", gap: "50px" }}>
                  <select
                    style={{ flex: 2 }}
                    value={newForm.position}
                    onChange={(e) =>
                      setNewForm({ ...newForm, position: e.target.value })
                    }
                  >
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <input
                    style={{ flex: 2 }}
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    required
                    value={newForm.rating}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        rating: parseFloat(e.target.value) || 0
                      })
                    }
                    title="Estrelas"
                  />

                  <input
                    style={{ width: "70px" }}
                    placeholder="Nº 👕"
                    type="number"
                    value={newForm.shirt_number}
                    onChange={(e) =>
                      setNewForm({ ...newForm, shirt_number: e.target.value })
                    }
                  />

                  <span style={{ color: "#374151", fontSize: "12px", width: "70px" }}></span>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#28a745",
                  color: "white",
                  fontWeight: "bold",
                  border: "none",
                  borderRadius: "8px"
                }}
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                style={{
                  padding: "12px",
                  background: "#6c757d",
                  color: "white",
                  fontWeight: "bold",
                  border: "none",
                  borderRadius: "8px"
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px"
        }}
      >
        <h3 style={{ color: "#504e4e", margin: 0 }}>Elenco</h3>
        <span
          style={{
            background: "#eee",
            padding: "4px 10px",
            borderRadius: "15px",
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          {players.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {jogadoresOrdenados.map((p) => {
          const isMasterAdmin = p.phone === "00000000000";

          return (
            <div
              key={p.id}
              style={{
                background: "#fff",
                borderRadius: "10px",
                borderLeft: "6px solid #667eea",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                overflow: "hidden"
              }}
            >
              {editingId !== p.id ? (
                <div
                  style={{
                    padding: "15px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "16px", color: "#333" }}>
                      {!p.is_spectator && p.shirt_number ? (
                        <span style={{ color: "#007bff", marginRight: "5px" }}>
                          #{p.shirt_number}
                        </span>
                      ) : (
                        ""
                      )}
                      {p.name}{" "}
                      <span style={{ fontSize: "14px", marginLeft: "4px" }}>
                        {p.is_spectator ? "👀" : Boolean(p.is_admin) ? "🔑" : "⚽"}
                      </span>
                    </div>

                    {p.is_spectator ? (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          Espectador
                        </span>
                          {p.phone && `📱 ${formatPhone(p.phone)}`}
                      </div>
                    ) : (
                      <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <CampoIcon size={14} />
                          {p.position}  | ⭐ {p.rating}
                        </span> {p.phone && `📱 ${formatPhone(p.phone)}`}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "stretch",
                      minWidth: "110px"
                    }}
                  >
                    <button
                      onClick={() => toggleAdmin(p.id)}
                      disabled={p.id === user.player_id}
                      style={{
                        background: p.id === user.player_id ? "#e9ecef" : "#ffffff",
                        color: p.id === user.player_id ? "#a1a1a1" : "#333",
                        border: p.id === user.player_id ? "1px solid #ddd" : "1px solid #ccc",
                        borderRadius: "6px",
                        cursor: p.id === user.player_id ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: "bold",
                        padding: "6px",
                        width: "100%",
                        textAlign: "center",
                        boxShadow:
                          p.id !== user.player_id ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                      }}
                    >
                      {p.id === user.player_id
                        ? "🔒 Você"
                        : p.is_admin
                        ? "🔑 Tirar Admin"
                        : "⚽ Dar Admin"}
                    </button>

                    <button
                      onClick={() => resetarSenha(p.id, p.name)}
                      style={{
                        background: "#fff3cd",
                        color: "#856404",
                        border: "1px solid #ffeeba",
                        padding: "6px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "bold",
                        width: "100%",
                        textAlign: "center"
                      }}
                    >
                      🔄 Resetar Senha
                    </button>

                    <button
                      onClick={() => startEdit(p)}
                      style={{
                        background: "#f8f9fa",
                        color: "#555",
                        border: "1px solid #ddd",
                        padding: "6px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "bold",
                        width: "100%",
                        textAlign: "center"
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "#ffffff",
                    padding: "15px",
                    borderRadius: "12px",
                    border: "2px dashed #0022ff",
                    marginBottom: "0px"
                  }}
                >
                  <form
                    onSubmit={(e) => handleEditSubmit(e, p.id)}
                    style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                  >
                    <div style={{ display: "flex", gap: "200px" }}>
                      <span
                        style={{
                          textAlign: "left",
                          paddingLeft: "4px",
                          fontWeight: "500",
                          color: "#374151",
                          fontSize: "12px"
                        }}
                      >
                        👤 Nome *
                      </span>
                      <span style={{ width: "80px", color: "#374151", fontSize: "12px" }}>
                        📱 WhatsApp
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <input
                        style={{ flex: 1 }}
                        placeholder="Nome *"
                        required
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                      <input
                        placeholder="WhatsApp"
                        type="tel"
                        value={formatPhone(editForm.phone)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            phone: normalizePhone(e.target.value)
                          })
                        }
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.is_spectator)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            is_spectator: e.target.checked
                          })
                        }
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#374151",
                          fontWeight: "500"
                        }}
                      >
                        👀 Apenas espectador
                      </span>
                    </div>

                    {!editForm.is_spectator && (
                      <>
                        <div style={{ display: "flex", gap: "35px" }}>
                          <span style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</span>
                          <span style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</span>
                          <span style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</span>
                        </div>

                        <div style={{ display: "flex", gap: "35px" }}>
                          <select
                            style={{ flex: 2 }}
                            value={editForm.position}
                            onChange={(e) =>
                              setEditForm({ ...editForm, position: e.target.value })
                            }
                          >
                            {POSITIONS.map((pos) => (
                              <option key={pos} value={pos}>
                                {pos}
                              </option>
                            ))}
                          </select>

                          <input
                            style={{ flex: 2 }}
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="5"
                            required
                            value={editForm.rating}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                rating: parseFloat(e.target.value) || 0
                              })
                            }
                            title="Estrelas"
                          />

                          <input
                            style={{ width: "70px" }}
                            placeholder="Nº 👕"
                            type="number"
                            value={editForm.shirt_number}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                shirt_number: e.target.value
                              })
                            }
                          />
                          <span style={{ color: "#374151", fontSize: "12px", width: "70px" }}></span>
                        </div>
                      </>
                    )}

                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      <button
                        type="submit"
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: "#0022ff",
                          color: "white",
                          fontWeight: "bold",
                          border: "none",
                          borderRadius: "8px"
                        }}
                      >
                        Salvar Edição
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          padding: "12px",
                          background: "#6c757d",
                          color: "white",
                          fontWeight: "bold",
                          border: "none",
                          borderRadius: "8px"
                        }}
                      >
                        Cancelar
                      </button>
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