import React, { useEffect, useState } from "react";
import AdminRequestsPage from "./pages/AdminRequestsPage.jsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.jsx"; // NOVO COMPONENTE
import SettingsPage from "./pages/SettingsPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import VotingPage from "./pages/VotingPage.jsx";
import CreateGroupPage from "./pages/CreateGroupPage.jsx";
import GroupSelectionPage from "./pages/GroupSelectionPage.jsx";
import { GroupProvider, useGroup } from "./contexts/GroupContext";

import "./App.css";
import { supabase } from "./supabaseClient";

function AppContent() {
  const [view, setView] = useState("matches");
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // === ESTADOS PARA O MODAL DE SUPORTE ===
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  // === ESTADO PARA O MENU DO SUPER ADMIN ===
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const { activeGroup, changeGroup, clearGroup, isAdmin } = useGroup();

  const SESSION_DURATION = 10 * 60 * 1000; 

  const renovarSessao = () => {
    const session = localStorage.getItem("session");
    if (!session) return;

    try {
      const parsed = JSON.parse(session);
      const novaSession = {
        ...parsed,
        expiresAt: Date.now() + SESSION_DURATION,
        lastActivityAt: Date.now()
      };
      localStorage.setItem("session", JSON.stringify(novaSession));
    } catch (error) {
      console.error("Erro ao renovar sessão:", error);
    }
  };

  useEffect(() => {
    const session = localStorage.getItem("session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (Date.now() > parsed.expiresAt) {
          localStorage.removeItem("session");
          setUser(null);
        } else {
          setUser(parsed.user);
        }
      } catch (error) {
        console.error("Erro ao ler sessão:", error);
        localStorage.removeItem("session");
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const session = localStorage.getItem("session");
      if (!session) return;
      try {
        const parsed = JSON.parse(session);
        if (Date.now() > parsed.expiresAt) {
          alert("⏱️ Sessão expirada. Faça login novamente.");
          localStorage.removeItem("session");
          setUser(null);
          setShowUserMenu(false);
          clearGroup(); 
        }
      } catch (error) {
        console.error("Erro ao validar sessão:", error);
        localStorage.removeItem("session");
        setUser(null);
        setShowUserMenu(false);
        clearGroup();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [clearGroup]);

  useEffect(() => {
    if (!user) return;
    let throttleTimeout = null;

    const handleActivity = () => {
      if (throttleTimeout) return;
      renovarSessao();
      throttleTimeout = setTimeout(() => { throttleTimeout = null; }, 30000);
    };

    const events = ["click", "keydown", "mousemove", "touchstart"];
    events.forEach((event) => { window.addEventListener(event, handleActivity); });

    return () => {
      events.forEach((event) => { window.removeEventListener(event, handleActivity); });
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    if (user && !activeGroup) {
      const grupos = user.user_groups || [];
      if (grupos.length === 1) {
        changeGroup(grupos[0]);
      }
    }
  }, [user, activeGroup, changeGroup]);

  const mudarSenha = async () => {
    const novaSenha = window.prompt("🔑 Digite a sua nova senha:");
    if (!novaSenha) return;

    if (!/^\d{4}$/.test(novaSenha)) {
      alert("❌ A senha deve ter exatamente 4 dígitos numéricos.");
      return;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ password: novaSenha })
        .eq("player_id", user.player_id);

      if (error) throw error;
      alert("✅ Senha alterada com sucesso!");
    } catch (e) {
      alert(`❌ Erro: ${e.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("session");
    setUser(null);
    setShowUserMenu(false);
    clearGroup(); 
  };

  const handleChangeView = (nextView) => {
    setShowUserMenu(false);
    setShowAdminMenu(false);
    setView(nextView);
    renovarSessao();
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

// === FUNÇÃO DE ENVIO DE SUPORTE ===
  const handleSendSupport = async (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setSendingSupport(true);
    try {
      // 1. Tenta pegar da sessão, se não achar, busca direto do banco de dados na hora!
      let telefone = user?.players?.phone || user?.phone;
      
      if (!telefone) {
        const { data: playerData } = await supabase
          .from("players")
          .select("phone")
          .eq("id", user.player_id)
          .maybeSingle();
          
        telefone = playerData?.phone || "Sem contato";
      }

      // 2. Grava a mensagem com o telefone garantido
      const { error } = await supabase
        .from("suporte_mensagens")
        .insert([{
          id_grupo: activeGroup?.id_grupo,
          nome_usuario: user?.players?.name || user?.name || "Desconhecido",
          telefone_usuario: telefone,
          mensagem: supportMessage.trim()
        }]);

      if (error) throw error;

      alert("🚀 Mensagem enviada com sucesso! Obrigado pelo contato.");
      setSupportMessage("");
      setSupportModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao enviar mensagem.");
    } finally {
      setSendingSupport(false);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
          <img src="/logo-app.webp" alt="Gestor de Peladas" style={{ width: "150px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
        </div>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (!activeGroup) {
    const grupos = user.user_groups || [];

    if (grupos.length === 0) {
      return <CreateGroupPage user={user} />;
    }

    if (grupos.length > 1) {
      return <GroupSelectionPage user={user} onGroupSelected={() => {}} />;
    }

    return <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>Entrando no Vestiário...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      
      {/* CABEÇALHO DO APLICATIVO */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px", background: "#fff", padding: "10px 15px",
          borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              background: "#007bff", color: "white", width: "35px", height: "35px",
              borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: "bold", fontSize: "18px", overflow: "hidden"
            }}
          >
            {user?.players?.name?.charAt(0)}
          </div>

          <div>
            <div style={{ fontWeight: "bold", color: "#333" }}>
              {user?.players?.name}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: isAdmin ? "#dc3545" : "#888",
                fontWeight: isAdmin ? "bold" : "normal"
              }}
            >
              {isAdmin ? "🔑 Administrador" : "⚽ Jogador"} | {activeGroup?.nome_grupo}
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowUserMenu((prev) => !prev); renovarSessao(); }}
            style={{
              background: "#f8f9fa", color: "#333", border: "1px solid #ddd", borderRadius: "8px",
              padding: "8px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "14px"
            }}
          >
            ☰ Menu
          </button>

          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", top: "42px", right: 0, background: "#fff", border: "1px solid #ddd",
                borderRadius: "10px", boxShadow: "0 6px 18px rgba(0,0,0,0.12)", minWidth: "170px", zIndex: 20, overflow: "hidden"
              }}
            >
              {(user.user_groups?.length > 1) && (
                <button
                  onClick={() => { setShowUserMenu(false); clearGroup(); }}
                  style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#007bff", borderBottom: "1px solid #eee" }}
                >
                  🔄 Trocar Pelada
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => { setShowUserMenu(false); setSupportModalOpen(true); }}
                  style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#ffc107", borderBottom: "1px solid #eee" }}
                >
                  📢 Enviar Suporte
                </button>
              )}

              <button
                onClick={() => { setShowUserMenu(false); mudarSenha(); }}
                style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#333", borderBottom: "1px solid #eee" }}
              >
                🔑 Trocar Senha
              </button>

              <button
                onClick={() => { handleLogout(); }}
                style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#dc3545" }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LOGO DA PELADA */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
        <img 
          src={activeGroup?.logo_url || "/logo-app.webp"} 
          alt={`Escudo da pelada ${activeGroup?.nome_grupo || ''}`}          
          style={{ width: "180px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
      </div>

      {/* NAVEGAÇÃO PRINCIPAL */}
      <nav style={{ marginBottom: 30, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
        
        {/* BOTÃO DO SUPER ADMIN (Abre Submenu) */}
        {Number(user.player_id) === 1 && (
          <div style={{ position: "relative" }}>
            <button 
              onClick={() => setShowAdminMenu(!showAdminMenu)} 
              style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: (view === "requests" || view === "admin_messages") ? "#ffc107" : "#eee", color: "#333" }}
            >
              👑 Administração
            </button>
            {showAdminMenu && (
              <div style={{ position: "absolute", top: "45px", left: "50%", transform: "translateX(-50%)", background: "#fff", border: "1px solid #ccc", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, overflow: "hidden", minWidth: "150px" }}>
                <button onClick={() => handleChangeView("requests")} style={{ width: "100%", padding: "10px", border: "none", background: "#fff", cursor: "pointer", borderBottom: "1px solid #eee", fontWeight: "bold", color: "#333" }}>📋 Solicitações</button>
                <button onClick={() => handleChangeView("admin_messages")} style={{ width: "100%", padding: "10px", border: "none", background: "#fff", cursor: "pointer", fontWeight: "bold", color: "#333" }}>✉️ Suporte</button>
              </div>
            )}
          </div>
        )}        

        {isAdmin && (
          <button onClick={() => handleChangeView("settings")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "settings" ? "#28a745" : "#eee", color: view === "settings" ? "white" : "#333" }}>
            ⚙️ Configurações
          </button>
        )}

        {isAdmin && (
          <button onClick={() => handleChangeView("players")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "players" ? "#28a745" : "#eee", color: view === "players" ? "white" : "#333" }}>
          👤 Jogadores
          </button>
        )}
        <button onClick={() => handleChangeView("matches")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "matches" ? "#28a745" : "#eee", color: view === "matches" ? "white" : "#333" }}>
          👍🏽 Confirmação
        </button>
        <button onClick={() => handleChangeView("teams")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "teams" ? "#28a745" : "#eee", color: view === "teams" ? "white" : "#333" }}>
          🆎 Escalação
        </button>
        <button onClick={() => handleChangeView("voting")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "voting" ? "#28a745" : "#eee", color: view === "voting" ? "white" : "#333" }}>
          🗳️ Votação
        </button>        
        <button onClick={() => handleChangeView("ranking")} style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "ranking" ? "#28a745" : "#eee", color: view === "ranking" ? "white" : "#333" }}>
          🏆 Ranking
        </button>
      </nav>

      {/* ÁREA DE CONTEÚDO (PÁGINAS) */}
      <main>
        {view === "requests" && Number(user.player_id) === 1 && <AdminRequestsPage />}
        {view === "admin_messages" && Number(user.player_id) === 1 && <AdminMessagesPage />}
        {view === "settings" && isAdmin && <SettingsPage user={user} />}
        {view === "players" && isAdmin && <PlayersPage user={user} />}
        {view === "matches" && <MatchesPage user={user} />}
        {view === "teams" && <TeamsPage user={user} />}
        {view === "voting" && <VotingPage user={user} />}
        {view === "ranking" && <RankingPage />}
      </main>

      {/* === MODAL DE SUPORTE === */}
      {supportModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "450px", background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
              🛠️ Enviar Feedback ou Relatar Bug
            </h3>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px", lineHeight: "1.4" }}>
              Encontrou um erro ou tem uma sugestão? Descreva abaixo. Sua mensagem será enviada junto com o nome do seu grupo para análise.
            </p>

            <form onSubmit={handleSendSupport}>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Descreva detalhadamente..."
                required
                rows={5}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: "15px", fontFamily: "inherit" }}
              />

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button 
                  type="button"
                  onClick={() => { setSupportModalOpen(false); setSupportMessage(""); }}
                  disabled={sendingSupport}
                  style={{ padding: "10px 14px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={sendingSupport || !supportMessage.trim()}
                  style={{ padding: "10px 14px", background: (sendingSupport || !supportMessage.trim()) ? "#ced4da" : "#007bff", color: "#fff", border: "none", borderRadius: "8px", cursor: (sendingSupport || !supportMessage.trim()) ? "not-allowed" : "pointer", fontWeight: "bold" }}
                >
                  {sendingSupport ? "Enviando..." : "🚀 Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <GroupProvider>
      <AppContent />
    </GroupProvider>
  );
}