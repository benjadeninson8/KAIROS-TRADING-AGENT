import Groq from "groq-sdk";
import dotenv from "dotenv";
import Parser from "rss-parser"; // <-- LA ANTENA DE NOTICIAS
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser(); // Inicializamos el lector de feeds

// Definimos la estructura de los datos
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

// 📡 FUNCIÓN PARA HACKEAR LAS NOTICIAS EN TIEMPO REAL
async function obtenerNoticias(par: string) {
  try {
    const baseCoin = par.split('/')[0];
    let keyword = baseCoin;
    
    // Traducimos el ticker al nombre real para buscarlo en las noticias
    if (baseCoin === 'BTC') keyword = 'Bitcoin';
    if (baseCoin === 'ETH') keyword = 'Ethereum';
    if (baseCoin === 'SOL') keyword = 'Solana';

    // Conectamos al feed global de CoinTelegraph
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    
    // Filtramos solo las noticias que hablen de nuestra moneda
    const noticiasFiltradas = feed.items
        .filter(item => item.title?.toLowerCase().includes(keyword.toLowerCase()) || item.contentSnippet?.toLowerCase().includes(keyword.toLowerCase()))
        .slice(0, 3) // Solo tomamos los 3 titulares más recientes
        .map(item => `- ${item.title}`);

    if (noticiasFiltradas.length === 0) {
        return `Sin noticias de alto impacto sobre ${keyword} en las últimas 24 horas.`;
    }
    
    return noticiasFiltradas.join('\n');
  } catch (error) {
    console.error("   ⚠️ Falla en la antena de noticias. Usando modo offline.");
    return "Antena de noticias temporalmente caída.";
  }
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

// 📰 EL AGENTE FUNDAMENTAL (Noticias + Volumen) -> ¡ACTUALIZADO!
async function consultarFundamental(datos: DatosMercado) {
  const estadoVolumen = datos.volumen.esAlto ? "MUY ALTO (Posible inyección institucional)" : "NORMAL/BAJO (Mercado calmado)";
  const titulares = await obtenerNoticias(KAIROS_CONFIG.PAIR);
  
  const prompt = `Eres el Agente Fundamental de un Fondo de Cobertura.
  Tu trabajo es leer las noticias globales y el volumen para ver si el mercado tiene miedo (FUD) o avaricia (FOMO).
  Contexto del Activo: ${KAIROS_CONFIG.PAIR}.
  
  DATOS EN TIEMPO REAL:
  - Estado del Volumen: ${estadoVolumen}
  - Titulares Recientes de las Noticias (Últimas horas):
  ${titulares}
  
  INTERPRETACIÓN OBLIGATORIA:
  1. Si las noticias son negativas/hackeos y el volumen es alto = TERROR (Bearish).
  2. Si las noticias son de adopción/compras y el volumen es alto = EUFORIA (Bullish).
  3. Si no hay noticias = Mercado netamente técnico.
  
  Dame tu análisis del sentimiento fundamental en 1 frase corta. Especifica si las noticias están impulsando algo.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
  return completion.choices[0]?.message?.content || "Mercado sin volumen ni noticias relevantes.";
}

// ⚖️ EL JUEZ SUPREMO (CALIBRADO PARA MATEMÁTICA ESTRICTA)
export async function OBTENER_JUICIO_FINAL(datos: DatosMercado) {
  console.log("   🐮 Bull está analizando...");
  console.log("   🐻 Bear está analizando...");
  console.log("   📰 Fundamental está leyendo noticias globales y volumen...");

  const [argumentoBull, argumentoBear, argumentoFund] = await Promise.all([
    consultarBull(datos),
    consultarBear(datos),
    consultarFundamental(datos)
  ]);

  console.log(`\n🗣️ DEBATE EN LA CORTE:`);
  console.log(`   🐮 BULL: "${argumentoBull.replace(/\n/g, ' ').substring(0, 100)}..."`);
  console.log(`   🐻 BEAR: "${argumentoBear.replace(/\n/g, ' ').substring(0, 100)}..."`);
  console.log(`   📰 FUND: "${argumentoFund.replace(/\n/g, ' ').substring(0, 150)}..."`);
  console.log(`\n⚖️ El Juez está deliberando precios objetivos...`);

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
  - Si el Agente Fundamental detecta noticias PÉSIMAS, ignora al BULL y cancela compras.
  - Si el Agente Fundamental detecta noticias EXCELENTES, ignora al BEAR y cancela ventas.

  Formato JSON OBLIGATORIO:
  {"decision": "COMPRAR" | "VENDER" | "ESPERAR", "razonamiento": "Menciona el Ratio calculado (Ej: Ratio 2.1 favorable) y si alguna noticia influyó.", "confianza": 0-100, "stop_loss_price": 0.00, "take_profit_price": 0.00}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "system", content: promptJuez }],
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" }
  });
const resultadoIA = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return {
    ...resultadoIA,
    debate_bull: argumentoBull,
    debate_bear: argumentoBear,
    debate_fund: argumentoFund
  };
}