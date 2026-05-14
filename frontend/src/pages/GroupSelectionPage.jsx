import React, { useState } from "react";
import { useGroup } from "../contexts/GroupContext";

export default function GroupSelectionPage({ user, onGroupSelected }) {
  const { changeGroup } = useGroup();
  
  // Estado para armazenar o que foi digitado na busca
  const [searchTerm, setSearchTerm] = useState("");

  if (!user || !user.user_groups) return null;

  const handleSelectGroup = (group) => {
    changeGroup(group); 
    if (onGroupSelected) onGroupSelected(); 
  };

  // Filtra os grupos com base no texto digitado (ignorando maiúsculas e minúsculas)
  const filteredGroups = user.user_groups.filter((group) =>
    group.nome_grupo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: "20px", textAlign: "center" }}>
      <h2 style={{ color: "#333", marginBottom: "10px" }}>⚽ Escolha sua Pelada</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Você participa de mais de um grupo. Qual deseja acessar agora?
      </p>

      {/* Campo de Busca */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="🔍 Buscar pelada..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
            boxSizing: "border-box",
            outline: "none",
            backgroundColor: "#f8f9fa",
            color: "#333"
          }}
        />
      </div>

      {/* Lista com barra de rolagem */}
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "15px", 
          maxHeight: "60vh", 
          overflowY: "auto", 
          paddingRight: "5px" 
        }}
      >
        {filteredGroups.length === 0 ? (
          <p style={{ color: "#999", marginTop: "20px" }}>
            Nenhuma pelada encontrada com esse nome.
          </p>
        ) : (
          filteredGroups.map((group) => {
            // Formata a hora para tirar os segundos (de '22:30:00' para '22:30') se existir
            const horaFormatada = group.hora_jogo_grupo ? group.hora_jogo_grupo.slice(0, 5) : "--:--";
            const diaSemana = group.dia_jogo_grupo || "Dia não definido";

            return (
              <button
                key={group.id_grupo}
                onClick={() => handleSelectGroup(group)}
                className="group-selection-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  padding: "16px",
                  background: "#fff",
                  border: "2px solid #007bff",
                  borderRadius: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                  transition: "all 0.2s ease-in-out",
                  flexShrink: 0,
                  textAlign: "left",
                  position: "relative",
                  overflow: "hidden"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#e7f1ff";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,123,255,0.15)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
                }}
              >
                {/* Logo do Grupo */}
                <div style={{ flexShrink: 0 }}>
                  {group.logo_url ? (
                    <img 
                      src={group.logo_url} 
                      alt="Logo do Grupo" 
                      style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: "1px solid #eee", background: "#f8f9fa" }} 
                    />
                  ) : (
                    <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#f1f3f5", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ddd", fontSize: "20px" }}>
                      ⚽
                    </div>
                  )}
                </div>

                {/* Informações do Grupo */}
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "16px", fontWeight: "bold", color: "#007bff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {group.nome_grupo}
                  </span>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#666", background: "#f1f3f5", padding: "3px 8px", borderRadius: "10px" }}>
                      🗓️ {diaSemana}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#666", background: "#f1f3f5", padding: "3px 8px", borderRadius: "10px" }}>
                      ⏰ {horaFormatada}
                    </span>
                  </div>
                </div>

                {/* Ícone de Perfil / Acesso */}
                {group.perfil === "admin" && (
                  <div style={{ position: "absolute", top: "10px", right: "10px", fontSize: "10px", background: "#28a745", color: "white", padding: "2px 6px", borderRadius: "8px", fontWeight: "bold" }}>
                    Admin
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}