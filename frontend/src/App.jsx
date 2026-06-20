import React, { useEffect, useState } from "react";
import AdminRequestsPage from "./pages/AdminRequestsPage.jsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.jsx";
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

  // === ESTADOS PARA A BARRA DE NAVEGAÇÃO MINIMIZADA ===
  const [isNavMinimized, setIsNavMinimized] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

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

  // === LÓGICA DE ESCONDER/MOSTRAR MENU AO ROLAR A TELA ===
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsNavMinimized(true);
        setShowUserMenu(false);
      } 
      else if (currentScrollY < lastScrollY) {
        setIsNavMinimized(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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
    setIsNavMinimized(false);
    setView(nextView);
    renovarSessao();
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleSendSupport = async (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setSendingSupport(true);
    try {
      let telefone = user?.players?.phone || user?.phone;
      
      if (!telefone) {
        const { data: playerData } = await supabase
          .from("players")
          .select("phone")
          .eq("id", user.player_id)
          .maybeSingle();
          
        telefone = playerData?.phone || "Sem contato";
      }

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

  // === ESTILIZAÇÃO AVANÇADA DOS BOTÕES ===
  const tabButtonStyle = (isActive, isMenu = false) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    // Pílula verde no fundo apenas para o botão ativo
    background: isActive ? "#e8f5e9" : "transparent",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    padding: "8px 0",
    margin: "0 2px",
    flex: 1,
    // Cor de destaque verde se ativo, chumbo se for o Menu, e cinza para os inativos
    color: isActive ? "#28a745" : (isMenu ? "#444" : "#6c757d"),
    fontWeight: isActive ? "900" : (isMenu ? "bold" : "normal"),
    // Esmaece os botões que não estão clicados (exceto o Menu)
    opacity: isActive || isMenu ? 1 : 0.4,
    // Leve zoom no botão selecionado
    transform: isActive ? "scale(1.05)" : "scale(1)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  });

  const isMenuView = ["settings", "players", "requests", "admin_messages"].includes(view);

  return (
    <div style={{ padding: "20px 20px 100px 20px", maxWidth: "600px", margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      
      {/* CABEÇALHO DO APLICATIVO */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px", background: "#fff", padding: "10px 15px",
          borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
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

          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: "bold", color: "#333", fontSize: "14px" }}>
              {user?.players?.name}
            </div>
            <div style={{ fontSize: "11px", color: isAdmin ? "#dc3545" : "#888", fontWeight: isAdmin ? "bold" : "normal" }}>
              {isAdmin ? "🔑 Administrador" : "⚽ Jogador"} | {activeGroup?.nome_grupo}
            </div>
          </div>
        </div>
      </div>

      {/* LOGO DA PELADA */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
        <img 
          src={activeGroup?.logo_url || "/logo-app.webp"} 
          alt={`Escudo da pelada ${activeGroup?.nome_grupo || ''}`}          
          style={{ width: "140px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
      </div>

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

      {/* === PÍLULA MINIMIZADA (Aparece quando a barra desce) === */}
      <div
        onClick={() => setIsNavMinimized(false)}
        style={{
          position: "fixed",
          bottom: isNavMinimized ? "calc(env(safe-area-inset-bottom) + 15px)" : "-60px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "#fff",
          padding: "10px 24px",
          borderRadius: "30px",
          fontSize: "13px",
          fontWeight: "bold",
          boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
          zIndex: 1001,
          cursor: "pointer",
          transition: "bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <span style={{ fontSize: "16px" }}>👆</span> Menu
      </div>

      {/* NAVEGAÇÃO FIXA MODERNA NO RODAPÉ */}
      <div 
        style={{ 
          position: "fixed", 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: "#ffffff", 
          borderTop: "1px solid #eee", 
          boxShadow: "0 -3px 12px rgba(0,0,0,0.08)", 
          zIndex: 1000, 
          paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)",
          transform: isNavMinimized ? "translateY(100%)" : "translateY(0)",
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: "65px", padding: "0 6px", position: "relative" }}>
          
          <button onClick={() => handleChangeView("matches")} style={tabButtonStyle(view === "matches")}>
            <span style={{ fontSize: "20px" }}>👍🏽</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Confirmação</span>
          </button>

          <button onClick={() => handleChangeView("teams")} style={tabButtonStyle(view === "teams")}>
            <span style={{ fontSize: "20px" }}>🆎</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Escalação</span>
          </button>

          <button onClick={() => handleChangeView("voting")} style={tabButtonStyle(view === "voting")}>
            <span style={{ fontSize: "20px" }}>🗳️</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Votação</span>
          </button>

          <button onClick={() => handleChangeView("ranking")} style={tabButtonStyle(view === "ranking")}>
            <span style={{ fontSize: "20px" }}>🏆</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Ranking</span>
          </button>

          {/* ABA DO MENU DE OPÇÕES (ABRE DA PARTE INFERIOR PARA CIMA) */}
          <button onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); renovarSessao(); }} style={tabButtonStyle(isMenuView || showUserMenu, true)}>
            <span style={{ fontSize: "20px" }}>☰</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Menu</span>
          </button>

          {/* COMPONENTE DO MENU FLUTUANTE (POPOVER INVERTIDO) */}
          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", bottom: "75px", right: "15px", background: "#fff", border: "1px solid #ddd",
                borderRadius: "12px", boxShadow: "0 -6px 20px rgba(0,0,0,0.15)", minWidth: "200px", zIndex: 2000, overflow: "hidden", display: "flex", flexDirection: "column"
              }}
            >
              {/* SEÇÃO EXCLUSIVA DO DONO DO APP (SUPER ADMIN) */}
              {Number(user.player_id) === 1 && (
                <>
                  <div style={{ padding: "6px 14px", background: "#f8f9fa", fontSize: "10px", fontWeight: "bold", color: "#999", textAlign: "left" }}>SISTEMA</div>
                  <button onClick={() => handleChangeView("requests")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "requests" ? "#ffb300" : "#333", borderBottom: "1px solid #f5f5f5" }}>📋 Solicitações Geral</button>
                  <button onClick={() => handleChangeView("admin_messages")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "admin_messages" ? "#ffb300" : "#333", borderBottom: "1px solid #f5f5f5" }}>✉️ Caixa de Suporte</button>
                </>
              )}

              {/* SEÇÃO DO ADMINISTRADOR DA PELADA */}
              {isAdmin && (
                <>
                  <div style={{ padding: "6px 14px", background: "#f8f9fa", fontSize: "10px", fontWeight: "bold", color: "#999", textAlign: "left" }}>GERENCIAR PELADA</div>
                  <button onClick={() => handleChangeView("settings")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "settings" ? "#28a745" : "#333", borderBottom: "1px solid #f5f5f5" }}>⚙️ Configurações</button>
                  <button onClick={() => handleChangeView("players")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "players" ? "#28a745" : "#333", borderBottom: "1px solid #f5f5f5" }}>👤 Modificar Jogadores</button>
                  <button onClick={() => { setShowUserMenu(false); setSupportModalOpen(true); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#ffc107", borderBottom: "1px solid #f5f5f5" }}>📢 Chamar Suporte</button>
                </>
              )}

              {/* SEÇÃO DE CONTA E SESSÃO GERAL */}
              <div style={{ padding: "6px 14px", background: "#f8f9fa", fontSize: "10px", fontWeight: "bold", color: "#999", textAlign: "left" }}>SUA CONTA</div>
              {(user.user_groups?.length > 1) && (
                <button onClick={() => { setShowUserMenu(false); clearGroup(); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#007bff", borderBottom: "1px solid #f5f5f5" }}>🔄 Trocar de Pelada</button>
              )}
              <button onClick={() => { setShowUserMenu(false); mudarSenha(); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#333", borderBottom: "1px solid #f5f5f5" }}>🔑 Alterar Senha</button>
              <button onClick={() => handleLogout()} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#dc3545" }}>🚪 Sair do App</button>
            </div>
          )}
        </div>
      </div>

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