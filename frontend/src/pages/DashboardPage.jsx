import React, { useState, useEffect } from "react";
import { useGroup } from "../contexts/GroupContext";
import { supabase } from "../supabaseClient"; 

export default function DashboardPage({ user, onNavigate }) {
  const { activeGroup, isAdmin } = useGroup();
  
  // Estado para armazenar as informações de "bate-pronto" do jogo de hoje
  const [hojeInfo, setHojeInfo] = useState(null);

  // === MOTOR DE BUSCA DO JOGO DE HOJE COM TRAVAS DE SEGURANÇA ===
  useEffect(() => {
    const buscarJogoDeHoje = async () => {
      if (!activeGroup || !user) return;

      // Pega a data de hoje no formato YYYY-MM-DD
      const dataHoje = new Date().toISOString().split("T")[0];

      try {
        // 1. Busca a partida de hoje trazendo também os placares para validação de trava
        const { data: partida, error: erroPartida } = await supabase
          .from("matches")
          .select("id, is_drawn, team_a_name, team_b_name, team_c_name, score_a, score_b, score_c")
          .eq("id_grupo", activeGroup.id_grupo)
          .eq("date", dataHoje)
          .maybeSingle();

        if (erroPartida) throw erroPartida;

        // 👉 TRAVA 1: Só prossegue se existir partida hoje E os times já tiverem sido sorteados
        if (partida && partida.is_drawn === true) {
          
          // 👉 TRAVA 2: Verifica se já existem gols registrados no placar oficial da partida
          const sumulaEncerrada = (
            (partida.score_a || 0) > 0 ||
            (partida.score_b || 0) > 0 ||
            (partida.score_c || 0) > 0
          );

          // 2. Busca o jogador na tabela 'match_player'
          const { data: escalacao, error: erroEscalacao } = await supabase
            .from("match_player")
            .select("team, shirt_number, status")
            .eq("match_id", partida.id)
            .eq("player_id", user.player_id)
            .maybeSingle();

          if (erroEscalacao) throw erroEscalacao;

          // 👉 TRAVA 3: Só exibe se o status for "confirmado" E houver time escalado
          const isConfirmado = escalacao?.status?.toLowerCase() === "confirmado";

          if (escalacao && isConfirmado && escalacao.team) {
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
              nomeDoTime = escalacao.team || "Time"; 
            }

            setHojeInfo({
              time: nomeDoTime,
              camisa: escalacao.shirt_number || "--",
              encerrada: sumulaEncerrada // Passa o status de trava da súmula
            });
          } else {
            // Se não estiver confirmado ou não tiver time, não mostra o card
            setHojeInfo(null);
          }
        } else {
          // Se o jogo não foi sorteado ainda, não mostra o card
          setHojeInfo(null);
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
    <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
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
        
        {/* Card da Tesouraria com blindagem de configuração */}
        {mostrarBotaoTesouraria && (
          <button onClick={() => onNavigate("finance")} style={{ padding: "15px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", color: "#555" }}>
            🏦 Banco
          </button>
        )}

        {/* Card "Bate-Pronto" com Layout Dividido (50/50) e Título Centralizado */}
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

        {/* BOTÃO INTELIGENTE: Súmula ao Vivo OU Aviso de Súmula Encerrada */}
        {hojeInfo && !hojeInfo.encerrada && (
          <button
            onClick={() => onNavigate("live_match")}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "16px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(220, 38, 38, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <span>🔴</span> ACOMPANHAR JOGO AO VIVO
          </button>
        )}

        {/* CARD DE BLOQUEIO: Exibe quando o jogo já foi gravado no banco */}
        {hojeInfo && hojeInfo.encerrada && (
          <div
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "14px",
              background: "#e2e8f0",
              color: "#475569",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "bold",
              textAlign: "center",
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxSizing: "border-box"
            }}
          >
            <span>🔒</span> SÚMULA ENCERRADA E PLACAR GRAVADO
          </div>
        )}

      </div>
    </div>
  );
}