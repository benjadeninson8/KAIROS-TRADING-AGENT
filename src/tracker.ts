import ccxt from 'ccxt';
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import { ENVIAR_ALERTA } from './notifier.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

// Fíjate que el Sabueso ahora rastrea a un cliente específico a la vez
export async function RASTREAR_RESULTADOS(userConfig: any) {
    if (!userConfig.bybit_api_key || !userConfig.bybit_api_secret) return;

    // 1. Inicializamos Bybit CON LAS LLAVES DEL CLIENTE
    const exchange = new ccxt.bybit({
        apiKey: userConfig.bybit_api_key,
        secret: userConfig.bybit_api_secret,
        enableRateLimit: true,
        options: { 'defaultType': userConfig.market_type === 'FUTURE' ? 'swap' : 'spot' }
    });

    if (process.env.KAIROS_MODE === 'TEST') exchange.setSandboxMode(true);

    try {
        // 2. Buscamos si ESTE CLIENTE tiene alguna operación "Pendiente" en Supabase
        const { data: logs, error: selectError } = await supabase
            .from('ai_logs')
            .select('*')
            .eq('user_id', userConfig.user_id) // <-- FILTRO MULTI-CLIENTE
            .eq('pair', userConfig.pair)
            .is('pnl_result', null) 
            .order('created_at', { ascending: false })
            .limit(1);

        if (selectError) throw selectError;

        if (!logs || logs.length === 0) {
            // Se silencia para no spammar la consola cuando hay muchos clientes
            return;
        }

        const logPendiente = logs[0];
        console.log(`  🐕 [${userConfig.user_id.substring(0,6)}] Rastreando operación ID: ${logPendiente.id}...`);

        // 3. Verificar si la operación TODAVÍA está viva en Bybit
        const parFinal = userConfig.market_type === 'FUTURE' ? `${userConfig.pair}:USDT` : userConfig.pair;
        const posiciones = await exchange.fetchPositions([parFinal]);
        const posicionActiva = posiciones.find(p => p.symbol === parFinal && Math.abs(Number(p.contracts || 0)) > 0);

        if (posicionActiva) {
            // ==========================================
            // 🛡️ EL ESCUDO BREAKEVEN (Fijado en 15% para todos en el SaaS)
            // ==========================================
            if (userConfig.market_type === 'FUTURE') {
              const entryPrice = Number(posicionActiva.entryPrice || 0);
              const unrealizedPnl = Number(posicionActiva.unrealizedPnl || 0);
              const initialMargin = Number(posicionActiva.initialMargin || 0);
              const currentStopLoss = Number(posicionActiva.info?.stopLoss || 0);

                let gananciaPorcentaje = 0;
                if (initialMargin > 0) {
                    gananciaPorcentaje = (unrealizedPnl / initialMargin) * 100;
                }

                // Dispara el breakeven al 15% de ganancia de RoE
                if (gananciaPorcentaje >= 15) {
                    const diferenciaSL = Math.abs(currentStopLoss - entryPrice);
                    
                    if (diferenciaSL > (entryPrice * 0.0005)) { 
                        console.log(`  🛡️ [${userConfig.user_id.substring(0,6)}] BREAKEVEN: +${gananciaPorcentaje.toFixed(2)}%. Subiendo escudos...`);
                        
                        try {
                            const symbolAjustado = userConfig.pair.replace('/', '');
                            await (exchange as any).privatePostV5PositionTradingStop({
                                category: 'linear',
                                symbol: symbolAjustado,
                                stopLoss: entryPrice.toString(),
                                tpslMode: 'Full',
                                positionIdx: 0
                            });
                            
                            console.log(`  ✅ Escudo activado. SL movido a entrada: $${entryPrice}`);
                            await ENVIAR_ALERTA(`🛡️ *ESCUDO BREAKEVEN ACTIVADO*\n\n📈 La operación en ${userConfig.pair} alcanzó un +${gananciaPorcentaje.toFixed(2)}%.\n🔒 Riesgo en $0. ¡Operación gratis!`, userConfig.telegram_chat_id);
                        } catch (e: any) {
                            console.error("  ❌ Error subiendo Breakeven:", e.message);
                        }
                    }
                }
            }
            // ==========================================
            return;
        }

        // 4. Si no hay posición activa, ¡Significa que ya se cerró!
        let pnlFinal = 0;

        if (userConfig.market_type === 'FUTURE') {
            const symbolAjustado = userConfig.pair.replace('/', ''); 
            
            const response = await (exchange as any).privateGetV5PositionClosedPnl({
                category: 'linear',
                symbol: symbolAjustado,
                limit: 1 
            });
            
            if (response.result && response.result.list && response.result.list.length > 0) {
                pnlFinal = parseFloat(response.result.list[0].closedPnl);
            } else {
                return;
            }
        }

        // 5. Decidimos si fue WIN o LOSS
        const resultado = pnlFinal > 0 ? 'WIN' : 'LOSS';
        
        // 6. Actualizamos ESA operación en Supabase
        const { error: updateError } = await supabase
            .from('ai_logs')
            .update({ 
                pnl_result: resultado,
                pnl_amount: pnlFinal
            })
            .eq('id', logPendiente.id); 

        if (updateError) {
            console.error("❌ Error al guardar PnL en Supabase:", updateError.message);
        } else {
            console.log(`✅ [SABUESO - ${userConfig.user_id.substring(0,6)}] ¡Operación terminada! Resultado: ${resultado} | PnL: $${pnlFinal.toFixed(2)}`);
            await ENVIAR_ALERTA(`🏁 *OPERACIÓN CERRADA*\n\n🪙 Par: ${userConfig.pair}\n📈 Resultado: *${resultado}*\n💰 PnL: *$${pnlFinal.toFixed(2)}*`, userConfig.telegram_chat_id);
        }

    } catch (error: any) {
        console.error(`❌ Error en el Sabueso [${userConfig.user_id.substring(0,6)}]:`, error.message);
    }
}