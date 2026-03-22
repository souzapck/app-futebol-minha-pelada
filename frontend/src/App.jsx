import React, { useState, useEffect } from 'react';
import PlayersPage from "./pages/PlayersPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import "./App.css";

function App() {
  const [view, setView] = useState("matches"); 
  const [user, setUser] = useState(null); 

  const mudarSenha = async () => {
    const novaSenha = window.prompt("🔑 Digite a sua nova senha:");
    if (!novaSenha) return;
    
    try {
      await api.put(`/users/${user.player_id}/password`, { new_password: novaSenha });
      alert("✅ Senha alterada com sucesso!");
    } catch (e) {
      // 🚨 MUDANÇA AQUI: Agora ele vai mostrar o erro exato que o servidor deu!
      const erroReal = e.response?.data?.detail || e.message;
      alert(`❌ Erro do Servidor: ${erroReal}`);
    }
  };



  useEffect(() => {
    const loggedUser = localStorage.getItem("user");
    if (loggedUser) {
      setUser(JSON.parse(loggedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
          <img src="/image.jpg" alt="Futebol de Quinta" style={{ width: "150px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
        </div>
        <LoginPage onLoginSuccess={(dados) => setUser(dados)} />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      
      {/* Cabeçalho do Usuário Logado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", background: "#fff", padding: "10px 15px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "#007bff", color: "white", width: "35px", height: "35px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px" }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: "bold", color: "#333" }}>{user.name}</div>
            <div style={{ fontSize: "12px", color: user.is_admin ? "#dc3545" : "#888", fontWeight: user.is_admin ? "bold" : "normal" }}>
              {user.is_admin ? "🔑 Administrador" : "⚽ Jogador"}
            </div>
          </div>
        </div>
        
        {/* BOTÃO DE MUDAR SENHA AQUI */}
        <button 
          onClick={mudarSenha} 
          style={{ background: "#fffefcf0", color: "#333", border: "1px solid #ccc", color: "#555", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "10px" }}
        >
          🔑 Trocar Senha
        </button>        
        <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #ccc", color: "#555", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
          Sair
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
        <img src="/image.jpg" alt="Futebol de Quinta" style={{ width: "180px", height: "auto", objectFit: "contain", borderRadius: "10px" }} />
      </div>

      {/* Menu de Navegação das Abas */}
      <nav style={{ marginBottom: 30, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        
        {user.is_admin && (
          <button 
            onClick={() => setView("players")} 
            style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "players" ? "#28a745" : "#eee", color: view === "players" ? "white" : "#333" }}
          >
            Jogadores
          </button>
        )}
        
        <button 
          onClick={() => setView("matches")} 
          style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "matches" ? "#28a745" : "#eee", color: view === "matches" ? "white" : "#333" }}
        >
          Confirmação
        </button>
        
        <button 
          onClick={() => setView("teams")} 
          style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "teams" ? "#28a745" : "#eee", color: view === "teams" ? "white" : "#333" }}
        >
          Escalação
        </button>
        
        <button 
          onClick={() => setView("ranking")} 
          style={{ padding: "10px 20px", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: "bold", background: view === "ranking" ? "#28a745" : "#eee", color: view === "ranking" ? "white" : "#333" }}
        >
          🏆 Ranking
        </button>
      </nav>

      {/* Agora passamos o "user={user}" para todas as páginas saberem quem está logado! */}
      {view === "players" && user.is_admin && <PlayersPage user={user} />}
      {view === "matches" && <MatchesPage user={user} />}
      {view === "teams" && <TeamsPage user={user} />}
      {view === "ranking" && <RankingPage />}

    </div>
  );
}

export default App;
