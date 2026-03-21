import { fileURLToPath } from 'url';
import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";
import { OBTENER_JUICIO_FINAL } from './brain.ts';
import { EJECUTAR_ORDEN } from './execution.ts';
import { ENVIAR_ALERTA, botTelegram } from './notifier.ts'; 

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

// Este diccionario guardará las operaciones "pendientes de confirmación" separadas por Cliente
const operacionesPendientes = new Map<string, any>(); 

export async function KAIROS_SISTEMA_COMPLETO(userConfig: any) {
    console.log(`\n⚙️ INICIANDO ANÁLISIS PARA CLIENTE: ${userConfig.user_id.substring(0,6)}`);
    console.log(`   🪙 Par: ${userConfig.pair} | 💸 Capital: $${userConfig.capital_value} | 📊 Mercado: ${userConfig.market_type}`);

    // Si el cliente NO configuró sus llaves, lo saltamos y le avisamos por consola
    if (!userConfig.bybit_api_key || !userConfig.bybit_api_secret) {
        console.log(`   ❌ [${userConfig.user_id.substring(0,6)}] Sin llaves de Bybit. Análisis abortado.`);
        return;
    }

    try {
        const exchange = new ccxt.bybit({
            apiKey: userConfig.bybit_api_key,
            secret: userConfig.bybit_api_secret,
            enableRateLimit: true,
            timeout: 30000,
            options: { 'defaultType': userConfig.market_type === 'FUTURE' ? 'swap' : 'spot' }
        });

        if (process.env.KAIROS_MODE === 'TEST') exchange.setSandboxMode(true);

        // --- LÍMITE DE TRADES DIARIOS POR CLIENTE ---
        const hoy = new Date().toISOString().split('T')[0];
        const { count, error: countError } = await supabase
            .from('ai_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userConfig.user_id)
            .gte('created_at', hoy)
            .in('judge_verdict', ['COMPRAR', 'VENDER']);

        if (countError) throw countError;
        const maxTrades = 10; // Fijo para todos los clientes SaaS por ahora
        if ((count || 0) >= maxTrades) {
            console.log(`   ⛔ [${userConfig.user_id.substring(0,6)}] Límite diario alcanzado (${maxTrades}). Saltando.`);
            return; 
        }

        // --- SISTEMA DE AMNESIA (Evitar sobre-apalancamiento) ---
        console.log(`   🔍 Verificando posiciones activas en Bybit...`);
        let tienePosicionAbierta = false;

        if (userConfig.market_type === 'FUTURE') {
            const parFinal = userConfig.pair.includes(':USDT') ? userConfig.pair : `${userConfig.pair}:USDT`; 
            const posiciones = await exchange.fetchPositions([parFinal]);
            const posicionActiva = posiciones.find(p => p.symbol === parFinal && Math.abs(Number(p.contracts || 0)) > 0);
            
            if (posicionActiva) {
                tienePosicionAbierta = true;
                console.log(`   ⛔ AMNESIA: El cliente ya tiene ${posicionActiva.contracts} contratos abiertos en ${parFinal}.`);
            }
        } else {
            const balance = await exchange.fetchBalance();
            const monedaBase = userConfig.pair.split('/')[0];
            const cantidadMoneda = balance[monedaBase]?.free || 0;
            if (cantidadMoneda > 0.05) { 
                tienePosicionAbierta = true;
                console.log(`   ⛔ AMNESIA: El cliente ya tiene ${cantidadMoneda.toFixed(4)} ${monedaBase} en Spot.`);
            }
        }

        if (tienePosicionAbierta) {
            console.log(`   💤 Análisis abortado para no duplicar posiciones del cliente.`);
            return; 
        }

        // --- LECTURA PROFUNDA DEL MERCADO ---
        // Por defecto usamos velas de 15m para todos los clientes en SaaS, se puede hacer dinámico luego
        const velas = await exchange.fetchOHLCV(userConfig.pair, '15m', undefined, 100);
        const preciosCierre = velas.map(v => v[4] as number);
        const volumenes = velas.map(v => v[5] as number);
        
        const rsiRaw = RSI.calculate({ values: preciosCierre, period: 14 });
        const bbRaw = BollingerBands.calculate({ values: preciosCierre, period: 20, stdDev: 2 });
        
        const precioActual = preciosCierre[preciosCierre.length - 1];
        const volumenActual = volumenes[volumenes.length - 1];
        const volumenPromedio = volumenes.reduce((a, b) => a + b, 0) / volumenes.length;
        
        const rsiActual = rsiRaw[rsiRaw.length - 1];
        const bbActual = bbRaw[bbRaw.length - 1];

        const datosMercado = {
            precio: precioActual,
            rsi: rsiActual.toFixed(2),
            volumen: { actual: volumenActual, promedio: volumenPromedio, esAlto: volumenActual > (volumenPromedio * 1.5) },
            bandas: { upper: bbActual.upper.toFixed(2), lower: bbActual.lower.toFixed(2), width: (bbActual.upper - bbActual.lower).toFixed(2) }
        };

        console.log(`   🧠 Analizando Sentimiento y Estructura...`);
        const decision = await OBTENER_JUICIO_FINAL(datosMercado);

        console.log(`\n💾 [${userConfig.user_id.substring(0,6)}] Veredicto: ${decision.decision} | Confianza: ${decision.confianza}%`);

        if (decision.decision !== "ESPERAR") {
            const mensaje = `🚨 *SEÑAL DETECTADA: ${userConfig.pair}*\n\n` +
                            `🤖 *ACCIÓN:* ${decision.decision}\n` +
                            `📉 *PRECIO:* $${precioActual}\n` +
                            `🎯 *TP:* $${decision.take_profit_price} | 🛡️ *SL:* $${decision.stop_loss_price}\n` +
                            `⚖️ *CONFIANZA:* ${decision.confianza}%\n\n` +
                            `🧠 *VEREDICTO DE LA IA:*\n_${decision.razonamiento}_`;
            
            if (userConfig.copilot_mode) {
                console.log(`   ✋ COPILOTO ACTIVO: Solicitando permiso al cliente por Telegram...`);
                // Memorizamos la orden PERO separada por ID de cliente, para que un cliente no apruebe la orden de otro
                operacionesPendientes.set(userConfig.telegram_chat_id, {
                    config: userConfig,
                    decision,
                    precioActual,
                    rsi: parseFloat(datosMercado.rsi)
                });
                await ENVIAR_ALERTA(`✋ *PERMISO REQUERIDO (${userConfig.pair})*\n\n` + mensaje, userConfig.telegram_chat_id, true);
            } else {
                await ENVIAR_ALERTA(mensaje, userConfig.telegram_chat_id);
                // PASAMOS EL 4to ARGUMENTO (userConfig)
                await EJECUTAR_ORDEN(decision, precioActual, parseFloat(datosMercado.rsi), userConfig);
            }
        } else {
            console.log(`   💤 IA decidió esperar.`);
            // PASAMOS EL 4to ARGUMENTO (userConfig)
            await EJECUTAR_ORDEN(decision, precioActual, parseFloat(datosMercado.rsi), userConfig);
        }

    } catch (error) {
        console.error(`❌ [${userConfig.user_id.substring(0,6)}] Error en el análisis:`, error);
    }
}

// --- ESCUCHA DE BOTONES DE TELEGRAM (MULTI-CLIENTE) ---
if (botTelegram) {
    botTelegram.on('callback_query', async (query) => {
        const action = query.data;
        const msgId = query.message?.message_id;
        const telegramId = query.message?.chat.id.toString(); // Vemos QUIÉN apretó el botón

        if (!telegramId) return;

        // Buscamos si ESE cliente específico tenía una orden pendiente
        const operacionPendiente = operacionesPendientes.get(telegramId);

        if (action === 'COPILOT_APPROVE') {
            console.log("\n==========================================");
            if (operacionPendiente) {
                console.log(`🟢 [COPILOTO] Cliente ${telegramId} aprobó. Disparando...`);
                await EJECUTAR_ORDEN(
                    operacionPendiente.decision, 
                    operacionPendiente.precioActual, 
                    operacionPendiente.rsi, 
                    operacionPendiente.config // Pasamos los datos del dueño
                );
                await botTelegram!.sendMessage(telegramId, `✅ *ORDEN AUTORIZADA*\nOperación ejecutada en tu cuenta de Bybit.`, { parse_mode: 'Markdown' });
                operacionesPendientes.delete(telegramId); // Limpiamos la memoria
            } else {
                await botTelegram!.sendMessage(telegramId, `⚠️ *ERROR*\nNo tienes operaciones pendientes o expiraron.`, { parse_mode: 'Markdown' });
            }
            console.log("==========================================");
        }

        if (action === 'COPILOT_ABORT') {
            console.log("\n==========================================");
            console.log(`🔴 [COPILOTO] Cliente ${telegramId} abortó la operación.`);
            operacionesPendientes.delete(telegramId);
            await botTelegram!.sendMessage(telegramId, `🛑 *ORDEN ABORTADA*\nMisión cancelada en tu cuenta.`, { parse_mode: 'Markdown' });
            console.log("==========================================");
        }

        if (msgId) {
            // Borramos los botones después de que el cliente toca uno
            botTelegram!.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: telegramId, message_id: msgId }).catch(e => console.error("Error borrando botones:", e));
        }
    });
}