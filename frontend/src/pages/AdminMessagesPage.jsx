import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminMessagesPage() {
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMensagens();
  }, []);

  const loadMensagens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suporte_mensagens")
      .select(`
        id,
        nome_usuario,
        telefone_usuario,
        mensagem,
        created_at,
        grupos_pelada (
          nome_grupo
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar mensagens:", error);
    } else {
      setMensagens(data || []);
    }
    setLoading(false);
  };

  const deleteMensagem = async (id) => {
    if (!window.confirm("🗑️ Deseja realmente excluir esta mensagem?")) return;
    
    const { error } = await supabase
      .from("suporte_mensagens")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Erro ao excluir mensagem.");
    } else {
      setMensagens(mensagens.filter(m => m.id !== id));
    }
  };

  // === Função para formatar o telefone visualmente ===
  const formatarTelefone = (telefone) => {
    if (!telefone || telefone === "Sem contato") return telefone;
    
    // Remove tudo que não for número
    const limpo = telefone.replace(/\D/g, "");
    
    // Formata (11) 98888-7777
    if (limpo.length === 11) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    // Formata (11) 3333-4444 (telefone fixo)
    if (limpo.length === 10) {
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    }
    // Se o usuário digitou com o 55 do Brasil: 5511988887777
    if (limpo.length === 13 && limpo.startsWith("55")) {
      return `(${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    
    return telefone; // Retorna original se for um formato desconhecido
  };

  // === Função para montar o link seguro do WhatsApp ===
  const gerarLinkZap = (telefone) => {
    let limpo = telefone.replace(/\D/g, "");
    // Adiciona o 55 do Brasil se o número não tiver
    if (limpo.length === 10 || limpo.length === 11) {
      limpo = "55" + limpo;
    }
    return `https://wa.me/${limpo}`;
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Carregando mensagens...</div>;
  }

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
      <h3 style={{ marginTop: 0, color: "#333", borderBottom: "2px solid #f4f4f4", paddingBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
        ✉️ Caixa de Entrada (Suporte)
      </h3>

      {mensagens.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#888", fontStyle: "italic", background: "#f8f9fa", borderRadius: "8px" }}>
          Nenhuma mensagem de suporte recebida.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "15px" }}>
          {mensagens.map((item) => (
            <div 
              key={item.id} 
              style={{ background: "#fff", padding: "15px", borderRadius: "10px", border: "1px solid #dee2e6", borderLeft: "6px solid #ffc107", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", textAlign: "left", position: "relative" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "5px" }}>
                <div>
                  <span style={{ fontSize: "11px", background: "#e9ecef", color: "#495057", padding: "3px 8px", borderRadius: "12px", fontWeight: "bold", textTransform: "uppercase" }}>
                    🏰 {item.grupos_pelada?.nome_grupo || "Grupo Desconhecido"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#888" }}>
                    📅 {new Date(item.created_at).toLocaleString("pt-BR")}
                  </span>
                  <button onClick={() => deleteMensagem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc3545" }} title="Excluir">🗑️</button>
                </div>
              </div>

              <div style={{ fontSize: "14px", color: "#212529", background: "#f8f9fa", padding: "10px", borderRadius: "6px", margin: "10px 0", borderLeft: "3px solid #ced4da", whiteSpace: "pre-wrap" }}>
                {item.mensagem}
              </div>

              <div style={{ fontSize: "12px", color: "#666", display: "flex", gap: "15px", flexWrap: "wrap" }}>
                <span>👤 <strong>Remetente:</strong> {item.nome_usuario}</span>
                {item.telefone_usuario && item.telefone_usuario !== "Sem contato" && (
                  <a 
                    href={gerarLinkZap(item.telefone_usuario)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "#25D366", textDecoration: "none", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px" }}
                  >
                    📱 WhatsApp: {formatarTelefone(item.telefone_usuario)}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}