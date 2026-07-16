import React, { useState, useEffect } from "react";
import { useGroup } from "../contexts/GroupContext";
import { supabase } from "../supabaseClient"; 

export default function DashboardPage({ user, onNavigate }) {
  const { activeGroup, isAdmin } = useGroup();
  
  // Estado para armazenar as informações de "bate-pronto" do jogo de hoje
  const [hojeInfo, setHojeInfo] = useState(null);

  // === MOTOR DE BUSCA DO JOGO DE HOJE ===
  useEffect(() => {
    const buscarJogoDeHoje = async () => {
      if (!activeGroup || !user) return;

      // Pega a data de hoje no formato YYYY-MM-DD
      const dataHoje = new Date().toISOString().split("T")[0];

      try {
        // 1. Busca a partida de hoje na tabela 'matches'
        const { data: partida, error: erroPartida } = await supabase
          .from("matches")
          .select("id, team_a_name, team_b_name, team_c_name")
          .eq("id_grupo", activeGroup.id_grupo)
          .eq("date", dataHoje)
          .maybeSingle();

        if (erroPartida) throw erroPartida;

        // Se houver partida hoje, vamos procurar o jogador na escalação
        if (partida) {
          
          // 2. Busca do jogador na tabela 'match_player' de acordo com seu schema
          const { data: escalacao, error: erroEscalacao } = await supabase
            .from("match_player")
            .select("team, shirt_number")
            .eq("match_id", partida.id)
            .eq("player_id", user.player_id)
            .maybeSingle();

          if (escalacao) {
            // Lógica inteligente para definir o nome real do time
            let nomeDoTime = "Time";
            const teamReferencia = escalacao.team ? escalacao.team.toLowerCase().trim() : "";

            if (teamReferencia === 'a' || teamReferencia === 'time a') {
              nomeDoTime = partida.team_a_name || "Time A";
            } else if (teamReferencia === 'b' || teamReferencia === 'time b') {
              nomeDoTime = partida.team_b_name || "Time B";
            } else if (teamReferencia === 'c' || teamReferencia === 'time c') {
              nomeDoTime = partida.team_c_name || "Time C";
            } else {
              // Caso já venha o nome do time salvo direto na coluna
              nomeDoTime = escalacao.team || "Time"; 
            }

            setHojeInfo({
              time: nomeDoTime,
              camisa: escalacao.shirt_number || "--" // Traz a camisa da coluna shirt_number
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar jogo de hoje:", error);
      }
    };

    buscarJogoDeHoje();
  }, [activeGroup, user]);

  // === BLINDAGEM DA TESOURARIA ===
  const moduloTesourariaAtivo = activeGroup?.usa_tesouraria !== false;
  const jogadorPedeVerTesouraria = activeGroup?.jogadores_veem_tesouraria !== false;
  const mostrarBotaoTesouraria = moduloTesourariaAtivo && (isAdmin || jogadorPedeVerTesouraria);

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "22px", color: "#333", marginBottom: "30px" }}>
        Olá, {user?.players?.name?.split(" ")[0]}! 👋
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "15px" }}>
        
        {/* Card de Ação Principal */}
        <button 
          onClick={() => onNavigate("matches")}
          style={{ padding: "20px", background: "#007bff", color: "white", border: "none", borderRadius: "16px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,123,255,0.3)" }}
        >
          ⚽ Ver Próxima Partida
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <button onClick={() => onNavigate("teams")} style={{ padding: "15px", background: "#fff", border: "1px solid #ddd", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
            🆎 Times
          </button>
          <button onClick={() => onNavigate("ranking")} style={{ padding: "15px", background: "#fff", border: "1px solid #ddd", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
            🏆 Ranking
          </button>
        </div>
        
        {/* Card da Tesouraria */}
        {mostrarBotaoTesouraria && (
          <button onClick={() => onNavigate("finance")} style={{ padding: "15px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", color: "#555" }}>
            🏦 Tesouraria
          </button>
        )}

        {/* Card "Bate-Pronto" com Novo Layout */}
        {hojeInfo && (
          <div style={{ 
            marginTop: "10px", 
            padding: "16px", 
            background: "#f0fdf4",
            border: "1px solid #bbf7d0", 
            borderRadius: "12px", 
            color: "#166534", 
            boxShadow: "0 2px 8px rgba(22, 101, 52, 0.05)"
          }}>
            {/* Título Superior Centralizado */}
            <div style={{ 
              textAlign: "center", 
              fontSize: "12px", 
              textTransform: "uppercase", 
              fontWeight: "bold", 
              letterSpacing: "0.5px", 
              marginBottom: "16px", 
              color: "#15803d" 
            }}>
              🔥 Partida Hoje
            </div>
            
            {/* Informações Divididas ao Meio (Grid 50/50) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              
              {/* Lado Esquerdo: Time */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", color: "#15803d", marginBottom: "4px" }}>
                  Time
                </div>
                <div style={{ fontSize: "18px", fontWeight: "bold", lineHeight: "1" }}>
                  {hojeInfo.time}
                </div>
              </div>
              
              {/* Lado Direito: Camisa */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "bold", color: "#15803d", marginBottom: "4px" }}>
                  Camisa
                </div>
                <div style={{ fontSize: "22px", fontWeight: "900", lineHeight: "1" }}>
                  {hojeInfo.camisa}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}