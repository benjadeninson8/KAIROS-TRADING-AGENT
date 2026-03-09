import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import Groq from "groq-sdk";
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts'; // <--- Corregido a .ts

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Inicializar Binance según la configuración (Spot o Futuros)
const exchange = new ccxt.binance({
  'options': { 'defaultType': KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'future' : 'spot' }
});

async function KAIROS_SISTEMA_COMPLETO() {
    console.log(`\n⚙️ CARGANDO CONFIGURACIÓN DE USUARIO:`);
    console.log(`   🔸 Modo:       ${KAIROS_CONFIG.MARKET_TYPE} (x${KAIROS_CONFIG.LEVERAGE})`);
    console.log(`   🔸 Capital:    ${KAIROS_CONFIG.CAPITAL_VALUE} (${KAIROS_CONFIG.CAPITAL_MODE})`);
    console.log(`   🔸 Estrategia: ${KAIROS_CONFIG.STRATEGY_NAME} en ${KAIROS_CONFIG.TIMEFRAME}`);
    console.log(`--------------------------------------------------`);

    try {
        // 1. Obtener Velas
        console.log(`📡 Leyendo mercado ${KAIROS_CONFIG.PAIR}...`);
        const velas = await exchange.fetchOHLCV(KAIROS_CONFIG.PAIR, KAIROS_CONFIG.TIMEFRAME, undefined, 100);
        
        // Validación y Limpieza
        const preciosCierre = velas.map(v => v[4] as number).filter(p => typeof p === 'number');
        if (preciosCierre.length < 50) throw new Error("Faltan datos históricos");

        // Indicadores Matemáticos
        const rsiRaw = RSI.calculate({ values: preciosCierre, period: 14 });
        const bbRaw = BollingerBands.calculate({ values: preciosCierre, period: 20, stdDev: 2 });
        
        const precioActual = preciosCierre[preciosCierre.length - 1];
        const rsiActual = rsiRaw[rsiRaw.length - 1];
        const bbActual = bbRaw[bbRaw.length - 1];

        // Preparar datos
        const datosMercado = {
            precio: precioActual,
            rsi: rsiActual.toFixed(2),
            bandas: {
                upper: bbActual.upper.toFixed(2),
                lower: bbActual.lower.toFixed(2),
                position: precioActual > bbActual.upper ? "ROMPIENDO_ARRIBA" : precioActual < bbActual.lower ? "ROMPIENDO_ABAJO" : "DENTRO"
            },
            config: KAIROS_CONFIG
        };

        // 2. EL JUICIO
        console.log(`🧠 Consultando al Juez (Llama 3.3)...`);
        
        const promptSistema = `Eres KAIROS, un sistema de trading automatizado operando en modo ${KAIROS_CONFIG.MARKET_TYPE}.
        ESTRATEGIA ACTUAL: ${KAIROS_CONFIG.STRATEGY_NAME}.
        
        Tus reglas de fuego:
        1. Si el RSI > 70, considera VENDER (SHORT).
        2. Si el RSI < 30, considera COMPRAR (LONG).
        3. Solo opera si la confianza es mayor a ${KAIROS_CONFIG.MIN_CONFIDENCE}%.
        4. Calcula Stop Loss (${KAIROS_CONFIG.STOP_LOSS_PERCENT}%) y Take Profit (${KAIROS_CONFIG.TAKE_PROFIT_PERCENT}%) exactos.
        
        Responde SOLO JSON: {"decision": "COMPRAR/VENDER/ESPERAR", "razonamiento": "...", "confianza": 0-100, "entry": 0, "sl": 0, "tp": 0}`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: promptSistema },
                { role: "user", content: `DATOS ACTUALES: ${JSON.stringify(datosMercado)}` }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
        });

        const decision = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // 3. GUARDAR EN MEMORIA
        console.log(`💾 Veredicto: ${decision.decision} (${decision.confianza}%)`);
        
        const { error } = await supabase.from('ai_logs').insert([{
            pair: KAIROS_CONFIG.PAIR,
            price_at_time: precioActual,
            rsi: parseFloat(datosMercado.rsi),
            judge_verdict: decision.decision,
            confidence_score: decision.confianza,
            reasoning: `[${KAIROS_CONFIG.STRATEGY_NAME}] ${decision.razonamiento}`
        }]);
        
        if (error) throw error;
        console.log("✅ Ciclo completado correctamente.");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

export { KAIROS_SISTEMA_COMPLETO };

// --- CORRECCIÓN FINAL: Lógica compatible con ES Modules ---
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    KAIROS_SISTEMA_COMPLETO();
}