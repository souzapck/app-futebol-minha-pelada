import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useGroup } from "../contexts/GroupContext";

export default function FinancePage({ user }) {
  const { activeGroup, isAdmin } = useGroup();
  const [players, setPlayers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // === CONFIGURAÇÃO EM TEMPO REAL ===
  const [mesInicioConfig, setMesInicioConfig] = useState(activeGroup?.mes_inicio_tesouraria || "2024-01");
  const [diaVencimentoConfig, setDiaVencimentoConfig] = useState(activeGroup?.dia_vencimento_tesouraria || 10);

  const [viewMode, setViewMode] = useState("month"); 
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const [paymentModal, setPaymentModal] = useState(null); 
  const [payStatus, setPayStatus] = useState("pago"); 
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("PIX");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (activeGroup) {
      loadFinanceData();
    }
  }, [activeGroup, selectedMonth, viewMode, selectedPlayerId]);

  const loadFinanceData = async () => {
    setLoading(true);

    // 1. Busca a configuração de início e vencimento EM TEMPO REAL
    const { data: groupConfig } = await supabase
      .from("grupos_pelada")
      .select("mes_inicio_tesouraria, dia_vencimento_tesouraria")
      .eq("id_grupo", activeGroup.id_grupo)
      .single();

    if (groupConfig) {
      if (groupConfig.mes_inicio_tesouraria) setMesInicioConfig(groupConfig.mes_inicio_tesouraria);
      if (groupConfig.dia_vencimento_tesouraria) setDiaVencimentoConfig(groupConfig.dia_vencimento_tesouraria);
    }

    // 2. Busca membros
    const { data: membersData, error: membersError } = await supabase
      .from("grupo_membros")
      .select(`
        player_id,
        tipo_jogador,
        data_inclusao,
        data_desativacao,
        players ( id, name )
      `)
      .eq("id_grupo", activeGroup.id_grupo)
      .order("player_id");

    if (membersError) console.error("Erro ao buscar membros:", membersError);

    let filteredMembers = membersData ? membersData.filter(p => 
      p.tipo_jogador?.toLowerCase() === "mensalista" && Number(p.player_id) !== 1
    ) : [];
    
    // 👉 ORDENAÇÃO ALFABÉTICA GLOBAL DOS MENSALISTAS
    filteredMembers.sort((a, b) => {
      const nameA = a.players?.name || "";
      const nameB = b.players?.name || "";
      return nameA.localeCompare(nameB);
    });
    
    setPlayers(filteredMembers);

    if (viewMode === "player" && !selectedPlayerId && filteredMembers.length > 0) {
      setSelectedPlayerId(filteredMembers[0].player_id);
    }

    // 3. Busca pagamentos
    let paymentsQuery = supabase.from("mensalidades").select("*").eq("id_grupo", activeGroup.id_grupo);
    
    if (!isAdmin) {
       paymentsQuery = paymentsQuery.eq("player_id", user.player_id);
    } else if (viewMode === "month") {
       paymentsQuery = paymentsQuery.eq("mes_ano", selectedMonth);
    } else if (viewMode === "player" && selectedPlayerId) {
       paymentsQuery = paymentsQuery.eq("player_id", selectedPlayerId);
    }

    const { data: paymentsData, error: paymentsError } = await paymentsQuery;
    if (paymentsError) console.error("Erro ao buscar pagamentos:", paymentsError);

    setPayments(paymentsData || []);
    setLoading(false);
  };

  const isPlayerEligibleForMonth = (player, monthStr) => {
    if (!player) return false;

    const [startYear, startMonth] = mesInicioConfig.split('-').map(Number);
    const limitConfigDate = new Date(startYear, startMonth - 1, 1);

    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    if (monthStart < limitConfigDate) return false;

    const inclusao = player.data_inclusao ? new Date(player.data_inclusao) : new Date("2000-01-01");
    const desativacao = player.data_desativacao ? new Date(player.data_desativacao) : null;

    if (inclusao > monthEnd) return false;
    if (desativacao && desativacao < monthStart) return false;

    return true;
  };

  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const [startYear, startMonth] = mesInicioConfig.split('-').map(Number);
    const limitDate = new Date(startYear, startMonth - 1, 1);

    for (let i = 0; i < 36; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      
      if (d < limitDate) break;

      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options; 
  };

  const monthOptions = generateMonthOptions();

  const getStatusVisual = (pgt, monthStr) => {
    if (pgt && pgt.status === "pago") return { text: "✅ PAGO", bg: "#d4edda", color: "#155724" };
    if (pgt && pgt.status === "isento") return { text: "🎁 ISENTO", bg: "#e2e3e5", color: "#383d41" };

    const [year, month] = monthStr.split('-').map(Number);
    const dueDate = new Date(year, month - 1, diaVencimentoConfig, 23, 59, 59);

    if (new Date() > dueDate) {
      return { text: "🚨 ATRASADO", bg: "#f8d7da", color: "#721c24" };
    }
    
    return { text: "⏳ PENDENTE", bg: "#fff3cd", color: "#856404" };
  };

  const handleOpenPaymentModal = (playerId, monthStr) => {
    setPayStatus("pago"); 
    setPayDate(new Date().toISOString().split("T")[0]); 
    setPayMethod("PIX");
    setPaymentModal({ playerId, monthStr });
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal) return;

    const { playerId, monthStr } = paymentModal;
    
    const finalData = payStatus === "pago" ? payDate : null;
    const finalMethod = payStatus === "pago" ? payMethod : "Isenção";

    setPayments(prev => {
      const exists = prev.find(p => p.player_id === playerId && p.mes_ano === monthStr);
      const updatedRecord = { player_id: playerId, mes_ano: monthStr, status: payStatus, data_pagamento: finalData, forma_pagamento: finalMethod };
      if (exists) return prev.map(p => (p.player_id === playerId && p.mes_ano === monthStr) ? { ...p, ...updatedRecord } : p);
      return [...prev, updatedRecord];
    });

    setPaymentModal(null); 

    await supabase.from("mensalidades").upsert({
      id_grupo: activeGroup.id_grupo,
      player_id: playerId,
      mes_ano: monthStr,
      status: payStatus,
      data_pagamento: finalData,
      forma_pagamento: finalMethod
    }, { onConflict: "id_grupo, player_id, mes_ano" });
  };

  const handleUndoPayment = async (playerId, monthStr) => {
    setPayments(prev => prev.map(p => (p.player_id === playerId && p.mes_ano === monthStr) ? { ...p, status: "pendente", data_pagamento: null, forma_pagamento: null } : p));
    
    await supabase.from("mensalidades").upsert({
      id_grupo: activeGroup.id_grupo,
      player_id: playerId,
      mes_ano: monthStr,
      status: "pendente",
      data_pagamento: null,
      forma_pagamento: null
    }, { onConflict: "id_grupo, player_id, mes_ano" });
  };

  const handleCopyPix = () => {
    if (!activeGroup?.chave_pix) return alert("O administrador ainda não cadastrou a chave PIX nas configurações.");
    navigator.clipboard.writeText(activeGroup.chave_pix);
    alert("✅ Chave PIX copiada para a área de transferência!");
  };

  const eligiblePlayersForSelectedMonth = players.filter(p => isPlayerEligibleForMonth(p, selectedMonth));
  
  // === ORDENAÇÃO INTELIGENTE PARA A VISÃO DO ADMIN ===
  const sortedEligiblePlayers = [...eligiblePlayersForSelectedMonth].sort((a, b) => {
    const pgtA = payments.find(pay => pay.player_id === a.player_id && pay.mes_ano === selectedMonth);
    const pgtB = payments.find(pay => pay.player_id === b.player_id && pay.mes_ano === selectedMonth);

    // Pesos: 1 = Pendente (topo), 2 = Pago (meio), 3 = Isento (fundo)
    const pesoA = pgtA?.status === "pago" ? 2 : pgtA?.status === "isento" ? 3 : 1;
    const pesoB = pgtB?.status === "pago" ? 2 : pgtB?.status === "isento" ? 3 : 1;
    
    // Se o status for diferente, ordena pelo peso
    if (pesoA !== pesoB) return pesoA - pesoB;
    
    // Se o status for igual, ordena alfabeticamente
    return (a.players?.name || "").localeCompare(b.players?.name || "");
  });

  const pagos = eligiblePlayersForSelectedMonth.filter(p => payments.find(pay => pay.player_id === p.player_id && pay.mes_ano === selectedMonth && pay.status === "pago")).length;
  const isentos = eligiblePlayersForSelectedMonth.filter(p => payments.find(pay => pay.player_id === p.player_id && pay.mes_ano === selectedMonth && pay.status === "isento")).length;
  const pendentes = eligiblePlayersForSelectedMonth.length - pagos - isentos;

  const formatDateBR = (isoDate) => {
    if (!isoDate) return "";
    const [ano, mes, dia] = isoDate.split("T")[0].split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
      
      {isAdmin && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => setViewMode("month")} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: viewMode === "month" ? "#007bff" : "#e9ecef", color: viewMode === "month" ? "#fff" : "#444", fontWeight: "bold", cursor: "pointer" }}>📅 Por Mês</button>
          <button onClick={() => setViewMode("player")} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: viewMode === "player" ? "#007bff" : "#e9ecef", color: viewMode === "player" ? "#fff" : "#444", fontWeight: "bold", cursor: "pointer" }}>👤 Por Jogador</button>
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, #007bff 0%, #0056b3 100%)", padding: "20px", borderRadius: "12px", color: "white", marginBottom: "20px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,123,255,0.2)" }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>💸 Tesouraria da Pelada</h3>
        <p style={{ margin: "0 0 15px 0", fontSize: "13px", opacity: 0.9 }}>
          {activeGroup?.chave_pix ? `PIX: ${activeGroup.chave_pix}` : "Nenhuma chave PIX cadastrada"}
        </p>
        <button onClick={handleCopyPix} style={{ background: "#fff", color: "#007bff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", width: "100%", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>📋 Copiar Chave PIX</button>
      </div>

      {/* ========================================================= */}
      {/* VISAO DO JOGADOR (Privacidade Total)                        */}
      {/* ========================================================= */}
      {!isAdmin && (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ padding: "15px", background: "#f8f9fa", borderBottom: "1px solid #eee", fontWeight: "bold", color: "#555", fontSize: "14px" }}>
            Seu Histórico de Pagamentos
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            {loading ? <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Carregando...</div> : null}
            
            {!loading && monthOptions.filter(m => isPlayerEligibleForMonth(players.find(p => p.player_id === user.player_id), m.value)).map((monthOpt) => {
              const pgt = payments.find(pay => pay.mes_ano === monthOpt.value);
              const statusData = getStatusVisual(pgt, monthOpt.value);

              return (
                <div key={monthOpt.value} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "bold", color: "#333", fontSize: "15px", textTransform: "capitalize" }}>{monthOpt.label}</span>
                    {statusData.text === "✅ PAGO" && <span style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Pago em: <strong>{formatDateBR(pgt.data_pagamento)}</strong> via <strong>{pgt.forma_pagamento}</strong></span>}
                    {statusData.text === "🎁 ISENTO" && <span style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Mês isento de cobrança</span>}
                    {statusData.text === "⏳ PENDENTE" && <span style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>Aguardando pagamento no prazo</span>}
                    {statusData.text === "🚨 ATRASADO" && <span style={{ fontSize: "11px", color: "#721c24", marginTop: "4px", fontWeight: "bold" }}>Pagamento em atraso</span>}
                  </div>
                  <div>
                    <span style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "900", background: statusData.bg, color: statusData.color, border: statusData.text === "🎁 ISENTO" ? "1px solid #d6d8db" : "none" }}>
                      {statusData.text}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {!loading && monthOptions.filter(m => isPlayerEligibleForMonth(players.find(p => p.player_id === user.player_id), m.value)).length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: "#888", fontSize: "14px" }}>Nenhum mês elegível para cobrança no momento.</div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISAO DO ADMIN: POR MÊS                                   */}
      {/* ========================================================= */}
      {isAdmin && viewMode === "month" && (
        <>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontWeight: "bold", color: "#444", fontSize: "14px" }}>Mês Base:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc", outline: "none", background: "#f8f9fa", fontWeight: "bold" }}>
              {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              {monthOptions.length === 0 && <option value="">Sem meses elegíveis</option>}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            <div style={{ background: "#ebfbee", border: "1px solid #c3e6cb", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#2b8a3e" }}>{pagos}</div>
              <div style={{ fontSize: "10px", fontWeight: "bold", color: "#2f9e44", textTransform: "uppercase" }}>Pagos</div>
            </div>
            <div style={{ background: "#f8f9fa", border: "1px solid #dae0e5", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#495057" }}>{isentos}</div>
              <div style={{ fontSize: "10px", fontWeight: "bold", color: "#6c757d", textTransform: "uppercase" }}>Isentos</div>
            </div>
            <div style={{ background: "#fff5f5", border: "1px solid #f5c6cb", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#c92a2a" }}>{pendentes}</div>
              <div style={{ fontSize: "10px", fontWeight: "bold", color: "#e03131", textTransform: "uppercase" }}>Pendentes</div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "15px", background: "#f8f9fa", borderBottom: "1px solid #eee", fontWeight: "bold", color: "#555", fontSize: "14px" }}>Status dos Mensalistas Elegíveis</div>
            
            {loading ? <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Carregando...</div> : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {sortedEligiblePlayers.map((p) => {
                  const pgt = payments.find(pay => pay.player_id === p.player_id && pay.mes_ano === selectedMonth);
                  const statusData = getStatusVisual(pgt, selectedMonth);

                  return (
                    <div key={p.player_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid #f5f5f5" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "bold", color: "#333", fontSize: "14px" }}>{p.players?.name}</span>
                        {statusData.text === "✅ PAGO" && <span style={{ fontSize: "10px", color: "#28a745", fontWeight: "bold", marginTop: "4px" }}>✅ PAGO - {formatDateBR(pgt.data_pagamento)} ({pgt.forma_pagamento})</span>}
                        {statusData.text === "🎁 ISENTO" && <span style={{ fontSize: "10px", color: "#6c757d", fontWeight: "bold", marginTop: "4px" }}>🎁 MÊS ISENTO</span>}
                        {statusData.text === "⏳ PENDENTE" && <span style={{ fontSize: "10px", color: "#856404", fontWeight: "bold", marginTop: "4px" }}>⏳ PENDENTE (No Prazo)</span>}
                        {statusData.text === "🚨 ATRASADO" && <span style={{ fontSize: "10px", color: "#dc3545", fontWeight: "bold", marginTop: "4px" }}>🚨 ATRASADO</span>}
                      </div>
                      <div>
                        {statusData.text === "✅ PAGO" || statusData.text === "🎁 ISENTO" ? (
                          <button onClick={() => handleUndoPayment(p.player_id, selectedMonth)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "11px", fontWeight: "bold", cursor: "pointer", background: "#f8f9fa", color: "#666" }}>Desfazer</button>
                        ) : (
                          <button onClick={() => handleOpenPaymentModal(p.player_id, selectedMonth)} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: "bold", cursor: "pointer", background: "#007bff", color: "#fff", boxShadow: "0 2px 4px rgba(0,123,255,0.2)" }}>Resolver</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sortedEligiblePlayers.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#888", fontSize: "14px" }}>Nenhum mensalista elegível na competência selecionada.</div>}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VISAO DO ADMIN: POR JOGADOR                               */}
      {/* ========================================================= */}
      {isAdmin && viewMode === "player" && (
        <>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #eee", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontWeight: "bold", color: "#444", fontSize: "14px" }}>👤 Jogador:</label>
            <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(Number(e.target.value))} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc", outline: "none", background: "#f8f9fa", fontWeight: "bold", maxWidth: "65%" }}>
              {players.map(p => <option key={p.player_id} value={p.player_id}>{p.players?.name}</option>)}
            </select>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "15px", background: "#f8f9fa", borderBottom: "1px solid #eee", fontWeight: "bold", color: "#555", fontSize: "14px" }}>Histórico de Pagamentos</div>
            
            {loading ? <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Carregando...</div> : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {monthOptions.filter(m => isPlayerEligibleForMonth(players.find(p => p.player_id === selectedPlayerId), m.value)).map((monthOpt) => {
                  const pgt = payments.find(pay => pay.mes_ano === monthOpt.value);
                  const statusData = getStatusVisual(pgt, monthOpt.value);

                  return (
                    <div key={monthOpt.value} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid #f5f5f5" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "bold", color: "#333", fontSize: "14px", textTransform: "capitalize" }}>{monthOpt.label}</span>
                        {statusData.text === "✅ PAGO" && <span style={{ fontSize: "10px", color: "#28a745", fontWeight: "bold", marginTop: "4px" }}>✅ PAGO - {formatDateBR(pgt.data_pagamento)} ({pgt.forma_pagamento})</span>}
                        {statusData.text === "🎁 ISENTO" && <span style={{ fontSize: "10px", color: "#6c757d", fontWeight: "bold", marginTop: "4px" }}>🎁 MÊS ISENTO</span>}
                        {statusData.text === "⏳ PENDENTE" && <span style={{ fontSize: "10px", color: "#856404", fontWeight: "bold", marginTop: "4px" }}>⏳ PENDENTE (No Prazo)</span>}
                        {statusData.text === "🚨 ATRASADO" && <span style={{ fontSize: "10px", color: "#dc3545", fontWeight: "bold", marginTop: "4px" }}>🚨 ATRASADO</span>}
                      </div>

                      <div>
                        {statusData.text === "✅ PAGO" || statusData.text === "🎁 ISENTO" ? (
                          <button onClick={() => handleUndoPayment(selectedPlayerId, monthOpt.value)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "11px", fontWeight: "bold", cursor: "pointer", background: "#f8f9fa", color: "#666" }}>Desfazer</button>
                        ) : (
                          <button onClick={() => handleOpenPaymentModal(selectedPlayerId, monthOpt.value)} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: "bold", cursor: "pointer", background: "#007bff", color: "#fff" }}>Resolver</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!loading && monthOptions.filter(m => isPlayerEligibleForMonth(players.find(p => p.player_id === selectedPlayerId), m.value)).length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center", color: "#888", fontSize: "14px" }}>Nenhum mês elegível para este jogador.</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL INTELIGENTE DE RESOLUÇÃO                              */}
      {/* ========================================================= */}
      {paymentModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", width: "100%", maxWidth: "350px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#333", fontSize: "18px", textAlign: "center" }}>Resolver Mensalidade</h3>
            
            <form onSubmit={handleConfirmPayment} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              <div style={{ display: "flex", background: "#f1f3f5", borderRadius: "8px", padding: "4px" }}>
                <button 
                  type="button" 
                  onClick={() => setPayStatus("pago")} 
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", fontWeight: "bold", fontSize: "12px", cursor: "pointer", background: payStatus === "pago" ? "#fff" : "transparent", color: payStatus === "pago" ? "#007bff" : "#6c757d", boxShadow: payStatus === "pago" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}
                >
                  💰 Recebimento
                </button>
                <button 
                  type="button" 
                  onClick={() => setPayStatus("isento")} 
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", fontWeight: "bold", fontSize: "12px", cursor: "pointer", background: payStatus === "isento" ? "#fff" : "transparent", color: payStatus === "isento" ? "#495057" : "#6c757d", boxShadow: payStatus === "isento" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}
                >
                  🎁 Conceder Isenção
                </button>
              </div>

              {payStatus === "pago" ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>Data do Pagamento</label>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", outline: "none", fontSize: "14px" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>Forma de Pagamento</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box", outline: "none", fontSize: "14px", backgroundColor: "#f8f9fa" }}>
                      <option value="PIX">PIX</option>
                      <option value="Dinheiro">Dinheiro Físico</option>
                      <option value="Cartão">Cartão</option>
                    </select>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "10px", color: "#6c757d", fontSize: "13px" }}>
                  O jogador não será cobrado por este mês e a situação ficará regularizada.
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setPaymentModal(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "#e2e6ea", color: "#333", fontWeight: "bold", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: payStatus === "pago" ? "#28a745" : "#495057", color: "#fff", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.15)" }}>
                  {payStatus === "pago" ? "✅ Confirmar" : "✅ Isentar Mês"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}