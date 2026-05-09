import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const normalizePhone = (value) => value.replace(/\D/g, "").slice(0, 11);

const formatPhone = (value) => {
  const digits = normalizePhone(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export default function LoginPage({ onLoginSuccess }) {
  // Controle de qual tela mostrar: 'login', 'requestForm', 'requestSuccess'
  const [view, setView] = useState("login"); 

  // Estados do Login
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  
  // Estados da Solicitação de Grupo
  const [reqPhone, setReqPhone] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqGroup, setReqGroup] = useState("");

  // Estados Globais da tela
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (phone.length !== 11) {
      setErro("❌ Digite um celular com DDD e 11 números.");
      return;
    }

    setErro("");
    setLoading(true);

    const { data, error } = await supabase.rpc("login_user", {
      p_phone: phone,
      p_password: password
    });

    if (error || !data || data.length === 0) {
      setErro("❌ Telefone ou senha incorretos.");
      setLoading(false);
      return;
    }

    const playerId = data[0].player_id;
    let finalUserGroups = data[0].user_groups || [];

    // === MODO DEUS (MASTER ADMIN) ⚡ ===
    // Se o player_id for 1, ignoramos o que o banco mandou e buscamos TODAS as peladas
    if (playerId === 1) {
      const { data: allGroups, error: allGroupsError } = await supabase
        .from("grupos_pelada")
        .select("*")
        .order("id_grupo", { ascending: true }); // Ordena pelas mais antigas primeiro

      if (!allGroupsError && allGroups) {
        finalUserGroups = allGroups.map((g) => ({
          ...g, // <--- A MÁGICA É AQUI! Isso copia TODAS as colunas do banco (incluindo a foto!)
          id_grupo: g.id || g.id_grupo,
          nome_grupo: g.nome_grupo,
          perfil: "admin" // Master tem poder de Admin em todas
        }));
      }
    }
    // ===================================

    const userData = {
      id: data[0].id,
      phone: data[0].phone,
      player_id: playerId,
      players: {
        name: data[0].player_name,
        position: data[0].player_position,
        shirt_number: data[0].player_shirt_number
      },
      user_groups: finalUserGroups // Entrega a lista com superpoderes para o App
    };

    const session = {
      user: userData,
      expiresAt: Date.now() + (10 * 60 * 1000),
      lastActivityAt: Date.now()
    };

    localStorage.setItem("session", JSON.stringify(session));
    setLoading(false);
    onLoginSuccess(userData);
  };

  const handleRequestGroup = async (e) => {
    e.preventDefault();
    
    if (reqPhone.length !== 11) {
      setErro("❌ Digite um celular com DDD e 11 números.");
      return;
    }
    if (!reqName.trim() || !reqGroup.trim()) {
      setErro("❌ Preencha todos os campos.");
      return;
    }

    setErro("");
    setLoading(true);

    try {
      const { data: existente, error: erroBusca } = await supabase
        .from("solicitacoes_grupo")
        .select("id")
        .eq("telefone_usuario", reqPhone)
        .eq("status", "pendente")
        .limit(1);

      if (erroBusca) throw erroBusca;

      if (existente && existente.length > 0) {
        setErro("⏳ Você já possui uma solicitação em análise para este número. Aguarde nosso contato!");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("solicitacoes_grupo")
        .insert({
          telefone_usuario: reqPhone,
          nome_responsavel: reqName,
          nome_pelada: reqGroup
        });

      if (error) throw error;

      setView("requestSuccess");
    } catch (err) {
      console.error("Erro ao solicitar grupo:", err);
      setErro("❌ Ocorreu um erro ao enviar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
    backgroundColor: "#fff",
    color: "#333"
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      
      <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", border: "1px solid #eaeaea" }}>
        
        {erro && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", fontWeight: "bold" }}>
            {erro}
          </div>
        )}

        {/* ======================= TELA DE LOGIN ======================= */}
        {view === "login" && (
          <>
            <h2 style={{ color: "#333", marginBottom: "10px", marginTop: "0" }}>Bem-vindo!</h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "25px" }}>
              Faça login para gerenciar sua pelada.
            </p>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Celular (com DDD)</label>
                <input
                  type="tel"
                  placeholder="(48) 98765-4321"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(normalizePhone(e.target.value))}
                  required
                  maxLength={15}
                  style={inputStyle}
                />
              </div>

              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Senha (Últimos 4 dígitos)</label>
                <input 
                  type="password" 
                  placeholder="Ex: 4321" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength="4"
                  style={{ ...inputStyle, letterSpacing: "3px" }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || phone.length !== 11}
                style={{ 
                  background: (loading || phone.length !== 11) ? "#ccc" : "#28a745", 
                  color: "white",
                  padding: "14px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: (loading || phone.length !== 11) ? "not-allowed" : "pointer",
                  marginTop: "10px"
                }}
              >
                {loading ? "Entrando..." : "⚽ Entrar no Vestiário"}
              </button>
            </form>

            <div style={{ marginTop: "25px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>Ainda não tem o app para o seu grupo?</p>
              <button 
                onClick={() => { setView("requestForm"); setErro(""); }}
                style={{ background: "none", border: "none", color: "#007bff", fontWeight: "bold", cursor: "pointer", fontSize: "15px", textDecoration: "underline" }}
              >
                🚀 Cadastre sua Pelada aqui
              </button>
            </div>
          </>
        )}

        {/* ======================= TELA DE SOLICITAÇÃO ======================= */}
        {view === "requestForm" && (
          <>
            <h2 style={{ color: "#007bff", marginBottom: "10px", marginTop: "0" }}>Assine o App</h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "25px", lineHeight: "1.4" }}>
              Preencha os dados abaixo para solicitar a criação do seu grupo. Entraremos em contato!
            </p>

            <form onSubmit={handleRequestGroup} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Seu Nome</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Nome da Pelada</label>
                <input
                  type="text"
                  placeholder="Ex: Futebol de Quinta"
                  value={reqGroup}
                  onChange={(e) => setReqGroup(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ textAlign: "left" }}>
                <label style={{ fontSize: "14px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Seu Celular (WhatsApp)</label>
                <input
                  type="tel"
                  placeholder="(48) 98765-4321"
                  value={formatPhone(reqPhone)}
                  onChange={(e) => setReqPhone(normalizePhone(e.target.value))}
                  required
                  maxLength={15}
                  style={inputStyle}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || reqPhone.length !== 11}
                style={{ 
                  background: (loading || reqPhone.length !== 11) ? "#ccc" : "#007bff", 
                  color: "white",
                  padding: "14px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: (loading || reqPhone.length !== 11) ? "not-allowed" : "pointer",
                  marginTop: "10px",
                  boxShadow: (loading || reqPhone.length !== 11) ? "none" : "0 4px 10px rgba(0,123,255,0.3)"
                }}
              >
                {loading ? "Enviando..." : "Enviar Solicitação"}
              </button>
            </form>

            <div style={{ marginTop: "20px" }}>
              <button 
                onClick={() => { setView("login"); setErro(""); }}
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "14px", textDecoration: "underline" }}
              >
                Voltar para o Login
              </button>
            </div>
          </>
        )}

        {/* ======================= TELA DE SUCESSO ======================= */}
        {view === "requestSuccess" && (
          <div style={{ padding: "20px 0" }}>
            <h2 style={{ marginTop: 0, color: "#f59f00", fontSize: "24px" }}>⏳ Em Análise</h2>
            <p style={{ color: "#555", fontSize: "15px", lineHeight: "1.6", margin: "20px 0" }}>
              Sua solicitação para criar a pelada <strong>{reqGroup}</strong> foi enviada com sucesso!
            </p>
            <div style={{ background: "#fff9db", border: "1px solid #f1c40f", borderRadius: "8px", padding: "15px", fontSize: "14px", color: "#856404", marginBottom: "25px" }}>
              Nossa equipe entrará em contato pelo WhatsApp <strong>{formatPhone(reqPhone)}</strong> em breve para liberar seu acesso!
            </div>
            
            <button 
              onClick={() => { setView("login"); setReqPhone(""); setReqGroup(""); setReqName(""); }}
              style={{ background: "#f8f9fa", border: "1px solid #ccc", padding: "10px 20px", borderRadius: "8px", color: "#333", cursor: "pointer", fontWeight: "bold" }}
            >
              Voltar ao Início
            </button>
          </div>
        )}

      </div>
    </div>
  );
}