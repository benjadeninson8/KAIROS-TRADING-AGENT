import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';
import { OBTENER_JUICIO_FINAL } from './brain.ts';
import { EJECUTAR_ORDEN } from './execution.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

const exchange = new ccxt.binance({
  'options': { 'defaultType': KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'future' : 'spot' }
});

async function KAIROS_SISTEMA_COMPLETO() {
    console.log(`\n⚙️ INICIANDO KAIROS PRO: ${KAIROS_CONFIG.PAIR} (${KAIROS_CONFIG.TIMEFRAME})`);

    try {
        // 1. LECTURA PROFUNDA DEL MERCADO
        const velas = await exchange.fetchOHLCV(KAIROS_CONFIG.PAIR, KAIROS_CONFIG.TIMEFRAME, undefined, 100);
        
        const preciosCierre = velas.map(v => v[4] as number);
        const volumenes = velas.map(v => v[5] as number);
        
        // Indicadores Técnicos
        const rsiRaw = RSI.calculate({ values: preciosCierre, period: 14 });
        const bbRaw = BollingerBands.calculate({ values: preciosCierre, period: 20, stdDev: 2 });
        
        const precioActual = preciosCierre[preciosCierre.length - 1];
        const volumenActual = volumenes[volumenes.length - 1];
        const volumenPromedio = volumenes.reduce((a, b) => a + b, 0) / volumenes.length;
        
        const rsiActual = rsiRaw[rsiRaw.length - 1];
        const bbActual = bbRaw[bbRaw.length - 1];

        // Paquete de Datos para el Cerebro
        const datosMercado = {
            precio: precioActual,
            rsi: rsiActual.toFixed(2),
            volumen: {
                actual: volumenActual,
                promedio: volumenPromedio,
                esAlto: volumenActual > (volumenPromedio * 1.5)
            },
            bandas: {
                upper: bbActual.upper.toFixed(2),
                lower: bbActual.lower.toFixed(2),
                width: (bbActual.upper - bbActual.lower).toFixed(2)
            }
        };

        // 2. EL CEREBRO
        console.log(`🧠 Analizando Estructura, Volumen y Sentimiento...`);
        const decision = await OBTENER_JUICIO_FINAL(datosMercado);

        // 3. LA BITÁCORA
        console.log(`\n💾 Veredicto: ${decision.decision} | Confianza: ${decision.confianza}%`);
        
        // Log extra para ver la magia de los precios dinámicos
        if (decision.take_profit_price && decision.stop_loss_price) {
             console.log(`   🎯 PLAN DE VUELO: Entrar @ ${precioActual} -> TP: ${decision.take_profit_price} | SL: ${decision.stop_loss_price}`);
        }

        const { error } = await supabase.from('ai_logs').insert([{
            pair: KAIROS_CONFIG.PAIR,
            price_at_time: precioActual,
            rsi: parseFloat(datosMercado.rsi),
            judge_verdict: decision.decision,
            confidence_score: decision.confianza,
            reasoning: `[JUEZ] ${decision.razonamiento}` 
        }]);

        if (error) throw error;

        // 4. LA EJECUCIÓN (Paso crítico: Enviamos el plan completo al ejecutor)
        await EJECUTAR_ORDEN(decision, precioActual);

    } catch (error) {
        console.error("❌ Error en el sistema:", error);
    }
}

export { KAIROS_SISTEMA_COMPLETO };

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    KAIROS_SISTEMA_COMPLETO();
}