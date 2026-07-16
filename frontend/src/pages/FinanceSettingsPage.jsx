import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

export default function FinanceSettingsPage() {
  const { activeGroup, isAdmin } = useGroup();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    usa_tesouraria: true,
    jogadores_veem_tesouraria: true,
    mes_inicio_tesouraria: "",
    dia_vencimento_tesouraria: 10,
    chave_pix: "" // 👈 Adicionado aqui
  });

  useEffect(() => {
    if (activeGroup) {
      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

      setForm({
        usa_tesouraria: activeGroup.usa_tesouraria !== false,
        jogadores_veem_tesouraria: activeGroup.jogadores_veem_tesouraria !== false,
        mes_inicio_tesouraria: activeGroup.mes_inicio_tesouraria || mesAtual,
        dia_vencimento_tesouraria: activeGroup.dia_vencimento_tesouraria || 10,
        chave_pix: activeGroup.chave_pix || "" // 👈 Carrega do banco se existir
      });
    }
  }, [activeGroup]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.dia_vencimento_tesouraria < 1 || form.dia_vencimento_tesouraria > 31) {
      return alert("❌ O dia de vencimento deve ser entre 1 e 31.");
    }

    setLoading(true);
    const { error } = await supabase
      .from("grupos_pelada")
      .update({
        usa_tesouraria: form.usa_tesouraria,
        jogadores_veem_tesouraria: form.jogadores_veem_tesouraria,
        mes_inicio_tesouraria: form.mes_inicio_tesouraria,
        dia_vencimento_tesouraria: parseInt(form.dia_vencimento_tesouraria),
        chave_pix: form.chave_pix // 👈 Salva no banco
      })
      .eq("id_grupo", activeGroup.id_grupo);

    setLoading(false);

    if (error) {
      alert("❌ Erro ao salvar configurações: " + error.message);
    } else {
      alert("✅ Configurações salvas! Saia do app e faça login novamente para atualizar as regras.");
    }
  };

  if (!isAdmin) return <div style={{ padding: "20px", textAlign: "center" }}>Acesso restrito.</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px", paddingBottom: "100px" }}>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <h2 style={{ margin: "0 0 20px 0", color: "#333", fontSize: "18px", borderBottom: "1px solid #eee", paddingBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          🏦 Configurações da Tesouraria
        </h2>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "10px", background: "#f8f9fa", borderRadius: "8px" }}>
            <input type="checkbox" checked={form.usa_tesouraria} onChange={(e) => setForm({ ...form, usa_tesouraria: e.target.checked })} style={{ width: "20px", height: "20px" }} />
            <span style={{ fontWeight: "bold", color: "#333", fontSize: "15px" }}>Ativar Módulo de Tesouraria</span>
          </label>

          {form.usa_tesouraria && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", paddingLeft: "12px", borderLeft: "3px solid #007bff", marginTop: "5px" }}>
              
              {/* CAMPO DA CHAVE PIX */}
              <div>
                <label style={{ display: "block", fontWeight: "bold", color: "#444", fontSize: "14px", marginBottom: "5px" }}>
                  🔑 Chave PIX do Grupo:
                </label>
                <input 
                  type="text" 
                  value={form.chave_pix} 
                  onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} 
                  placeholder="Ex: Telefone, CPF, e-mail ou aleatória"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "14px" }} 
                />
                <span style={{ display: "block", fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  Essa chave ficará visível na página da Tesouraria para os jogadores copiarem.
                </span>
              </div>

              <div style={{ height: "1px", background: "#eee", margin: "5px 0" }}></div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input type="checkbox" checked={form.jogadores_veem_tesouraria} onChange={(e) => setForm({ ...form, jogadores_veem_tesouraria: e.target.checked })} style={{ width: "18px", height: "18px" }} />
                <div>
                  <span style={{ fontWeight: "bold", color: "#444", fontSize: "14px", display: "block" }}>Visível para Jogadores</span>
                  <span style={{ fontSize: "12px", color: "#666" }}>Se desmarcado, apenas o Admin verá a tesouraria.</span>
                </div>
              </label>

              <div>
                <label style={{ display: "block", fontWeight: "bold", color: "#444", fontSize: "14px", marginBottom: "5px" }}>
                  Mês e Ano de Início do Controle:
                </label>
                <input type="month" value={form.mes_inicio_tesouraria} onChange={(e) => setForm({ ...form, mes_inicio_tesouraria: e.target.value })} required style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "14px" }} />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", color: "#444", fontSize: "14px", marginBottom: "5px" }}>
                  Dia de Vencimento (Todo mês):
                </label>
                <input type="number" min="1" max="31" value={form.dia_vencimento_tesouraria} onChange={(e) => setForm({ ...form, dia_vencimento_tesouraria: e.target.value })} required style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "14px" }} />
                <span style={{ display: "block", fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  Pagamentos pendentes após este dia ficarão marcados como "Atrasados".
                </span>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: "#28a745", color: "white", fontWeight: "bold", fontSize: "16px", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "10px", boxShadow: "0 4px 6px rgba(40,167,69,0.3)" }}>
            {loading ? "Salvando..." : "💾 Salvar Configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}