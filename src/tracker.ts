import ccxt from 'ccxt';
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

const exchange = new ccxt.bybit({
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_SECRET,
    enableRateLimit: true,
});

if (process.env.KAIROS_MODE === 'TEST') exchange.setSandboxMode(true);

export async function RASTREAR_RESULTADOS() {
    console.log("🐕 [SABUESO] Rastreando resultados en Bybit...");

    try {
        // 1. Buscamos las órdenes cerradas recientemente (closed orders)
        // Usamos el par formateado para futuros
        const parFinal = KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? `${KAIROS_CONFIG.PAIR}:USDT` : KAIROS_CONFIG.PAIR;
        const closedOrders = await exchange.fetchClosedOrders(parFinal, undefined, 20);

        for (const order of closedOrders) {
            // Solo nos interesan las órdenes que fueron Take Profit o Stop Loss
            if (order.status === 'closed' && (order.type === 'limit' || order.type === 'market')) {
                
                const pnl = (order as any).info.closedPnl || 0; // PnL que devuelve Bybit
                if (pnl === 0) continue; // Si no hay PnL registrado en esa orden, saltamos

                const resultado = parseFloat(pnl) > 0 ? 'WIN' : 'LOSS';
                
                console.log(`🎯 Encontrada orden cerrada: ID ${order.id} | Resultado: ${resultado} | PnL: $${pnl}`);

                // 2. Intentamos actualizar el último log en Supabase que no tenga resultado
                const { data, error } = await supabase
                    .from('ai_logs')
                    .update({ 
                        pnl_result: resultado,
                        pnl_amount: parseFloat(pnl)
                    })
                    .eq('pair', KAIROS_CONFIG.PAIR)
                    .is('pnl_result', null) // Solo los que están "pendientes"
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error) console.error("❌ Error al actualizar Supabase:", error.message);
                else console.log(`✅ Supabase actualizado: Operación marcada como ${resultado}`);
            }
        }
    } catch (error: any) {
        console.error("❌ Error en el Sabueso:", error.message);
    }
}

