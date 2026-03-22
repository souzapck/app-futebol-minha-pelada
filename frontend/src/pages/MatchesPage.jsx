import { useEffect, useState } from "react";
import api from "../api.js";

// Lembre-se de receber o 'user' aqui na primeira linha
export default function MatchesPage({ user }) {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const resM = await api.get("/matches");
    setMatches(resM.data);
    const resP = await api.get("/players");
    setPlayers(resP.data);
  };

  const loadConfirmations = async (matchId) => {
    const res = await api.get(`/matches/${matchId}/players`);
    const sMap = {};
    res.data.forEach(item => {
      sMap[item.id] = item.status;
    });
    setStatusMap(sMap);
  };

  const getNextThursday = () => {
    const d = new Date();
    const day = d.getDay(); 
    let diff = (4 - day + 7) % 7;
    if (diff === 0 && d.getHours() >= 22) diff = 7; 
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10); 
  };

  const createMatch = async () => {
    const nextThu = getNextThursday();
    const matchExists = matches.some(m => m.date === nextThu);
    
    if (matchExists) {
      alert("⚠️ O jogo da próxima quinta-feira já foi criado!");
      return; 
    }

    const res = await api.post("/matches", { date: nextThu });
    const newMatches = [res.data, ...matches];
    setMatches(newMatches);
    selectMatch(res.data);
  };

  const deleteMatch = async (matchId) => {
    const confirm = window.confirm("🗑️ Tem certeza que deseja excluir este jogo? Todos os dados serão apagados.");
    if (!confirm) return;

    try {
      await api.delete(`/matches/${matchId}`);
      setMatches(matches.filter(m => m.id !== matchId));
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(null);
        setStatusMap({});
      }
    } catch (error) {
      alert("Erro ao excluir o jogo.");
    }
  };

  const selectMatch = (match) => {
    setSelectedMatch(match);
    loadConfirmations(match.id);
  };

  const confirmPlayer = async (playerId, status) => {
    if (!selectedMatch) return;
    
    if (selectedMatch.is_drawn) {
      alert("🔒 Jogo fechado! Não é mais possível alterar presenças.");
      return;
    }

    // Trava de segurança extra no momento do clique
    if (!user?.is_admin && user?.player_id !== playerId) {
      alert("⚠️ Você só pode alterar a sua própria presença.");
      return;
    }

    setStatusMap(prev => ({ ...prev, [playerId]: status }));

    try {
      await api.post(`/matches/${selectedMatch.id}/confirm`, {
        match_id: selectedMatch.id,
        player_id: playerId,
        status: status
      });
    } catch (err) {
      alert("Erro ao confirmar presença.");
    }
  };

  const playersWithStatus = players.map(p => {
    return { 
      ...p, 
      status: statusMap[p.id] || "sem_resposta" 
    };
  });

  const statusWeight = { "confirmado": 1, "sem_resposta": 2, "duvida": 3, "nao_vai": 4 };
  
  playersWithStatus.sort((a, b) => {
    // 1º Regra: O jogador logado sempre ganha a disputa e vai pro topo
    if (a.id === user?.player_id) return -1;
    if (b.id === user?.player_id) return 1;
    
    // 2º Regra: O resto da lista é ordenado pelo status (Vai > Sem resposta > Dúvida > Não vai)
    return statusWeight[a.status] - statusWeight[b.status];
  });


  const totalConfirmed = playersWithStatus.filter(p => p.status === "confirmado").length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* SÓ MOSTRA O BOTÃO DE CRIAR JOGO SE FOR ADMIN */}
      {user?.is_admin && (
        <button 
          onClick={createMatch} 
          style={{ width: "100%", padding: "16px", background: "#28a745", color: "white", fontSize: "16px", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer", marginBottom: 20, boxShadow: "0 4px 10px rgba(40,167,69,0.3)" }}
        >
          📅 + Criar Jogo (Próx. Quinta)
        </button>
      )}

      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px", marginBottom: "20px" }}>
        {matches.map(m => (
          <button
            key={m.id}
            onClick={() => selectMatch(m)}
            style={{
              minWidth: "110px", padding: "10px", borderRadius: "8px", cursor: "pointer",
              border: selectedMatch?.id === m.id ? "2px solid #007bff" : "1px solid #ddd",
              background: selectedMatch?.id === m.id ? "#e7f1ff" : "#fff",
              color: selectedMatch?.id === m.id ? "#007bff" : "#555",
              fontWeight: selectedMatch?.id === m.id ? "bold" : "normal"
            }}
          >
            {m.date.split("-").reverse().join("/")} {m.is_drawn && "🔒"}
          </button>
        ))}
      </div>

      {selectedMatch && (
        <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "15px", border: "1px solid #eee" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, color: "#333" }}>Presença</h3>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ 
                background: totalConfirmed >= 12 ? "#28a745" : totalConfirmed >= 10 ? "#ffc107" : "#dc3545", 
                color: totalConfirmed >= 10 && totalConfirmed < 12 ? "black" : "white", 
                padding: "6px 12px", borderRadius: "20px", fontWeight: "bold", fontSize: "14px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}>
                Confirmados: {totalConfirmed}
              </div>
              
              {/* SÓ MOSTRA O BOTÃO DE EXCLUIR JOGO SE FOR ADMIN */}
              {user?.is_admin && (
                <button 
                  onClick={() => deleteMatch(selectedMatch.id)}
                  style={{ background: "#dc3545", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}
                >
                  🗑️ Excluir
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {playersWithStatus.map(p => {
              
              // Lógica central: O jogador não é admin e a linha que está sendo desenhada não é a dele.
              const bloqueadoParaEsteUsuario = !user?.is_admin && user?.player_id !== p.id;
              
              return (
                <div key={p.id} style={{ 
                  display: "flex", justifyContent: "space-between", alignItems: "center", 
                  background: "#fff", padding: "12px", borderRadius: "10px", 
                  borderLeft: `6px solid ${p.status === 'confirmado' ? '#28a745' : p.status === 'nao_vai' ? '#dc3545' : p.status === 'duvida' ? '#ffc107' : '#ddd'}`, 
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                  opacity: selectedMatch.is_drawn ? 0.7 : 1
                }}>
                  
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "16px", color: "#333", display: "flex", alignItems: "center" }}>
                      <span style={{ color: "#007bff", marginRight: "5px" }}>
                        {(p.shirt_number !== null && p.shirt_number !== undefined && p.shirt_number !== "") ? String(p.shirt_number).padStart(2, '0') : "--"}
                      </span>
                      {p.name}
                      
                      {/* ETIQUETA "VOCÊ" SE FOR O JOGADOR LOGADO */}
                      {user?.player_id === p.id && (
                        <span style={{ fontSize: "11px", color: "#28a745", background: "#e8f5e9", padding: "2px 6px", borderRadius: "10px", marginLeft: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Você
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                      ⚽ {p.position} | ⭐ {p.rating}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button 
                      onClick={() => confirmPlayer(p.id, "confirmado")} 
                      disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario}
                      style={{ 
                        padding: "8px 12px", 
                        background: p.status === "confirmado" ? "#28a745" : "#f1f3f5", 
                        color: p.status === "confirmado" ? "white" : "#555", 
                        border: "none", borderRadius: "6px", fontWeight: "bold",
                        cursor: (selectedMatch.is_drawn || bloqueadoParaEsteUsuario) ? "not-allowed" : "pointer", 
                        opacity: bloqueadoParaEsteUsuario ? 0.4 : 1
                      }}
                    >Vai</button>
                    
                    <button 
                      onClick={() => confirmPlayer(p.id, "nao_vai")} 
                      disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario}
                      style={{ 
                        padding: "8px 12px", 
                        background: p.status === "nao_vai" ? "#dc3545" : "#f1f3f5", 
                        color: p.status === "nao_vai" ? "white" : "#555", 
                        border: "none", borderRadius: "6px", fontWeight: "bold",
                        cursor: (selectedMatch.is_drawn || bloqueadoParaEsteUsuario) ? "not-allowed" : "pointer", 
                        opacity: bloqueadoParaEsteUsuario ? 0.4 : 1
                      }}
                    >Não</button>
                    
                    <button 
                      onClick={() => confirmPlayer(p.id, "duvida")} 
                      disabled={selectedMatch.is_drawn || bloqueadoParaEsteUsuario}
                      style={{ 
                        padding: "8px", 
                        background: p.status === "duvida" ? "#ffc107" : "#f1f3f5", 
                        color: p.status === "duvida" ? "black" : "#555", 
                        border: "none", borderRadius: "6px", fontSize: "14px",
                        cursor: (selectedMatch.is_drawn || bloqueadoParaEsteUsuario) ? "not-allowed" : "pointer", 
                        opacity: bloqueadoParaEsteUsuario ? 0.4 : 1
                      }}
                    >❓</button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
