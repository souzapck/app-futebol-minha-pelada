export default function VotingSettingsPage() {
  return (
    <div
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid #ddd",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
      }}
    >
      <h3 style={{ marginTop: 0, color: "#333" }}>🗳️ Configurar Votação</h3>

      <div style={{ color: "#666", fontSize: "14px", lineHeight: "1.6" }}>
        Aqui você poderá configurar:
        <br />
        <br />
        Bola Cheia/Murcha
        <br /> 
        <br />• ativa/desativa votação de Bola Cheia e Murcha
        <br />• horário de inicio para votação
        <br />• janela de tempo da votação 1 turno
        <br />• janela de tempo da votação 2 turno  
        <br />• quem pode votar
        <br />• quem pode ser votado        
        <br />
        <br />
        Estrelas do Jogador
        <br />
        <br />• libera votação de estrelas do jogador
        <br />• data de inicio da votação
        <br />• horário de inicio para votação
        <br />• janela de tempo para votação
        <br />• quem pode votar
      </div>
    </div>
  );
}