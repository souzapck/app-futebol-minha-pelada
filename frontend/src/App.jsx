import React, { useState, useEffect } from "react";
import PlayersPage from "./pages/PlayersPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import TeamsPage from "./pages/TeamsPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import VotingPage from "./pages/VotingPage.jsx";
import "./App.css";

import { supabase } from "./supabaseClient";

function App() {
  const [view, setView] = useState("matches");
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 horas
  const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutos

  const renovarSessao = () => {
    const session = localStorage.getItem("session");
    if (!session) return;

    const parsed = JSON.parse(session);

    const novaSession = {
      ...parsed,
      expiresAt: Date.now() + SESSION_DURATION,
      lastActivityAt: Date.now()
    };

    localStorage.setItem("session", JSON.stringify(novaSession));
  };

  useEffect(() => {
    const session = localStorage.getItem("session");

    if (session) {
      const parsed = JSON.parse(session);

      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem("session");
        setUser(null);
      } else {
        setUser(parsed.user);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const session = localStorage.getItem("session");

      if (session) {
        const parsed = JSON.parse(session);

        if (Date.now() > parsed.expiresAt) {
          alert("⏱️ Sessão expirada. Faça login novamente.");
          localStorage.removeItem("session");
          setUser(null);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserMenu(false);
    };

    if (showUserMenu) {
      window.addEventListener("click", handleClickOutside);
    }

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [showUserMenu]);

  const mudarSenha = async () => {
    const novaSenha = window.prompt("🔑 Digite a sua nova senha:");
    if (!novaSenha) return;

    if (novaSenha.length !== 4) {
      alert("❌ A senha deve ter exatamente 4 dígitos.");
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
  };

  const handleChangeView = (nextView) => {
    setShowUserMenu(false);
    setView(nextView);
  };

  if (!user) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
          <img
            src="/image.jpg"
            alt="Futebol de Quinta"
            style={{ width: "150px", height: "auto", objectFit: "contain", borderRadius: "10px" }}
          />
        </div>
        <LoginPage onLoginSuccess={(dados) => setUser(dados)} />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          background: "#fff",
          padding: "10px 15px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              background: "#007bff",
              color: "white",
              width: "35px",
              height: "35px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "18px",
              overflow: "hidden"
            }}
            title="Foto do usuário"
          >
            {user?.players?.name?.charAt(0)}
          </div>

          <div>
            <div style={{ fontWeight: "bold", color: "#333" }}>{user?.players?.name}</div>
            <div
              style={{
                fontSize: "12px",
                color: user.is_admin ? "#dc3545" : "#888",
                fontWeight: user.is_admin ? "bold" : "normal"
              }}
            >
              {user.is_admin ? "🔑 Administrador" : "⚽ Jogador"}
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUserMenu((prev) => !prev);
            }}
            style={{
              background: "#f8f9fa",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px"
            }}
            title="Abrir menu"
          >
            ☰ Menu
          </button>

          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "42px",
                right: 0,
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                minWidth: "170px",
                zIndex: 20,
                overflow: "hidden"
              }}
            >
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  mudarSenha();
                }}
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "none",
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#333",
                  borderBottom: "1px solid #eee"
                }}
              >
                🔑 Trocar Senha
              </button>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  handleLogout();
                }}
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "none",
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#dc3545"
                }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
        <img
          src="/image.jpg"
          alt="Futebol de Quinta"
          style={{ width: "180px", height: "auto", objectFit: "contain", borderRadius: "10px" }}
        />
      </div>

      <nav
        style={{
          marginBottom: 30,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap"
        }}
      >
        {user.is_admin && (
          <button
            onClick={() => handleChangeView("players")}
            style={{
              padding: "10px 20px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              background: view === "players" ? "#28a745" : "#eee",
              color: view === "players" ? "white" : "#333"
            }}
          >
            Jogadores
          </button>
        )}

        <button
          onClick={() => handleChangeView("matches")}
          style={{
            padding: "10px 20px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: view === "matches" ? "#28a745" : "#eee",
            color: view === "matches" ? "white" : "#333"
          }}
        >
          Confirmação
        </button>

        <button
          onClick={() => handleChangeView("teams")}
          style={{
            padding: "10px 20px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: view === "teams" ? "#28a745" : "#eee",
            color: view === "teams" ? "white" : "#333"
          }}
        >
          Escalação
        </button>

        <button
          onClick={() => handleChangeView("ranking")}
          style={{
            padding: "10px 20px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: view === "ranking" ? "#28a745" : "#eee",
            color: view === "ranking" ? "white" : "#333"
          }}
        >
          🏆 Ranking
        </button>

        <button
          onClick={() => handleChangeView("voting")}
          style={{
            padding: "10px 20px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: view === "voting" ? "#28a745" : "#eee",
            color: view === "voting" ? "white" : "#333"
          }}
        >
          🗳️ Votação
        </button>
      </nav>

      {view === "players" && user.is_admin && <PlayersPage user={user} />}
      {view === "matches" && <MatchesPage user={user} />}
      {view === "teams" && <TeamsPage user={user} />}
      {view === "ranking" && <RankingPage />}
      {view === "voting" && <VotingPage user={user} />}
    </div>
  );
}

export default App;