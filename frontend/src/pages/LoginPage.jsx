import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const normalizePhone = (value) => value.replace(/\D/g, "").slice(0, 11);

const formatPhone = (value) => {
  const digits = normalizePhone(value);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

// O "export default" aqui é obrigatório para o App.jsx conseguir ler este arquivo
export default function LoginPage({ onLoginSuccess }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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

    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        players (*)
      `)
      .eq("phone", phone)
      .eq("password", password)
      .single();

    setLoading(false);

    if (error || !data) {
      setErro("❌ Telefone ou senha incorretos.");
      return;
    }

    const session = {
      user: data,
      expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 horas
    };

    localStorage.setItem("session", JSON.stringify(session));
    onLoginSuccess(data);
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
      
      <div style={{ background: "#fff", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", border: "1px solid #eaeaea" }}>
        <h2 style={{ color: "#333", marginBottom: "10px", marginTop: "0" }}>Bem-vindo!</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "25px" }}>
          Faça login para ver a escalação e confirmar sua presença.
        </p>

        {erro && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "20px", fontSize: "14px", fontWeight: "bold" }}>
            {erro}
          </div>
        )}

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
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "16px", boxSizing: "border-box", outline: "none" }}
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
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "16px", boxSizing: "border-box", outline: "none", letterSpacing: "3px" }}
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
      </div>
    </div>
  );
}
