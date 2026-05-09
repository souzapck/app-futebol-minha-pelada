import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_grupo")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar solicitações:", error);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  // === NOVA LÓGICA DE APROVAÇÃO MULTI-TENANT DIRETO NO FRONTEND ===
  const handleAprovar = async (req) => {
    const confirm = window.confirm(`✅ Aprovar a solicitação de "${req.nome_pelada}" e gerar o ambiente do cliente?`);
    if (!confirm) return;

    setProcessingId(req.id);

    try {
      const phoneNormalizado = req.telefone_usuario.replace(/\D/g, "");

      // 1. Criar o novo Grupo (Pelada)
      const { data: newGroup, error: groupError } = await supabase
        .from("grupos_pelada")
        .insert([{ nome_grupo: req.nome_pelada }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Pegamos o ID da pelada que acabou de nascer!
      const novoGrupoId = newGroup.id_grupo || newGroup.id; 

      // 2. Verificar se o Responsável já existe na base global
      let finalPlayerId = null;
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id")
        .eq("phone", phoneNormalizado)
        .maybeSingle();

      if (existingPlayer) {
        finalPlayerId = existingPlayer.id;
      } else {
        // 3. Se não existe, cria na tabela global (sem id_grupo!)
        const { data: createdPlayer, error: playerError } = await supabase
          .from("players")
          .insert([{ name: req.nome_responsavel, phone: phoneNormalizado }])
          .select()
          .single();

        if (playerError) throw playerError;
        finalPlayerId = createdPlayer.id;

        // Cria o login base (Senha = 4 últimos dígitos)
        const senhaPadrao = phoneNormalizado.slice(-4);
        await supabase.from("users").insert([{
          phone: phoneNormalizado,
          password: senhaPadrao,
          player_id: finalPlayerId,
          is_admin: false 
        }]);
      }

      // 4. Vincular o responsável como Administrador deste novo grupo
      const { error: membroError } = await supabase
        .from("grupo_membros")
        .insert([{
          id_grupo: novoGrupoId,
          player_id: finalPlayerId,
          perfil: 'admin' // Dá os poderes de dono da pelada pra ele!
        }]);

      if (membroError) throw membroError;

      // 5. Marcar a solicitação original como aprovada
      const { error: updateReqError } = await supabase
        .from("solicitacoes_grupo")
        .update({ status: "aprovado" })
        .eq("id", req.id);

      if (updateReqError) throw updateReqError;

      alert(`🚀 Sucesso! Pelada "${req.nome_pelada}" criada.\nA senha de login padrão gerada é os últimos 4 dígitos do número: ${req.telefone_usuario}`);
      loadRequests();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert(`❌ Ocorreu um erro ao processar a aprovação: ${error.message || "Erro desconhecido no banco de dados"}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecusar = async (id) => {
    const confirm = window.confirm("❌ Tem certeza que deseja RECUSAR esta solicitação?");
    if (!confirm) return;

    setProcessingId(id);

    try {
      const { error } = await supabase
        .from("solicitacoes_grupo")
        .update({ status: "recusado" })
        .eq("id", id);

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error("Erro ao recusar:", error);
      alert("❌ Ocorreu um erro ao recusar.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatarTel = (tel) => {
    if (!tel || tel.length < 11) return tel;
    return `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`;
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Carregando fila de clientes...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: "40px" }}>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "2px solid #ffc107", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
        <h2 style={{ marginTop: 0, color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
          👑 Painel Master: Novas Assinaturas
        </h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>
          Abaixo estão os formulários enviados pela tela de login. Ao aprovar, o sistema irá montar todo o banco de dados do cliente automaticamente.
        </p>

        {requests.length === 0 ? (
          <div style={{ background: "#f8f9fa", padding: "30px", borderRadius: "8px", textAlign: "center", color: "#666", border: "1px dashed #ccc" }}>
            Nenhuma solicitação pendente no momento.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {requests.map((req) => (
              <div key={req.id} style={{ background: "#f8f9fa", border: "1px solid #ddd", borderRadius: "10px", padding: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "18px", color: "#007bff", marginBottom: "5px" }}>
                    ⚽ {req.nome_pelada}
                  </div>
                  <div style={{ fontSize: "14px", color: "#333", marginBottom: "3px" }}>
                    <strong>Responsável:</strong> {req.nome_responsavel}
                  </div>
                  <div style={{ fontSize: "14px", color: "#333" }}>
                    <strong>WhatsApp:</strong> {formatarTel(req.telefone_usuario)}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>
                    Solicitado em: {new Date(req.created_at).toLocaleDateString("pt-BR")} às {new Date(req.created_at).toLocaleTimeString("pt-BR")}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => handleRecusar(req.id)}
                    disabled={processingId === req.id}
                    style={{ background: "#fff", color: "#dc3545", border: "1px solid #dc3545", padding: "10px 15px", borderRadius: "8px", cursor: processingId ? "not-allowed" : "pointer", fontWeight: "bold" }}
                  >
                    ❌ Recusar
                  </button>
                  
                  <button
                    onClick={() => handleAprovar(req)}
                    disabled={processingId === req.id}
                    style={{ background: "#28a745", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "8px", cursor: processingId ? "not-allowed" : "pointer", fontWeight: "bold", boxShadow: "0 2px 5px rgba(40,167,69,0.3)" }}
                  >
                    {processingId === req.id ? "⏳ Gerando..." : "✅ Aprovar e Criar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}