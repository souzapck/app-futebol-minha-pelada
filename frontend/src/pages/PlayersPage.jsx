import { useEffect, useState } from "react";
import api from "../api.js";

const POSITIONS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
const INITIAL_FORM = { name: "", rating: 3, position: "MEI", shirt_number: "", phone: "" };

export default function PlayersPage({ user }) {
  const [players, setPlayers] = useState([]);
  
  // Controle para criação de novo jogador
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(INITIAL_FORM);

  // Controle para edição (qual ID está sendo editado no momento)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

   // Controle de perfil (Admin ou Jogador)
  const toggleAdmin = async (jogadorId) => {
    const confirma = window.confirm("Deseja dar ou retirar o acesso de Administrador deste jogador?");
    if (!confirma) return;

    try {
      const res = await api.put(`/users/${jogadorId}/admin`);
      alert(res.data.is_admin ? "✅ Agora este jogador é um Administrador!" : "❌ Este jogador perdeu o acesso de Administrador.");
      
      // MUDANÇA AQUI: Recarrega a lista para o ícone de bola virar chave na hora!
      loadPlayers();
      
    } catch (e) {
      alert("Erro: O jogador precisa ter um login cadastrado no sistema antes de virar Admin.");
    }
  };

  // Função para o Administrador resetar a senha de qualquer jogador
  const resetarSenha = async (jogadorId, nomeJogador) => {
    const novaSenha = window.prompt(`🔄 Digite a nova senha provisória para ${nomeJogador}:`);
    if (!novaSenha) return; // Se o admin cancelar, cancela a ação

    try {
      await api.put(`/users/${jogadorId}/password`, { new_password: novaSenha });
      alert(`✅ A senha de ${nomeJogador} foi alterada para: ${novaSenha}`);
    } catch (e) {
      // Pega a mensagem de erro que o Python mandou (ex: "Este jogador não tem telefone...")
      const erroReal = e.response?.data?.detail || "Erro desconhecido ao alterar senha.";
      alert(`❌ ${erroReal}`);
    }
  };


  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const res = await api.get("/players");
      setPlayers(res.data);
    } catch (err) {
      console.error("Erro ao carregar jogadores");
    }
  };

  // --- Função para CRIAR Novo Jogador ---
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...newForm,
      shirt_number: newForm.shirt_number ? parseInt(newForm.shirt_number) : null
    };

    await api.post("/players", payload);
    setNewForm(INITIAL_FORM);
    setShowNewForm(false);
    loadPlayers();
  };

  // --- Funções para EDITAR Jogador Existente ---
  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      rating: p.rating,
      position: p.position,
      shirt_number: p.shirt_number || "",
      phone: p.phone || ""
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditSubmit = async (e, playerId) => {
    e.preventDefault();
    const payload = {
      ...editForm,
      shirt_number: editForm.shirt_number ? parseInt(editForm.shirt_number) : null
    };

    await api.put(`/players/${playerId}`, payload);
    setEditingId(null);
    loadPlayers();
  };

  // --- REGRAS DE ORDENAÇÃO DA LISTA DE JOGADORES ---
  const jogadoresOrdenados = [...players].sort((a, b) => {
    // Regra 1: O usuário logado SEMPRE ganha e vai para o topo absoluto
    if (a.id === user?.player_id) return -1;
    if (b.id === user?.player_id) return 1;

    // Regra 2: Os Administradores (🔑) vêm logo em seguida
    if (a.is_admin && !b.is_admin) return -1;
    if (!a.is_admin && b.is_admin) return 1;

    // Regra 3: O resto da lista fica em Ordem Alfabética
    return a.name.localeCompare(b.name);
  });



  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* Botão Principal: Novo Jogador */}
      {!showNewForm ? (
        <button 
          onClick={() => setShowNewForm(true)} 
          style={{ width: "100%", padding: "16px", background: "#007bff", color: "white", fontSize: "16px", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 10px rgba(0,123,255,0.3)" }}
        >
          ➕ Adicionar Novo Jogador
        </button>
      ) : (
        /* Formulário de Novo Jogador (só aparece se clicar no botão acima) */
        <div style={{ 
          background: "#fff", 
          padding: "20px", 
          borderRadius: "16px", 
          border: "3px dashed #007bff", 
          marginBottom: "20px",
          boxShadow: "0 8px 25px rgba(0,123,255,0.15)"
        }}>
          <h3 style={{ margin: 0, color: "#007bff", fontSize: "22px", fontWeight: "bold", marginBottom: "20px" }}>
            👥 Novo Jogador
          </h3>
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* LABEL + INPUT */}
            <div>
              <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px", fontSize: "14px" }}>
                👤 Nome Completo *
              </label>
              <input 
                placeholder="Digite o nome completo" 
                required 
                value={newForm.name} 
                onChange={e => setNewForm({...newForm, name: e.target.value})}
                style={{
                  width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                  borderRadius: "10px", fontSize: "16px",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}
                onFocus={e => e.target.style.borderColor = "#3b82f6"}
                onBlur={e => e.target.style.borderColor = "#e5e7eb"}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  ⚽ Posição *
                </label>
                <select 
                  value={newForm.position} 
                  onChange={e => setNewForm({...newForm, position: e.target.value})}
                  style={{
                    width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                    borderRadius: "10px", fontSize: "16px", background: "white"
                  }}
                  onFocus={e => e.target.style.borderColor = "#8b5cf6"}
                  onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                >
                  <option value="">Selecione posição...</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  ⭐ Classificação (0,5 - 5)
                </label>
                <input 
                  type="number" step="0.5" min="0.5" max="5" 
                  value={newForm.rating} 
                  onChange={e => setNewForm({...newForm, rating: parseFloat(e.target.value) || 0})}
                  style={{
                    width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                    borderRadius: "10px", fontSize: "16px"
                  }}
                  onFocus={e => e.target.style.borderColor = "#10b981"}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  👕 Camisa
                </label>
                <input 
                  type="number" placeholder="10"
                  value={newForm.shirt_number} 
                  onChange={e => setNewForm({...newForm, shirt_number: e.target.value})}
                  style={{
                    width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                    borderRadius: "10px", fontSize: "16px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  📱 WhatsApp
                </label>
                <input 
                  type="tel" placeholder="(11) 99999-9999"
                  value={newForm.phone} 
                  onChange={e => setNewForm({...newForm, phone: e.target.value})}
                  style={{
                    width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                    borderRadius: "10px", fontSize: "16px"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" style={{
                flex: 1, padding: "14px", background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
                color: "white", fontWeight: "bold", border: "none", borderRadius: "12px", 
                fontSize: "16px", cursor: "pointer", boxShadow: "0 4px 15px rgba(59,130,246,0.4)"
              }}>
                💾 Salvar Jogador
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} style={{
                padding: "14px 20px", background: "#6b7280", color: "white", fontWeight: "bold", 
                border: "none", borderRadius: "12px", fontSize: "16px", cursor: "pointer"
              }}>
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Jogadores */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ color: "#333", margin: 0 }}>Elenco</h3>
        <span style={{ background: "#eee", padding: "4px 10px", borderRadius: "15px", fontSize: "14px", fontWeight: "bold" }}>{players.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {jogadoresOrdenados.map(p => (
          <div key={p.id} style={{ 
            background: "#fff", borderRadius: "10px", borderLeft: "6px solid #667eea", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", overflow: "hidden"
          }}>
            
            {/* Visualização Padrão do Card */}
            {editingId !== p.id ? (
              <div style={{ padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "16px", color: "#333" }}>
                    {p.shirt_number ? <span style={{ color: "#007bff", marginRight: "5px" }}>#{p.shirt_number}</span> : ""} 
                    {p.name} <span style={{ fontSize: "14px", marginLeft: "4px" }}>{p.is_admin ? "🔑" : "⚽"}</span>                    
                  </div>

                  <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                    ⚽ {p.position} | ⭐ {p.rating} {p.phone && `| 📱 ${p.phone}`}
                  </div>
                </div>
                              
                {/* CAIXA DOS BOTÕES (Organiza um em cima do outro na direita) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch", minWidth: "110px" }}>
                  
                  {/* BOTÃO DE ADMIN */}
                  <button 
                    onClick={() => toggleAdmin(p.id)}
                    disabled={p.id === user.player_id}
                    style={{ 
                        background: p.id === user.player_id ? "#e9ecef" : "#ffffff", 
                        color: p.id === user.player_id ? "#a1a1a1" : "#333", 
                        border: p.id === user.player_id ? "1px solid #ddd" : "1px solid #ccc", 
                        borderRadius: "6px", cursor: p.id === user.player_id ? "not-allowed" : "pointer", 
                        fontSize: "13px", fontWeight: "bold", padding: "6px", width: "100%", textAlign: "center",
                        boxShadow: p.id !== user.player_id ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                    }}
                  >
                    {p.id === user.player_id ? "🔒 Você" : p.is_admin ? "🔑 Tirar Admin" : "⚽ Dar Admin"}
                  </button>                
                  
                  {/* NOVO: BOTÃO DE RESETAR SENHA */}
                  <button 
                    onClick={() => resetarSenha(p.id, p.name)} 
                    style={{ 
                      background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", 
                      padding: "6px", borderRadius: "6px", cursor: "pointer", 
                      fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" 
                    }}
                  >
                    🔄 Resetar Senha
                  </button>

                  {/* BOTÃO DE EDITAR */}
                  <button 
                    onClick={() => startEdit(p)} 
                    style={{ 
                      background: "#f8f9fa", color: "#555", border: "1px solid #ddd", 
                      padding: "6px", borderRadius: "6px", cursor: "pointer", 
                      fontSize: "13px", fontWeight: "bold", width: "100%", textAlign: "center" 
                    }}
                  >
                    ✏️ Editar
                  </button>

                </div>
                 
              </div>
            ) : (
              
            {/* Formulário de Edição Expandido */}
            {editingId === p.id && (
              <div style={{ 
                padding: "20px", 
                background: "#fdfdfd", 
                borderTop: "3px solid #10b981", 
                borderRadius: "0 0 16px 16px",
                boxShadow: "0 4px 20px rgba(16,185,129,0.15)"
              }}>
                <h4 style={{ 
                  margin: "0 0 20px 0", 
                  color: "#059669", 
                  fontSize: "20px", 
                  fontWeight: "bold" 
                }}>
                  ✏️ Editando: {p.name}
                </h4>
                
                <form onSubmit={(e) => handleEditSubmit(e, p.id)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {/* MESMO LAYOUT DO NOVO */}
                  <div>
                    <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px", fontSize: "14px" }}>
                      👤 Nome Completo *
                    </label>
                    <input 
                      placeholder="Nome completo" 
                      required 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      style={{
                        width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                        borderRadius: "10px", fontSize: "16px",
                        transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}
                      onFocus={e => e.target.style.borderColor = "#3b82f6"}
                      onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                        ⚽ Posição *
                      </label>
                      <select 
                        value={editForm.position} 
                        onChange={e => setEditForm({...editForm, position: e.target.value})}
                        style={{
                          width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                          borderRadius: "10px", fontSize: "16px", background: "white"
                        }}
                        onFocus={e => e.target.style.borderColor = "#8b5cf6"}
                      >
                        <option value="">Selecione...</option>
                        {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                        ⭐ Classificação (0,5 - 5)
                      </label>
                      <input 
                        type="number" step="0.5" min="0.5" max="5" 
                        value={editForm.rating} 
                        onChange={e => setEditForm({...editForm, rating: parseFloat(e.target.value) || 0})}
                        style={{
                          width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                          borderRadius: "10px", fontSize: "16px"
                        }}
                        onFocus={e => e.target.style.borderColor = "#10b981"}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                        👕 Camisa
                      </label>
                      <input 
                        type="number" placeholder="10"
                        value={editForm.shirt_number || ""} 
                        onChange={e => setEditForm({...editForm, shirt_number: e.target.value})}
                        style={{
                          width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                          borderRadius: "10px", fontSize: "16px"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                        📱 WhatsApp
                      </label>
                      <input 
                        type="tel" placeholder="(11) 99999-9999"
                        value={editForm.phone || ""} 
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        style={{
                          width: "100%", padding: "12px 16px", border: "2px solid #e5e7eb", 
                          borderRadius: "10px", fontSize: "16px"
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button type="submit" style={{
                      flex: 1, padding: "14px", 
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", 
                      color: "white", fontWeight: "bold", border: "none", borderRadius: "12px", 
                      fontSize: "16px", cursor: "pointer", boxShadow: "0 4px 15px rgba(16,185,129,0.4)"
                    }}>
                      ✅ Atualizar Jogador
                    </button>
                    <button type="button" onClick={cancelEdit} style={{
                      padding: "14px 20px", background: "#ef4444", color: "white", 
                      fontWeight: "bold", border: "none", borderRadius: "12px", fontSize: "16px", cursor: "pointer"
                    }}>
                      ❌ Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}


            )}
          </div>
        ))}
      </div>

    </div>
  );
}
