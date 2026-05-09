import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function CreateGroupPage({ user }) {
  const [viewState, setViewState] = useState("loading"); // loading, form, pending
  const [nomePelada, setNomePelada] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState(user?.players?.name || "");
  const [loadingForm, setLoadingForm] = useState(false);

  useEffect(() => {
    checkExistingRequest();
  }, []);

  const checkExistingRequest = async () => {
    try {
      const { data, error } = await supabase
        .from("solicitacoes_grupo")
        .select("*")
        .eq("telefone_usuario", user.phone)
        .eq("status", "pendente")
        .maybeSingle();

      if (data) {
        setViewState("pending");
      } else {
        setViewState("form");
      }
    } catch (err) {
      console.error(err);
      setViewState("form");
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    if (!nomePelada.trim() || !nomeResponsavel.trim()) return;
    setLoadingForm(true);

    try {
      const { error } = await supabase
        .from("solicitacoes_grupo")
        .insert({
          telefone_usuario: user.phone,
          nome_responsavel: nomeResponsavel,
          nome_pelada: nomePelada
        });

      if (error) throw error;

      setViewState("pending");
    } catch (error) {
      console.error("Erro ao solicitar grupo:", error);
      alert("❌ Ocorreu um erro ao enviar a solicitação. Tente novamente.");
    } finally {
      setLoadingForm(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("session");
    window.location.reload();
  };

  if (viewState === "loading") {
    return <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "Arial, sans-serif" }}>Carregando...</div>;
  }

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <img src="/logo-app.webp" alt="Gestor de Peladas" style={{ width: "140px", borderRadius: "10px" }} />
      </div>

      <div style={{ background: "#fff", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", border: "1px solid #eee" }}>
        
        {viewState === "pending" ? (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "#f59f00", fontSize: "22px" }}>⏳ Em Análise</h2>
            <p style={{ color: "#555", fontSize: "15px", lineHeight: "1.6", marginBottom: "20px" }}>
              Sua solicitação para criar a pelada foi enviada com sucesso e está na nossa fila de análise.
            </p>
            <div style={{ background: "#fff9db", border: "1px solid #f1c40f", borderRadius: "8px", padding: "15px", fontSize: "13px", color: "#856404" }}>
              Nossa equipe entrará em contato pelo WhatsApp <strong>{user.phone}</strong> em breve para apresentar os planos e liberar seu acesso!
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ textAlign: "center", marginTop: 0, color: "#007bff", fontSize: "22px" }}>🚀 Assine o App</h2>
            <p style={{ textAlign: "center", color: "#666", fontSize: "14px", marginBottom: "25px", lineHeight: "1.5" }}>
              Você ainda não gerencia nenhum grupo. Preencha os dados abaixo para solicitar a criação da sua Pelada no sistema.
            </p>

            <form onSubmit={handleRequestAccess} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>
                  Seu Nome / Responsável
                </label>
                <input
                  type="text"
                  required
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  style={{
                    width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc",
                    fontSize: "15px", boxSizing: "border-box", backgroundColor: "#fff", color: "#333", outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>
                  Nome da Pelada
                </label>
                <input
                  type="text"
                  required
                  value={nomePelada}
                  onChange={(e) => setNomePelada(e.target.value)}
                  placeholder="Ex: Futebol de Quinta"
                  style={{
                    width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc",
                    fontSize: "15px", boxSizing: "border-box", backgroundColor: "#fff", color: "#333", outline: "none"
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loadingForm}
                style={{
                  width: "100%", marginTop: "10px", padding: "14px", background: loadingForm ? "#6c757d" : "#007bff",
                  color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: loadingForm ? "not-allowed" : "pointer",
                  fontSize: "16px", boxShadow: loadingForm ? "none" : "0 4px 10px rgba(0,123,255,0.3)"
                }}
              >
                {loadingForm ? "Enviando..." : "Enviar Solicitação"}
              </button>
            </form>
          </>
        )}

      </div>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button
          onClick={handleLogout}
          style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontWeight: "bold", textDecoration: "underline" }}
        >
          Sair e voltar para o Login
        </button>
      </div>
    </div>
  );
}