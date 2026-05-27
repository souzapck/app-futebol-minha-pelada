import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

export default function GroupSettingsPage({ user }) {
  const { activeGroup } = useGroup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState({
    nome_grupo: "",
    logo_url: "",
    cor_time_a: "#0b0b0b",
    cor_time_b: "#c00707",
    nome_time_a: "Time A",
    nome_time_b: "Time B",
    dia_jogo_grupo: "Quinta-feira",
    hora_jogo_grupo: "22:30",
    nome_local_jogo_grupo: "",
    qtd_times: 2,
    min_jogadores_time: 5,
    nome_time_c: "Time C",
    cor_time_c: "#28a745"
  });

  useEffect(() => {
    if (activeGroup) {
      loadGroupData();
    }
  }, [activeGroup]);

  const loadGroupData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos_pelada")
      .select("*")
      .eq("id_grupo", activeGroup.id_grupo)
      .single();

    if (error) {
      console.error("Erro ao carregar dados do grupo:", error);
      alert("❌ Erro ao carregar configurações.");
    } else if (data) {
      setForm({
        nome_grupo: data.nome_grupo || "",
        logo_url: data.logo_url || "",
        cor_time_a: data.cor_time_a || "#0b0b0b",
        cor_time_b: data.cor_time_b || "#c00707",
        nome_time_a: data.nome_time_a || "Time A",
        nome_time_b: data.nome_time_b || "Time B",
        dia_jogo_grupo: data.dia_jogo_grupo || "Quinta-feira",
        hora_jogo_grupo: data.hora_jogo_grupo ? data.hora_jogo_grupo.slice(0, 5) : "22:30",
        nome_local_jogo_grupo: data.nome_local_jogo_grupo || "",
        qtd_times: data.qtd_times || 2,
        min_jogadores_time: data.min_jogadores_time || 5,
        nome_time_c: data.nome_time_c || "Time C",
        cor_time_c: data.cor_time_c || "#28a745"
      });
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `pelada_${activeGroup.id_grupo}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('logos_grupo')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      alert("❌ Erro ao enviar a imagem. Verifique se as políticas do Storage estão corretas.");
      setUploadingImage(false);
      return;
    }

    const { data } = supabase.storage
      .from('logos_grupo')
      .getPublicUrl(fileName);

    setForm({ ...form, logo_url: data.publicUrl });
    setUploadingImage(false);
    alert("✅ Imagem enviada! Clique em 'Salvar Configurações' no final da página para confirmar.");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("grupos_pelada")
      .update({
        nome_grupo: form.nome_grupo,
        logo_url: form.logo_url,
        cor_time_a: form.cor_time_a,
        cor_time_b: form.cor_time_b,
        nome_time_a: form.nome_time_a,
        nome_time_b: form.nome_time_b,
        dia_jogo_grupo: form.dia_jogo_grupo,
        hora_jogo_grupo: form.hora_jogo_grupo,
        nome_local_jogo_grupo: form.nome_local_jogo_grupo,
        qtd_times: Number(form.qtd_times),
        min_jogadores_time: Number(form.min_jogadores_time),
        nome_time_c: form.nome_time_c,
        cor_time_c: form.cor_time_c
      })
      .eq("id_grupo", activeGroup.id_grupo);

    setSaving(false);

    if (error) {
      console.error("Erro ao salvar:", error);
      alert("❌ Erro ao salvar configurações.");
    } else {
      alert("✅ Configurações salvas com sucesso!");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Carregando configurações...</div>;
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "15px",
    boxSizing: "border-box",
    backgroundColor: "#ffffff", 
    color: "#333333",          
    outline: "none",
    colorScheme: "light" 
  };

  const time3Disabled = Number(form.qtd_times) === 2;

  // Popups de ajuda
  const showHelpTimes = () => {
    alert("Qtd. de Times:\n\nDefina se a sua pelada divide os jogadores em 2 times (partida única tradicional) ou em 3 times (formato rei da quadra, onde quem ganha fica).");
  };

  const showHelpJogadores = () => {
    alert("Mínimo de Jogadores:\n\nInforme quantos jogadores formam 1 time na sua quadra (ex: 5 para futsal, 6 para society). O sistema usará este número para separar os titulares dos reservas na hora do sorteio.");
  };

  return (
    <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "15px", boxSizing: "border-box", paddingBottom: "40px" }}>
      <style>
        {`
          .time-input-dark-icon::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
          }
          .help-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #e2e8f0;
            color: #64748b;
            font-size: 11px;
            cursor: pointer;
            margin-left: 6px;
            border: 1px solid #cbd5e1;
            font-weight: bold;
          }
        `}
      </style>

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          border: "2px dashed #007bff",
          marginBottom: "20px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
          boxSizing: "border-box",
          width: "100%"
        }}
      >
        <h3 style={{ marginTop: 0, color: "#007bff", marginBottom: "20px", fontSize: "1.2rem" }}>
          ⚙️ Configurar Pelada
        </h3>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%" }}>
          
          <div style={{ textAlign: "left", width: "100%" }}>
            <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Nome da Pelada *</label>
            <input type="text" required value={form.nome_grupo} onChange={(e) => setForm({ ...form, nome_grupo: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ textAlign: "left", width: "100%" }}>
            <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Local do Jogo</label>
            <input type="text" value={form.nome_local_jogo_grupo} onChange={(e) => setForm({ ...form, nome_local_jogo_grupo: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: "5px", width: "90%" }}>
            <div style={{ flex: "3 1 0", textAlign: "left", minWidth: 0 }}>
              <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Dia da Semana</label>
              <select value={form.dia_jogo_grupo} onChange={(e) => setForm({ ...form, dia_jogo_grupo: e.target.value })} style={inputStyle}>
                <option value="Domingo">Domingo</option>
                <option value="Segunda-feira">Segunda-feira</option>
                <option value="Terça-feira">Terça-feira</option>
                <option value="Quarta-feira">Quarta-feira</option>
                <option value="Quinta-feira">Quinta-feira</option>
                <option value="Sexta-feira">Sexta-feira</option>
                <option value="Sábado">Sábado</option>
              </select>
            </div>

            <div style={{ flex: "2 1 0", textAlign: "left", minWidth: 0, marginRight: "10px"}}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Hora</label>
              <input type="time" className="time-input-dark-icon" value={form.hora_jogo_grupo} onChange={(e) => setForm({ ...form, hora_jogo_grupo: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ textAlign: "left", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", width: "100%", boxSizing: "border-box" }}>
            <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", display: "block", marginBottom: "8px" }}>Escudo / Logo da Pelada</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
              {form.logo_url && <img src={form.logo_url} alt="Preview" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ccc", background: "#fff", flexShrink: 0 }} />}
              <input type="text" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} style={{ ...inputStyle, flex: "1 1 200px", padding: "8px 12px" }} placeholder="URL ou envie arquivo" />
            </div>
            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploadingImage} style={{ fontSize: "13px", color: "#333", cursor: "pointer", width: "100%", boxSizing: "border-box" }} />
            {uploadingImage && <div style={{ fontSize: "12px", color: "#007bff", marginTop: "8px", fontWeight: "bold" }}>Enviando imagem... ⏳</div>}
          </div>

          {/* === CONFIGURAÇÕES DE SORTEIO (Textos curtos + Help) === */}
          <div style={{ textAlign: "left", background: "#eef2f5", padding: "15px", borderRadius: "8px", border: "1px solid #c2c9d6", width: "100%", boxSizing: "border-box", marginTop: "10px" }}>
             <h4 style={{ margin: "0 0 15px 0", color: "#333", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>🎲 Configurações do Sorteio</h4>
             
             <div style={{ display: "flex", gap: "15px" }}>
               <div style={{ flex: "1" }}>
                 <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", display: "flex", alignItems: "center", marginBottom: "5px" }}>
                   Qtd. Times
                   <span className="help-icon" onClick={showHelpTimes} title="Exibir ajuda">?</span>
                 </label>
                 <select 
                   value={form.qtd_times} 
                   onChange={(e) => setForm({ ...form, qtd_times: e.target.value })} 
                   style={inputStyle}
                 >
                   <option value={2}>2 Times</option>
                   <option value={3}>3 Times</option>
                 </select>
               </div>
               
               <div style={{ flex: "1" }}>
                 <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", display: "flex", alignItems: "center", marginBottom: "5px" }}>
                   Min. Jogadores
                   <span className="help-icon" onClick={showHelpJogadores} title="Exibir ajuda">?</span>
                 </label>
                 <input 
                   type="number" 
                   min="4" 
                   max="15" 
                   value={form.min_jogadores_time} 
                   onChange={(e) => setForm({ ...form, min_jogadores_time: e.target.value })} 
                   style={inputStyle} 
                 />
               </div>
             </div>
          </div>

          {/* === CARDS DE TIMES (Um embaixo do outro, Nome e Cor na mesma linha) === */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "5px", width: "100%" }}>
            
            {/* TIME 1 */}
            <div style={{ display: "flex", flexDirection: "column", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}>
              <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>Time 1 (Interno: A)</label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="text" 
                  maxLength="8" 
                  value={form.nome_time_a} 
                  onChange={(e) => setForm({ ...form, nome_time_a: e.target.value })} 
                  style={{ ...inputStyle, padding: "8px", textAlign: "center", flex: 1 }} 
                  placeholder="Máx 8 letras"
                />
                <input type="color" value={form.cor_time_a} onChange={(e) => setForm({ ...form, cor_time_a: e.target.value })} style={{ width: "40px", height: "40px", border: "none", cursor: "pointer", padding: "0", borderRadius: "6px", background: "none", flexShrink: 0 }} title="Cor do Time 1" />
              </div>
            </div>

            {/* TIME 2 */}
            <div style={{ display: "flex", flexDirection: "column", background: "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}>
              <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>Time 2 (Interno: B)</label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="text" 
                  maxLength="8" 
                  value={form.nome_time_b} 
                  onChange={(e) => setForm({ ...form, nome_time_b: e.target.value })} 
                  style={{ ...inputStyle, padding: "8px", textAlign: "center", flex: 1 }} 
                  placeholder="Máx 8 letras"
                />
                <input type="color" value={form.cor_time_b} onChange={(e) => setForm({ ...form, cor_time_b: e.target.value })} style={{ width: "40px", height: "40px", border: "none", cursor: "pointer", padding: "0", borderRadius: "6px", background: "none", flexShrink: 0 }} title="Cor do Time 2" />
              </div>
            </div>

            {/* TIME 3 */}
            <div style={{ display: "flex", flexDirection: "column", background: time3Disabled ? "#eaeaea" : "#f8f9fa", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box", opacity: time3Disabled ? 0.5 : 1, pointerEvents: time3Disabled ? "none" : "auto", transition: "all 0.3s" }}>
              <label style={{ fontSize: "13px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
                Time 3 (Interno: C) {time3Disabled && <span style={{ fontSize: "10px", color: "#dc3545", marginLeft: "4px" }}>(Desativado)</span>}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="text" 
                  maxLength="8" 
                  value={form.nome_time_c} 
                  onChange={(e) => setForm({ ...form, nome_time_c: e.target.value })} 
                  style={{ ...inputStyle, padding: "8px", textAlign: "center", flex: 1 }} 
                  placeholder="Máx 8 letras"
                />
                <input type="color" value={form.cor_time_c} onChange={(e) => setForm({ ...form, cor_time_c: e.target.value })} style={{ width: "40px", height: "40px", border: "none", cursor: "pointer", padding: "0", borderRadius: "6px", background: "none", flexShrink: 0 }} title="Cor do Time 3" />
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", marginTop: "15px", padding: "14px", background: saving ? "#6c757d" : "#28a745",
              color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer",
              fontSize: "16px", boxShadow: saving ? "none" : "0 4px 10px rgba(40,167,69,0.3)", boxSizing: "border-box"
            }}
          >
            {saving ? "Salvando..." : "💾 Salvar Configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}