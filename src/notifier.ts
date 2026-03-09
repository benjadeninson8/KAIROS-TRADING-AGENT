import dotenv from "dotenv";

dotenv.config();

export async function ENVIAR_ALERTA(mensaje: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Si no hay credenciales, no hacemos nada (pero no rompemos el bot)
  if (!token || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: 'Markdown' // Permite negritas y estilo
      })
    });
    console.log("   📲 Notificación enviada a Telegram.");

  } catch (error) {
    console.error("❌ Error enviando Telegram:", error);
  }
}