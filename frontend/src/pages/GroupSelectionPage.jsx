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

      {/* Lista com barra de rolagem para não quebrar a tela quando tiver muitos clientes */}
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "15px", 
          maxHeight: "50vh", // Ocupa no máximo metade da altura da tela
          overflowY: "auto", // Cria a barra de rolagem se passar do tamanho
          paddingRight: "5px" // Dá um espacinho pra barra de rolagem não colar nos botões
        }}
      >
        {filteredGroups.length === 0 ? (
          <p style={{ color: "#999", marginTop: "20px" }}>
            Nenhuma pelada encontrada com esse nome.
          </p>
        ) : (
          filteredGroups.map((group) => (
            <button
              key={group.id_grupo}
              onClick={() => handleSelectGroup(group)}
              style={{
                padding: "16px",
                background: "#fff",
                border: "2px solid #007bff",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: "bold",
                color: "#007bff",
                cursor: "pointer",
                boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                transition: "all 0.2s",
                flexShrink: 0 // Impede que o botão seja esmagado
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#007bff"; e.currentTarget.style.color = "#fff"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#007bff"; }}
            >
              {group.nome_grupo}
            </button>
          ))
        )}
      </div>
    </div>
  );
}