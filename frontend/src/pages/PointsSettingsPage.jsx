import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

export default function PointsSettingsPage() {
  const { activeGroup } = useGroup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado que armazena todas as configurações
  const [config, setConfig] = useState({
    pt_vitoria_ativo: true, pt_vitoria_peso: 3.00,
    pt_empate_ativo: true, pt_empate_peso: 1.00,
    pt_gol_ativo: true, pt_gol_peso: 0.20,
    pt_gol_contra_ativo: true, pt_gol_contra_peso: -0.20,
    pt_assistencia_ativo: true, pt_assistencia_peso: 0.10,
    pt_bola_cheia_ativo: true, pt_bola_cheia_peso: 0.50,
    pt_bola_murcha_ativo: true, pt_bola_murcha_peso: -0.50
  });

  useEffect(() => {
    if (activeGroup) {
      loadSettings();
    }
  }, [activeGroup]);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos_pelada")
      .select(`
        pt_vitoria_ativo, pt_vitoria_peso,
        pt_empate_ativo, pt_empate_peso,
        pt_gol_ativo, pt_gol_peso,
        pt_gol_contra_ativo, pt_gol_contra_peso,
        pt_assistencia_ativo, pt_assistencia_peso,
        pt_bola_cheia_ativo, pt_bola_cheia_peso,
        pt_bola_murcha_ativo, pt_bola_murcha_peso
      `)
      .eq("id_grupo", activeGroup.id_grupo)
      .single();

    if (error) {
      console.error("Erro ao buscar configurações:", error);
    } else if (data) {
      setConfig({
        pt_vitoria_ativo: data.pt_vitoria_ativo ?? true,
        pt_vitoria_peso: Number(data.pt_vitoria_peso ?? 3.00),
        pt_empate_ativo: data.pt_empate_ativo ?? true,
        pt_empate_peso: Number(data.pt_empate_peso ?? 1.00),
        pt_gol_ativo: data.pt_gol_ativo ?? true,
        pt_gol_peso: Number(data.pt_gol_peso ?? 0.20),
        pt_gol_contra_ativo: data.pt_gol_contra_ativo ?? true,
        pt_gol_contra_peso: Number(data.pt_gol_contra_peso ?? -0.20),
        pt_assistencia_ativo: data.pt_assistencia_ativo ?? true,
        pt_assistencia_peso: Number(data.pt_assistencia_peso ?? 0.10),
        pt_bola_cheia_ativo: data.pt_bola_cheia_ativo ?? true,
        pt_bola_cheia_peso: Number(data.pt_bola_cheia_peso ?? 0.50),
        pt_bola_murcha_ativo: data.pt_bola_murcha_ativo ?? true,
        pt_bola_murcha_peso: Number(data.pt_bola_murcha_peso ?? -0.50)
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("grupos_pelada")
      .update(config)
      .eq("id_grupo", activeGroup.id_grupo);

    if (error) {
      alert("❌ Erro ao salvar configurações.");
      console.error(error);
    } else {
      alert("✅ Configurações salvas com sucesso!");
    }
    setSaving(false);
  };

  const handleChangeAtivo = (prefix) => {
    setConfig(prev => ({ ...prev, [`${prefix}_ativo`]: !prev[`${prefix}_ativo`] }));
  };

  const handleChangePeso = (prefix, value) => {
    // Permite digitação decimal, validando posteriormente a gravação
    setConfig(prev => ({ ...prev, [`${prefix}_peso`]: value }));
  };

  const renderConfigCard = (prefix, titulo, icone, descricao) => {
    const isAtivo = config[`${prefix}_ativo`];
    const peso = config[`${prefix}_peso`];

    return (
      <div style={{
        background: "#fff",
        border: `1px solid ${isAtivo ? '#c8e6c9' : '#e0e0e0'}`,
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "15px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
        opacity: isAtivo ? 1 : 0.6,
        transition: "all 0.3s ease"
      }}>
        {/* Cabeçalho do Card (Título + Toggle) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>{icone}</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: "bold", color: "#333", fontSize: "16px" }}>{titulo}</span>
            </div>
          </div>

          {/* Toggle Switch Personalizado */}
          <div 
            onClick={() => handleChangeAtivo(prefix)}
            style={{ 
              width: "44px", height: "24px", borderRadius: "12px", 
              background: isAtivo ? "#28a745" : "#ccc", 
              position: "relative", cursor: "pointer",
              transition: "background 0.3s"
            }}
          >
            <div style={{ 
              position: "absolute", top: "2px", left: isAtivo ? "22px" : "2px", 
              width: "20px", height: "20px", borderRadius: "50%", 
              background: "#fff", transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }} />
          </div>
        </div>

        <div style={{ fontSize: "12px", color: "#777", marginTop: "4px", marginBottom: "12px" }}>
          {descricao}
        </div>

        {/* Área de Input (Só aparece se estiver ativo) */}
        {isAtivo && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", borderTop: "1px solid #f1f1f1", paddingTop: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#555" }}>Peso (Pontos):</span>
            <input 
              type="number" 
              step="0.01" 
              value={peso} 
              onChange={(e) => handleChangePeso(prefix, e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "16px",
                fontWeight: "bold",
                color: "#007bff",
                textAlign: "right",
                background: "#f8f9fa",
                outline: "none"
              }}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Carregando configurações...</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* Cabeçalho */}
      <div style={{
        background: "linear-gradient(135deg, #495057 0%, #343a40 100%)",
        padding: "20px",
        borderRadius: "12px",
        color: "white",
        textAlign: "center",
        marginBottom: "20px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
      }}>
        <h2 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          ⚙️ Configurar Pontuação
        </h2>
        <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#ced4da" }}>
          Defina as regras e os pesos para o ranking da sua pelada.
        </p>
      </div>

      <div style={{ marginBottom: "25px" }}>
        {renderConfigCard("pt_vitoria", "Vitória", "🏆", "Pontos atribuídos aos jogadores do time vencedor.")}
        {renderConfigCard("pt_empate", "Empate", "🤝", "Pontos para empate (ou para o 2º lugar caso joguem 3 times).")}
        {renderConfigCard("pt_gol", "Gol Marcado", "⚽", "Pontuação extra para cada gol a favor feito pelo jogador.")}
        {renderConfigCard("pt_gol_contra", "Gol Contra", "🥅", "Desconto de pontos para cada gol contra (use valor negativo).")}
        {renderConfigCard("pt_assistencia", "Assistência", "👟", "Pontuação extra por passe para gol.")}
        {renderConfigCard("pt_bola_cheia", "Bola Cheia (Voto)", "🌟", "Bônus para o jogador mais votado como o craque da rodada.")}
        {renderConfigCard("pt_bola_murcha", "Bola Murcha (Voto)", "🎈", "Punição para o jogador mais votado como o pior da rodada.")}
      </div>

      <button 
        onClick={handleSave} 
        disabled={saving}
        style={{
          width: "100%",
          background: saving ? "#6c757d" : "#007bff",
          color: "white",
          padding: "16px",
          border: "none",
          borderRadius: "12px",
          fontSize: "18px",
          fontWeight: "bold",
          cursor: saving ? "not-allowed" : "pointer",
          boxShadow: "0 4px 12px rgba(0,123,255,0.3)",
          transition: "background 0.3s"
        }}
      >
        {saving ? "Salvando..." : "💾 Salvar Configurações"}
      </button>

    </div>
  );
}