import Groq from "groq-sdk";
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Definimos la estructura de los datos que reciben los agentes
interface DatosMercado {
  precio: number;
  rsi: string;
  bandas: any;
  volumen: {
    actual: number;
    promedio: number;
    esAlto: boolean;
  };
}

// 🐮 EL AGENTE BULL (Optimista)
async function consultarBull(datos: DatosMercado) {
  const prompt = `Eres el Agente BULL (Alcista). Tu trabajo es convencer al juez de COMPRAR (LONG).
  Analiza estos datos técnicos de ${KAIROS_CONFIG.PAIR} en ${KAIROS_CONFIG.TIMEFRAME}:
  - Precio: ${datos.precio}
  - RSI: ${datos.rsi}
  - Bandas Bollinger: ${JSON.stringify(datos.bandas)}
  
  Dame 3 razones cortas y agresivas de por qué el precio va a SUBIR.
  Si el precio está tocando la Banda Inferior, GRITA que es un rebote.
  Respuesta máxima: 40 palabras.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Sin argumentos.";
}

// 🐻 EL AGENTE BEAR (Pesimista)
async function consultarBear(datos: DatosMercado) {
  const prompt = `Eres el Agente BEAR (Bajista). Tu trabajo es convencer al juez de VENDER (SHORT).
  Analiza estos datos técnicos de ${KAIROS_CONFIG.PAIR} en ${KAIROS_CONFIG.TIMEFRAME}:
  - Precio: ${datos.precio}
  - RSI: ${datos.rsi}
  - Bandas Bollinger: ${JSON.stringify(datos.bandas)}
  
  Dame 3 razones cortas y cínicas de por qué el precio va a CAER.
  Si el precio toca la Banda Superior, argumenta que está sobreextendido.
  Respuesta máxima: 40 palabras.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Sin argumentos.";
}

// 📰 EL AGENTE FUNDAMENTAL (Analista de Volumen)
async function consultarFundamental(datos: DatosMercado) {
  const estadoVolumen = datos.volumen.esAlto ? "MUY ALTO (Posible Noticia)" : "NORMAL/BAJO";
  
  const prompt = `Actúa como Analista de Sentimiento de Mercado.
  Contexto: ${KAIROS_CONFIG.PAIR}.
  - Volumen Actual: ${estadoVolumen}
  - Acción de Precio: El precio actual es ${datos.precio}.
  
  INTERPRETACIÓN:
  1. Volumen ALTO + Precio cayendo = Pánico/Noticias Malas (Bearish).
  2. Volumen ALTO + Precio subiendo = FOMO/Noticias Buenas (Bullish).
  3. Volumen BAJO = Falta de interés (Neutral/Esperar).
  
  Dame tu análisis del sentimiento en 1 frase corta.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Mercado sin volumen relevante.";
}

// ⚖️ EL JUEZ SUPREMO (CALIBRADO PARA MATEMÁTICA ESTRICTA)
export async function OBTENER_JUICIO_FINAL(datos: DatosMercado) {
  console.log("   🐮 Bull está analizando...");
  console.log("   🐻 Bear está analizando...");
  console.log("   📰 Fundamental está leyendo el volumen...");

  const [argumentoBull, argumentoBear, argumentoFund] = await Promise.all([
    consultarBull(datos),
    consultarBear(datos),
    consultarFundamental(datos)
  ]);

  console.log(`\n🗣️ DEBATE EN LA CORTE:`);
  console.log(`   🐮 BULL: "${argumentoBull.replace(/\n/g, ' ').substring(0, 100)}..."`);
  console.log(`   🐻 BEAR: "${argumentoBear.replace(/\n/g, ' ').substring(0, 100)}..."`);
  console.log(`   📰 FUND: "${argumentoFund.replace(/\n/g, ' ').substring(0, 100)}..."`);
  console.log(`\n⚖️ El Juez está deliberando precios objetivos...`);

  // --- AQUÍ ESTÁ EL CAMBIO CLAVE: REGLAS MATEMÁTICAS ESTRICTAS ---
  const promptJuez = `Eres KAIROS, un Gestor de Riesgo Algorítmico (No emocional).
  
  DATOS DUROS:
  - Precio Actual: ${datos.precio}
  - Banda Superior: ${datos.bandas.upper}
  - Banda Inferior: ${datos.bandas.lower}
  - RSI: ${datos.rsi} (Si está entre 45-55 es RANGO/LATERAL -> PELIGRO).
  
  EVIDENCIA:
  - Bull: "${argumentoBull}"
  - Bear: "${argumentoBear}"
  - Fundamental: "${argumentoFund}"
  
  TU TRABAJO (Sigue estos pasos):
  1. Define la Dirección: ¿Bullish, Bearish o Neutral?
  2. Define Objetivos:
     - COMPRA (LONG): TP = Banda Superior | SL = Debajo de soporte reciente.
     - VENTA (SHORT): TP = Banda Inferior | SL = Encima de resistencia reciente.
  3. CALCULA EL RATIO (CRÍTICO):
     - Beneficio = Distancia al TP.
     - Riesgo = Distancia al SL.
     - Ratio = Beneficio / Riesgo.
  
  REGLAS DE FUEGO:
  - Si el Ratio es MENOR a 1.5, DEBES RESPONDER "ESPERAR". (No vale la pena el riesgo).
  - Si el RSI está neutral (45-55) y las bandas son estrechas, RESPONDE "ESPERAR".
  - Si el Agente Fundamental dice "Volumen Bajo", sé más exigente con el técnico.

  Formato JSON OBLIGATORIO:
  {"decision": "COMPRAR" | "VENDER" | "ESPERAR", "razonamiento": "Menciona el Ratio calculado (Ej: Ratio 2.1 favorable)", "confianza": 0-100, "stop_loss_price": 0.00, "take_profit_price": 0.00}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: promptJuez }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0]?.message?.content || "{}");
}