import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

// Configuración
const symbol = 'SOL/USDT';
const timeframe = '1h';

// Inicializar Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function KAIROS_EN_VIVO() {
  console.log(`🚀 INICIANDO SISTEMA KAIROS...`);
  console.log(`📡 Conectando con Binance para ver ${symbol}...`);

  // --- FASE 1: LOS OJOS (Recolectar Datos Reales) ---
  const exchange = new ccxt.binance();
  let datosDeMercado;

  try {
    const velas = await exchange.fetchOHLCV(symbol, timeframe, undefined, 100);
    
    // Validación estricta de datos
    if (!velas || velas.length < 20) throw new Error("Datos insuficientes de Binance");

    // Limpiamos los datos (Solo números válidos)
    const preciosCierre = velas
        .map(v => v[4])
        .filter((p): p is number => typeof p === 'number');

    // Cálculos Matemáticos
    const rsiRaw = RSI.calculate({ values: preciosCierre, period: 14 });
    const bbRaw = BollingerBands.calculate({ values: preciosCierre, period: 20, stdDev: 2 });

    const precioActual = preciosCierre[preciosCierre.length - 1];
    const rsiActual = rsiRaw[rsiRaw.length - 1];
    const bbActual = bbRaw[bbRaw.length - 1];

    // Diagnóstico de Bandas
    let estadoBandas = "Neutro (Dentro del canal)";
    if (precioActual > bbActual.upper) estadoBandas = "SOBRECOMPRA (Rompiendo Arriba)";
    if (precioActual < bbActual.lower) estadoBandas = "SOBREVENTA (Rompiendo Abajo)";

    // Empaquetamos la realidad
    datosDeMercado = {
      precio: precioActual,
      rsi: rsiActual.toFixed(2),
      bandas: estadoBandas,
      banda_superior: bbActual.upper.toFixed(2),
      banda_inferior: bbActual.lower.toFixed(2)
    };

    console.log(`✅ Datos obtenidos: Precio $${precioActual} | RSI ${rsiActual.toFixed(2)}`);

  } catch (error) {
    console.error("❌ Error leyendo el mercado:", error);
    return; // Abortar misión si no hay ojos
  }


  // --- FASE 2: EL CEREBRO (Analizar Datos Reales) ---
  console.log(`🧠 Enviando datos reales a Groq (Llama 3.3)...`);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Eres KAIROS, un trader IA profesional.
          Analiza los datos TÉCNICOS REALES que te paso.
          
          ESTRATEGIA:
          - RSI < 30: Buscar COMPRAS (Oportunidad).
          - RSI > 70: Buscar VENTAS (Peligro).
          - Precio rompiendo bandas: Reversión probable.
          
          Responde EXCLUSIVAMENTE con este JSON:
          {
            "decision": "COMPRAR" | "VENDER" | "ESPERAR",
            "razonamiento": "Explicación breve y técnica",
            "confianza": 0-100,
            "stop_loss": number,
            "take_profit": number
          }`
        },
        {
          role: "user",
          content: `DATOS EN TIEMPO REAL DE AHORA MISMO: ${JSON.stringify(datosDeMercado)}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
    });

    const respuesta = completion.choices[0]?.message?.content || "{}";
    // Limpieza de JSON (por si la IA pone texto extra)
    const jsonLimpio = respuesta.replace(/```json/g, "").replace(/```/g, "").trim();
    const decision = JSON.parse(jsonLimpio);

    console.log("\n========================================");
    console.log("🤖 KAIROS DECISIÓN FINAL (DATOS REALES)");
    console.log("========================================");
    console.log(`📢 ACCIÓN:      ${decision.decision}`);
    console.log(`📝 POR QUÉ:     ${decision.razonamiento}`);
    console.log(`💪 CONFIANZA:   ${decision.confianza}%`);
    console.log(`🛡️ STOP LOSS:   $${decision.stop_loss}`);
    console.log(`💰 TAKE PROFIT: $${decision.take_profit}`);
    console.log("========================================\n");

  } catch (error) {
    console.error("❌ La IA sufrió un derrame:", error);
  }
}

// ¡FUEGO!
KAIROS_EN_VIVO();