import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';
import { OBTENER_JUICIO_FINAL } from './brain.ts';
import { EJECUTAR_ORDEN } from './execution.ts';
import { ENVIAR_ALERTA } from './notifier.ts'; // <--- NUEVO IMPORT

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

const exchange = new ccxt.binance({
  'options': { 'defaultType': KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'future' : 'spot' }
});

async function KAIROS_SISTEMA_COMPLETO() {
    console.log(`\n⚙️ INICIANDO KAIROS PRO: ${KAIROS_CONFIG.PAIR} (${KAIROS_CONFIG.TIMEFRAME})`);

    // Mensaje de inicio para Telegram
await ENVIAR_ALERTA(`🟢 *SISTEMA KAIROS INICIADO*\n🔎 Escaneando mercado para ${KAIROS_CONFIG.PAIR}...`);

    try {
        // --- 0. EL FRENO DE MANO (Control Diario) ---
        // Obtenemos fecha de hoy YYYY-MM-DD para contar operaciones
        const hoy = new Date().toISOString().split('T')[0];
        
        const { count, error: countError } = await supabase
            .from('ai_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', hoy)
            .in('judge_verdict', ['COMPRAR', 'VENDER']); // Solo contamos operaciones reales

        if (countError) throw countError;

        const operacionesHoy = count || 0;
        console.log(`   📅 Operaciones hoy: ${operacionesHoy} / ${KAIROS_CONFIG.MAX_TRADES_PER_DAY}`);

        if (operacionesHoy >= KAIROS_CONFIG.MAX_TRADES_PER_DAY) {
            console.log("   ⛔ META DIARIA ALCANZADA. KAIROS SE DETIENE POR HOY.");
            return; // <--- AQUÍ SE DETIENE EL SISTEMA
        }
        // ------------------------------------------------

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

        // 4. NOTIFICACIÓN Y EJECUCIÓN
        // Si el Juez quiere operar, avisamos a Telegram primero
        if (decision.decision !== "ESPERAR") {
            const mensaje = `🚨 *KAIROS SEÑAL DETECTADA*\n` +
                            `🤖 Acción: *${decision.decision}*\n` +
                            `📉 Precio: $${precioActual}\n` +
                            `🛡️ SL: $${decision.stop_loss_price}\n` +
                            `🎯 TP: $${decision.take_profit_price}\n` +
                            `⚖️ Confianza: ${decision.confianza}%`;
            
            await ENVIAR_ALERTA(mensaje);
            
            // Enviamos al ejecutor (que tiene su propio filtro de riesgo)
            await EJECUTAR_ORDEN(decision, precioActual);
        } else {
            console.log("   💤 Juez decidió esperar. Silencio en Telegram.");
        }

    } catch (error) {
        console.error("❌ Error en el sistema:", error);
        await ENVIAR_ALERTA(`⚠️ *ERROR KAIROS*: ${error}`);
    }
}

export { KAIROS_SISTEMA_COMPLETO };

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
    KAIROS_SISTEMA_COMPLETO();
}