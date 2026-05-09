import React, { createContext, useState, useContext, useEffect } from "react";

const GroupContext = createContext();

export const GroupProvider = ({ children }) => {
  const [activeGroup, setActiveGroup] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Monitora a troca de grupo e atualiza se o usuário é admin daquela pelada
  useEffect(() => {
    if (activeGroup) {
      setIsAdmin(activeGroup.perfil === "admin");
    } else {
      setIsAdmin(false);
    }
  }, [activeGroup]);

  // Função para selecionar/trocar a pelada
  const changeGroup = (grupo) => {
    setActiveGroup(grupo);
  };

  // Função para limpar a pelada (voltar para a tela de seleção)
  const clearGroup = () => {
    setActiveGroup(null);
  };

  return (
    <GroupContext.Provider 
      value={{ 
        activeGroup, 
        setActiveGroup, 
        isAdmin, 
        setIsAdmin,
        changeGroup, // <-- Faltava exportar isso!
        clearGroup   // <-- Faltava exportar isso!
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => useContext(GroupContext);