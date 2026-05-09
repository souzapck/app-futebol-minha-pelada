export async function sendWhatsAppNotification(event) {
  try {
    const response = await fetch("/api/whatsapp-notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ event })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Erro ao enviar notificação WhatsApp");
    }

    return data;
  } catch (error) {
    console.error("Erro no envio WhatsApp:", error);
    return null;
  }
}