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
  volumen?: number;
}

// 🐮 EL AGENTE BULL (Optimista)
async function consultarBull(datos: DatosMercado) {
  const prompt = `Eres el Agente BULL (Alcista). Tu trabajo es convencer al juez de COMPRAR (LONG).
  Analiza estos datos técnicos de ${KAIROS_CONFIG.PAIR} en ${KAIROS_CONFIG.TIMEFRAME}:
  - Precio: ${datos.precio}
  - RSI: ${datos.rsi} (Si está bajo < 30 es tu mejor argumento de sobreventa)
  - Bandas: ${JSON.stringify(datos.bandas)}
  
  Dame 3 razones cortas y agresivas de por qué el precio va a SUBIR.
  Ignora cualquier señal bajista. Tu trabajo es VENDER LA SUBIDA.
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
  - RSI: ${datos.rsi} (Si está alto > 70 es tu mejor argumento de sobrecompra)
  - Bandas: ${JSON.stringify(datos.bandas)}
  
  Dame 3 razones cortas y cínicas de por qué el precio va a CAER.
  Ignora cualquier señal alcista. Tu trabajo es VENDER LA CAÍDA.
  Respuesta máxima: 40 palabras.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Sin argumentos.";
}

// ⚖️ EL JUEZ SUPREMO (Decisión Final)
export async function OBTENER_JUICIO_FINAL(datos: DatosMercado) {
  console.log("   🐮 Bull está analizando...");
  console.log("   🐻 Bear está analizando...");

  // Ejecutamos a los dos abogados en paralelo para que sea rápido
  const [argumentoBull, argumentoBear] = await Promise.all([
    consultarBull(datos),
    consultarBear(datos)
  ]);

  console.log(`\n🗣️ DEBATE EN LA CORTE:`);
  console.log(`   🐮 BULL DICE: "${argumentoBull.replace(/\n/g, ' ')}"`);
  console.log(`   🐻 BEAR DICE: "${argumentoBear.replace(/\n/g, ' ')}"`);
  console.log(`\n⚖️ El Juez está deliberando...`);

  const promptJuez = `Eres KAIROS, el Juez Supremo de Trading.
  Estás operando en MODO: ${KAIROS_CONFIG.MARKET_TYPE} con Apalancamiento x${KAIROS_CONFIG.LEVERAGE}.
  
  Escucha a tus agentes:
  1. BULL (Alcista): "${argumentoBull}"
  2. BEAR (Bajista): "${argumentoBear}"
  
  DATOS REALES: RSI ${datos.rsi}, Precio ${datos.precio}.
  
  TUS REGLAS:
  - Si el RSI está entre 40 y 60, IGNORA a los agentes y decide "ESPERAR" (El mercado está lateral).
  - Solo entra si uno de los agentes tiene un argumento técnico irrefutable Y el RSI lo apoya.
  - Confianza mínima requerida: ${KAIROS_CONFIG.MIN_CONFIDENCE}%.

  Formato JSON OBLIGATORIO:
  {"decision": "COMPRAR" | "VENDER" | "ESPERAR", "razonamiento": "Resumen final del juez", "confianza": 0-100, "stop_loss": 0, "take_profit": 0}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: promptJuez }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0]?.message?.content || "{}");
}