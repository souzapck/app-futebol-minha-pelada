export default function PointsSettingsPage() {
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
      <h3 style={{ marginTop: 0, color: "#333" }}>📊 Parametrizações de Pontuação</h3>

      <div style={{ color: "#666", fontSize: "14px", lineHeight: "1.6" }}>
        Aqui você poderá configurar:
        <br />• peso da vitória
        <br />• peso do empate
        <br />• peso do gol
        <br />• peso do gol contra
        <br />• peso da Bola Cheia
        <br />• peso da Bola Murcha
      </div>
    </div>
  );
}