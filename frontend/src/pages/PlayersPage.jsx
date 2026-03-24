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
          style={{ width: "100%", padding: "16px", background: "#28a745", color: "white", fontSize: "16px", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 10px rgba(0,123,255,0.3)" }}
        >
          ➕ Adicionar Novo Jogador
        </button>
      ) : (
        /* Formulário de Novo Jogador (só aparece se clicar no botão acima) */
        <div style={{ background: "#fff", padding: "15px", borderRadius: "12px", border: "2px dashed #007bff", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0, color: "#007bff" }}>👥 Novo Jogador</h3>
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "200px" }}> 
              <spam style={{textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px" }}>👤 Nome *</spam>
              <spam style={{width: "80px", color: "#374151", fontSize: "12px" }}>📱 WhatsApp</spam>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>                                              
              <input style={{ flex: 1 }} placeholder="Nome *" required value={newForm.name} onChange={e => setNewForm({...newForm, name: e.target.value})} />
              <input  placeholder="WhatsApp" type="tel" value={newForm.phone} onChange={e => setNewForm({...newForm, phone: e.target.value})} />      
            </div>            
            <div style={{ display: "flex", gap: "35px" }}>
              <spam style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</spam>
              <spam style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</spam>              
              <spam style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</spam>
            </div>
            <div style={{ display: "flex", gap: "50px" }}>
              <select style={{ flex: 2}}  value={newForm.position} onChange={e => setNewForm({...newForm, position: e.target.value})}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select> 
              <input style={{ flex: 2}} type="number" step="0.5" min="0.5" max="5" required value={newForm.rating} onChange={e => setNewForm({...newForm, rating: parseFloat(e.target.value) || 0})} title="Estrelas"/>             
              <input style={{ width: "70px"}}  placeholder="Nº 👕" type="number" value={newForm.shirt_number} onChange={e => setNewForm({...newForm, shirt_number: e.target.value})} />                            
              <spam style={{ color: "#374151", fontSize: "12px", width: "70px" }}></spam>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button type="submit" style={{ flex: 1, padding: "12px", background: "#28a745", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Salvar</button>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ padding: "12px", background: "#6c757d", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Cancelar</button>
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
             
/* Formulário de Edição Expandido (aparece DENTRO do próprio cartão) */
              <div style={{ background: "#ffffff", padding: "15px", borderRadius: "12px", border: "2px dashed #0022ff", marginBottom: "0px" }}>
                <form onSubmit={(e) => handleEditSubmit(e, p.id)} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "200px" }}> 
                    <span style={{textAlign: "left", paddingLeft: "4px", fontWeight: "500", color: "#374151", fontSize: "12px" }}>👤 Nome *</span>
                    <span style={{width: "80px", color: "#374151", fontSize: "12px" }}>📱 WhatsApp</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>                                      
                    <input style={{ flex: 1 }} placeholder="Nome *" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                    <input  placeholder="WhatsApp" type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />      
                  </div>            
                  <div style={{ display: "flex", gap: "35px" }}>
                    <span style={{ color: "#374151", fontSize: "12px" }}>⚽ Posição *</span>
                    <span style={{ color: "#374151", fontSize: "12px" }}>⭐ Classificação *</span>              
                    <span style={{ color: "#374151", fontSize: "12px" }}>👕 Camisa Nº</span>
                  </div>
                  <div style={{ display: "flex", gap: "50px" }}>
                    <select style={{ flex: 2}}  value={editForm.position} onChange={e => setEditForm({...editForm, position: e.target.value})}>
                      {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select> 
                    <input style={{ flex: 2}} type="number" step="0.5" min="0.5" max="5" required value={editForm.rating} onChange={e => setEditForm({...editForm, rating: parseFloat(e.target.value) || 0})} title="Estrelas"/>            
                    <input style={{ width: "70px"}}  placeholder="Nº 👕" type="number" value={editForm.shirt_number} onChange={e => setEditForm({...editForm, shirt_number: e.target.value})} />                            
                    <span style={{ color: "#374151", fontSize: "12px", width: "70px" }}></span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button type="submit" style={{ flex: 1, padding: "12px", background: "#0022ff", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Salvar Edição</button>
                    <button type="button" onClick={cancelEdit} style={{ padding: "12px", background: "#6c757d", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px" }}>Cancelar</button>
                  </div>
                </form>
              </div>

            )}
          </div>
        ))}
      </div>


    </div>
  );
}