import TelegramBot from 'node-telegram-bot-api';
import dotenv from "dotenv";

dotenv.config();

// El token de tu Bot "Global" de KAIROS sigue estando en tu .env
const token = process.env.TELEGRAM_BOT_TOKEN;

// 1. Inicializamos el bot con "polling" para que tenga el micrófono abierto
export const botTelegram = token ? new TelegramBot(token, { polling: true }) : null;

// 2. Escudo contra el lag: Silenciamos los errores de red de Telegram 
// para que no te llene la consola de basura si Cantv/Inter tiene un micro-corte.
if (botTelegram) {
    botTelegram.on('polling_error', (error) => {
        // Ignoramos el error en silencio
    });
}

// 3. La función de envío MULTI-CLIENTE
// Fíjate que ahora recibe "userChatId" (el ID de Telegram del dueño de la operación)
export async function ENVIAR_ALERTA(
    mensaje: string, 
    userChatId?: string | null, 
    modoCopiloto: boolean = false
) {
  // Si el bot no está activo o el cliente no puso su ID de Telegram, cancelamos el envío
  if (!botTelegram || !userChatId) return;

  try {
    const opciones: TelegramBot.SendMessageOptions = { parse_mode: 'Markdown' };

    // Si KAIROS necesita permiso, le inyectamos el panel de control al chat
    if (modoCopiloto) {
      opciones.reply_markup = {
        inline_keyboard: [
          [
            { text: "🟢 APROBAR", callback_data: "COPILOT_APPROVE" },
            { text: "🔴 ABORTAR", callback_data: "COPILOT_ABORT" }
          ]
        ]
      };
    }

    // Disparamos el mensaje directamente al celular de ese cliente
    await botTelegram.sendMessage(userChatId, mensaje, opciones);
    console.log(`   📲 Notificación enviada al Telegram del cliente (${userChatId}).`);

  } catch (error: any) {
    console.error(`❌ Error enviando Telegram al cliente ${userChatId}:`, error.message);
  }
}