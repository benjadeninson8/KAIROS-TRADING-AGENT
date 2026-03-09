import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';
import { OBTENER_JUICIO_FINAL } from './brain.ts'; // <--- IMPORTAMOS AL JUEZ Y LOS ABOGADOS

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

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
        // 1. OBTENER DATOS DE MERCADO (OJOS)
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

        // Preparar el paquete de datos
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

        // 2. EL JUICIO (SISTEMA DE 3 AGENTES) - AHORA LLAMAMOS AL CEREBRO COMPLEJO
        console.log(`🧠 Invocando a la Corte Suprema de IA...`);
        const decision = await OBTENER_JUICIO_FINAL(datosMercado);

        // 3. GUARDAR EN MEMORIA (DATABASE)
        console.log(`\n💾 Veredicto Final: ${decision.decision} (${decision.confianza}%)`);
        
        const { error } = await supabase.from('ai_logs').insert([{
            pair: KAIROS_CONFIG.PAIR,
            price_at_time: precioActual,
            rsi: parseFloat(datosMercado.rsi),
            judge_verdict: decision.decision,
            confidence_score: decision.confianza,
            // Guardamos el resumen del juez + los argumentos de los abogados si quieres expandirlo luego
            reasoning: `[JUEZ] ${decision.razonamiento}` 
        }]);
        
        if (error) throw error;
        console.log("✅ Decisión guardada en Supabase.");

    } catch (error) {
        console.error("❌ Error CRÍTICO:", error);
    }
}

export { KAIROS_SISTEMA_COMPLETO };

// --- Ejecución directa si se llama desde terminal ---
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    KAIROS_SISTEMA_COMPLETO();
}