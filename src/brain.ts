import Groq from "groq-sdk";
import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Definimos la estructura que QUEREMOS que la IA nos devuelva siempre
// Esto evita que nos responda con "Hola, claro que sí..."
const JSON_STRUCTURE = `
{
  "decision": "COMPRAR" | "VENDER" | "ESPERAR",
  "razonamiento": "Explicación breve de por qué...",
  "confianza": 0-100,
  "stop_loss_sugerido": number,
  "take_profit_sugerido": number
}
`;

async function consultarKairos() {
  console.log("🧠 KAIROS está analizando el mercado...");

  // 1. SIMULAMOS DATOS DEL MERCADO (En la Fase 3, esto vendrá de Binance real)
  const datosSimulados = {
    moneda: "SOL/USDT",
    precio_actual: 142.50,
    rsi: 28, // Sobreventa (Oportunidad de compra técnica)
    bandas_bollinger: "Tocando banda inferior",
    noticia_ultima_hora: "Solana anuncia nueva alianza con Google Cloud."
  };

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Eres KAIROS, un Agente de Trading de Inteligencia Artificial experto en gestión de riesgos.
          Tu trabajo es analizar datos técnicos y fundamentales y tomar decisiones frías.
          
          REGLAS:
          1. Eres escéptico. Prefieres proteger el capital ($10) a arriesgarlo tontamente.
          2. Responde ÚNICAMENTE en formato JSON válido. Sin texto antes ni después.
          3. Sigue esta estructura exacta: ${JSON_STRUCTURE}`
        },
        {
          role: "user",
          content: `Analiza estos datos actuales del mercado: ${JSON.stringify(datosSimulados)}`
        }
      ],
      model: "llama-3.3-70b-versatile", // Usamos el modelo grande y potente de Groq
      temperature: 0, // 0 = Máxima lógica, 0 creatividad (Queremos un robot, no un poeta)
    });

    // Obtenemos la respuesta
    const respuestaIA = completion.choices[0]?.message?.content || "";
    
    // Limpiamos por si la IA pone ```json al principio
    const jsonLimpio = respuestaIA.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Convertimos el texto a Objeto Real de JavaScript
    const decisionFinal = JSON.parse(jsonLimpio);

    console.log("✅ KAIROS HA HABLADO:");
    console.log("------------------------------------------------");
    console.log(`📢 Decisión: ${decisionFinal.decision}`);
    console.log(`🤔 Razón: ${decisionFinal.razonamiento}`);
    console.log(`🛡️ Confianza: ${decisionFinal.confianza}%`);
    console.log(`🛑 Stop Loss: $${decisionFinal.stop_loss_sugerido}`);
    console.log(`🎯 Take Profit: $${decisionFinal.take_profit_sugerido}`);
    console.log("------------------------------------------------");

  } catch (error) {
    console.error("❌ Error cerebral:", error);
  }
}

// Ejecutar la función
consultarKairos();