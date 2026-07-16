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
import FinancePage from "./pages/FinancePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { GroupProvider, useGroup } from "./contexts/GroupContext";

import "./App.css";
import { supabase } from "./supabaseClient";

function AppContent() {
  const [view, setView] = useState("home");  // Aqui define qual a página inicial ao logar no app .
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // === ESTADOS PARA O MODAL DE SUPORTE ===
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  // === ESTADOS PARA A BARRA DE NAVEGAÇÃO ===
  const [isNavMinimized, setIsNavMinimized] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // === ESTADO DA BOLINHA DE INADIMPLÊNCIA ===
  const [hasOverdue, setHasOverdue] = useState(false);

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

  // === MOTOR INVISÍVEL: Verifica se o jogador tem dívida atrasada ===
  useEffect(() => {
    const checkDebts = async () => {
      if (!activeGroup || !user) return;

      // 👉 TRAVA 1: Permissão de Visibilidade. Se o módulo está desligado OU o jogador atual não tem permissão para ver a tesouraria, desliga a bolinha.
      const moduloTesourariaAtivo = activeGroup.usa_tesouraria !== false;
      const jogadorPedeVerTesouraria = activeGroup.jogadores_veem_tesouraria !== false;
      const podeVerTesouraria = moduloTesourariaAtivo && (isAdmin || jogadorPedeVerTesouraria);

      if (!podeVerTesouraria) {
        setHasOverdue(false);
        return;
      }

      // 👉 TRAVA 2: DO SUPER ADMIN: Ignora completamente se for o usuário principal
      if (Number(user.player_id) === 1) {
        setHasOverdue(false);
        return;
      }

      const { data: config } = await supabase.from("grupos_pelada").select("mes_inicio_tesouraria, dia_vencimento_tesouraria").eq("id_grupo", activeGroup.id_grupo).single();
      const { data: member } = await supabase.from("grupo_membros").select("tipo_jogador, data_inclusao, data_desativacao").eq("id_grupo", activeGroup.id_grupo).eq("player_id", user.player_id).single();
      
      if (!member || member.tipo_jogador?.toLowerCase() !== "mensalista") return setHasOverdue(false);

      const { data: payments } = await supabase.from("mensalidades").select("mes_ano").eq("id_grupo", activeGroup.id_grupo).eq("player_id", user.player_id).in("status", ["pago", "isento"]);

      const paidMonths = payments ? payments.map(p => p.mes_ano) : [];
      const startLimit = config?.mes_inicio_tesouraria || "2024-01";
      const dueDay = config?.dia_vencimento_tesouraria || 10;
      
      const today = new Date();
      let hasDebt = false;

      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const limitDate = new Date(Number(startLimit.split('-')[0]), Number(startLimit.split('-')[1]) - 1, 1);
        if (d < limitDate) break;

        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        const inclusao = member.data_inclusao ? new Date(member.data_inclusao) : new Date("2000-01-01");
        const desativacao = member.data_desativacao ? new Date(member.data_desativacao) : null;
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        
        if (inclusao > monthEnd) continue;
        if (desativacao && desativacao < d) continue;

        if (!paidMonths.includes(monthStr)) {
           const dueDate = new Date(d.getFullYear(), d.getMonth(), dueDay, 23, 59, 59);
           if (today > dueDate) {
             hasDebt = true; 
             break;
           }
        }
      }
      setHasOverdue(hasDebt);
    };

    checkDebts();
  }, [activeGroup, user, view, isAdmin]); // Incluí o isAdmin nas dependências para reagir rapidamente a mudanças de privilégio

  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsNavMinimized(true);
        setShowUserMenu(false);
      } else if (currentScrollY < lastScrollY) {
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
      if (grupos.length === 1) changeGroup(grupos[0]);
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
      const { error } = await supabase.from("users").update({ password: novaSenha }).eq("player_id", user.player_id);
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
        const { data: playerData } = await supabase.from("players").select("phone").eq("id", user.player_id).maybeSingle();
        telefone = playerData?.phone || "Sem contato";
      }

      const { error } = await supabase.from("suporte_mensagens").insert([{
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
    if (grupos.length === 0) return <CreateGroupPage user={user} />;
    if (grupos.length > 1) return <GroupSelectionPage user={user} onGroupSelected={() => {}} />;
    return <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>Entrando no Vestiário...</div>;
  }

  const tabButtonStyle = (isActive, isMenu = false) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: isActive ? "#f8f9fa" : "transparent",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    padding: "8px 0",
    margin: "0 2px",
    flex: 1,
    color: isActive ? "#007bff" : (isMenu ? "#444" : "#6c757d"),
    fontWeight: isActive ? "900" : (isMenu ? "bold" : "normal"),
    opacity: isActive || isMenu ? 1 : 0.4,
    transform: isActive ? "scale(1.05)" : "scale(1)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  });

  const isMenuView = ["settings", "players", "requests", "admin_messages"].includes(view);

  const temVideo = activeGroup?.url_videos_pelada && activeGroup.url_videos_pelada.trim() !== "";

  const menuHeaderStyle = {
    padding: "8px 14px", 
    background: "#e2e6ea", 
    fontSize: "11px", 
    fontWeight: "bolder", 
    color: "#495057", 
    textAlign: "right", 
    letterSpacing: "0.5px",
    textTransform: "uppercase"
  };

  const moduloTesourariaAtivo = activeGroup?.usa_tesouraria !== false;
  const jogadorPedeVerTesouraria = activeGroup?.jogadores_veem_tesouraria !== false;
  const mostrarBotaoTesouraria = moduloTesourariaAtivo && (isAdmin || jogadorPedeVerTesouraria);

  return (
    <div style={{ padding: "85px 20px 100px 20px", maxWidth: "600px", margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 0, background: "#ffffff",
          borderBottom: "1px solid #eee", boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          zIndex: 1000, paddingTop: "calc(env(safe-area-inset-top) + 4px)"
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", alignItems: "center", height: "60px", padding: "0 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f8f9fa", padding: "6px 16px", borderRadius: "24px", width: "fit-content", border: "1px solid #f0f0f0" }}>
            <div style={{ background: "#007bff", color: "white", width: "35px", height: "35px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "16px", overflow: "hidden" }}>
              {user?.players?.name?.charAt(0)}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: "bold", color: "#333", fontSize: "14px", lineHeight: "1.2" }}>{user?.players?.name}</div>
              <div style={{ fontSize: "11px", color: isAdmin ? "#dc3545" : "#888", fontWeight: isAdmin ? "bold" : "normal" }}>
                {isAdmin ? "🔑 Administrador" : "⚽ Jogador"} | {activeGroup?.nome_grupo}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
        <img src={activeGroup?.logo_url || "/logo-app.webp"} alt={`Escudo da pelada ${activeGroup?.nome_grupo || ''}`} style={{ width: "140px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
      </div>

      <main>
        {view === "requests" && Number(user.player_id) === 1 && <AdminRequestsPage />}
        {view === "admin_messages" && Number(user.player_id) === 1 && <AdminMessagesPage />}
        {view === "settings" && isAdmin && <SettingsPage user={user} />}
        {view === "players" && isAdmin && <PlayersPage user={user} />}
        {view === "matches" && <MatchesPage user={user} />}
        {view === "teams" && <TeamsPage user={user} />}
        {view === "voting" && <VotingPage user={user} />}
        {view === "ranking" && <RankingPage />}
        {view === "finance" && <FinancePage user={user} />}
        {view === "home" && <DashboardPage user={user} onNavigate={handleChangeView} />}
      </main>

      <div
        onClick={() => setIsNavMinimized(false)}
        style={{
          position: "fixed", bottom: isNavMinimized ? "calc(env(safe-area-inset-bottom) + 15px)" : "-60px",
          left: "50%", transform: "translateX(-50%)", background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fff",
          padding: "10px 24px", borderRadius: "30px", fontSize: "13px", fontWeight: "bold",
          boxShadow: "0 6px 16px rgba(0,0,0,0.3)", zIndex: 1001, cursor: "pointer",
          transition: "bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", alignItems: "center", gap: "8px"
        }}
      >
        <span style={{ fontSize: "16px" }}>👆</span> Menu
      </div>

      <div 
        style={{ 
          position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", 
          borderTop: "1px solid #eee", boxShadow: "0 -3px 12px rgba(0,0,0,0.08)", zIndex: 1000, 
          paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)",
          transform: isNavMinimized ? "translateY(100%)" : "translateY(0)",
          transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: "65px", padding: "0 6px", position: "relative" }}>
          
          <button onClick={() => handleChangeView("home")} style={tabButtonStyle(view === "home")}>
            <span style={{ fontSize: "20px" }}>🏠</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Início</span>
          </button>

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

          {/* === BOTÃO DE MENU COM BOLINHA VERMELHA === */}
          <button 
            onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); renovarSessao(); }} 
            style={{ ...tabButtonStyle(isMenuView || showUserMenu, true), position: "relative" }}
          >
            <span style={{ fontSize: "20px" }}>☰</span>
            <span style={{ fontSize: "10px", marginTop: "3px" }}>Menu</span>
            {hasOverdue && <div style={{ position: "absolute", top: "5px", right: "15px", width: "10px", height: "10px", background: "#dc3545", borderRadius: "50%", border: "2px solid #fff" }}></div>}
          </button>

          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", bottom: "75px", right: "15px", background: "#fff", border: "1px solid #ddd",
                borderRadius: "12px", boxShadow: "0 -6px 20px rgba(0,0,0,0.15)", minWidth: "220px", zIndex: 2000, overflow: "hidden", display: "flex", flexDirection: "column"
              }}
            >
              
              {temVideo && (
                <>
                  <div style={menuHeaderStyle}>Vídeos da Pelada</div>
                  <button onClick={() => { setShowUserMenu(false); window.open(activeGroup.url_videos_pelada, "_blank"); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#333", borderBottom: "1px solid #f5f5f5" }}>🎥 Ixpia seu lance</button>
                </>
              )}

              {Number(user.player_id) === 1 && (
                <>
                  <div style={menuHeaderStyle}>Sistema</div>
                  <button onClick={() => handleChangeView("requests")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "requests" ? "#007bff" : "#333", borderBottom: "1px solid #f5f5f5" }}>📋 Solicitações Geral</button>
                  <button onClick={() => handleChangeView("admin_messages")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "admin_messages" ? "#007bff" : "#333", borderBottom: "1px solid #f5f5f5" }}>✉️ Caixa de Suporte</button>
                </>
              )}

              {isAdmin && (
                <>
                  <div style={menuHeaderStyle}>Gerenciar Pelada</div>
                  <button onClick={() => handleChangeView("settings")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "settings" ? "#007bff" : "#333", borderBottom: "1px solid #f5f5f5" }}>⚙️ Configurações</button>
                  <button onClick={() => handleChangeView("players")} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "players" ? "#007bff" : "#333", borderBottom: "1px solid #f5f5f5" }}>👤 Modificar Jogadores</button>
                </>
              )}

              {mostrarBotaoTesouraria && (
                <>
                  <div style={menuHeaderStyle}>Tesouraria</div>
                  <button 
                    onClick={() => handleChangeView("finance")} 
                    style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: view === "finance" ? "#007bff" : "#333", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>💰 Pagamentos e PIX</span>
                    {hasOverdue && <span style={{ background: "#dc3545", color: "white", borderRadius: "10px", padding: "2px 6px", fontSize: "10px" }}>Atrasado</span>}
                  </button>
                </>
              )}

              <div style={menuHeaderStyle}>Sua Conta</div>
              <button onClick={() => { setShowUserMenu(false); setSupportModalOpen(true); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#ffc107", borderBottom: "1px solid #f5f5f5" }}>📢 Chamar Suporte</button>

              {(user.user_groups?.length > 1) && (
                <button onClick={() => { setShowUserMenu(false); clearGroup(); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#007bff", borderBottom: "1px solid #f5f5f5" }}>🔄 Trocar de Pelada</button>
              )}
              <button onClick={() => { setShowUserMenu(false); mudarSenha(); }} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#333", borderBottom: "1px solid #f5f5f5" }}>🔑 Alterar Senha</button>
              <button onClick={() => handleLogout()} style={{ width: "100%", background: "#fff", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: "bold", color: "#dc3545" }}>🚪 Sair do App</button>
            </div>
          )}
        </div>
      </div>

      {supportModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "450px", background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>🛠️ Enviar Feedback ou Relatar Bug</h3>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px", lineHeight: "1.4" }}>
              Encontrou um erro ou tem uma sugestão? Descreva abaixo. Sua mensagem será enviada junto com o nome do seu grupo para análise.
            </p>

            <form onSubmit={handleSendSupport}>
              <textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} placeholder="Descreva detalhadamente..." required rows={5} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: "15px", fontFamily: "inherit" }} />

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setSupportModalOpen(false); setSupportMessage(""); }} disabled={sendingSupport} style={{ padding: "10px 14px", background: "#6c757d", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>Cancelar</button>
                <button type="submit" disabled={sendingSupport || !supportMessage.trim()} style={{ padding: "10px 14px", background: (sendingSupport || !supportMessage.trim()) ? "#ced4da" : "#007bff", color: "#fff", border: "none", borderRadius: "8px", cursor: (sendingSupport || !supportMessage.trim()) ? "not-allowed" : "pointer", fontWeight: "bold" }}>
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