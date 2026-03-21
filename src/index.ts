import cron from 'node-cron';
import dotenv from 'dotenv';
import ccxt from 'ccxt';
import { createClient } from '@supabase/supabase-js';
import { KAIROS_SISTEMA_COMPLETO } from './main.ts';
import { RASTREAR_RESULTADOS } from './tracker.ts';
import { ENVIAR_ALERTA } from './notifier.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

console.log("==================================================");
console.log(`☁️  KAIROS CLOUD SAAS INICIADO (Modo Multi-Cliente)`);
console.log("==================================================\n");

// Función Nuclear Individual
async function CERRAR_TODO_CLIENTE(userConfig: any) {
    try {
        console.log(`💥 [${userConfig.user_id.substring(0,6)}] Ejecutando Market Close de Emergencia...`);
        
        const exchange = new ccxt.bybit({
            apiKey: userConfig.bybit_api_key,
            secret: userConfig.bybit_api_secret,
            enableRateLimit: true,
            options: { 'defaultType': userConfig.market_type === 'FUTURE' ? 'swap' : 'spot' }
        });

        const parFinal = userConfig.market_type === 'FUTURE' && !userConfig.pair.includes(':USDT') 
            ? `${userConfig.pair}:USDT` : userConfig.pair;
            
        const posiciones = await exchange.fetchPositions([parFinal]);
        const posicionActiva = posiciones.find(p => p.symbol === parFinal && Math.abs(Number(p.contracts || 0)) > 0);

        if (posicionActiva) {
            const side = Number(posicionActiva.contracts) > 0 ? 'sell' : 'buy';
            const amount = Math.abs(Number(posicionActiva.contracts));
            await exchange.createMarketOrder(parFinal, side, amount, undefined, { reduceOnly: true });
            console.log(`✅ [${userConfig.user_id.substring(0,6)}] ¡Posición CERRADA de emergencia!`);
        }
        await exchange.cancelAllOrders(parFinal);
        
        await ENVIAR_ALERTA(`☢️ *ALERTA NUCLEAR*\nTodas tus posiciones han sido cerradas a mercado.`, userConfig.telegram_chat_id);

    } catch (error: any) {
        console.error(`❌ [${userConfig.user_id.substring(0,6)}] Error Crítico cerrando posiciones:`, error.message);
    }
}

// Bucle Principal: Escanea a TODOS los clientes activos
async function EJECUTAR_CICLO_SAAS() {
    console.log(`\n==================================================`);
    console.log(`🏭 INICIANDO RONDA DE PRODUCCIÓN...`);
    
    // 1. Buscamos a TODOS los clientes en la base de datos
    const { data: clientes, error } = await supabase.from('bot_settings').select('*');
    
    if (error || !clientes || clientes.length === 0) {
        console.log("📭 No hay clientes registrados en la plataforma.");
        return;
    }

    console.log(`👥 Clientes totales en plataforma: ${clientes.length}`);

    // 2. Procesamos a cada cliente uno por uno
    for (const cliente of clientes) {
        console.log(`\n--------------------------------------------------`);
        console.log(`👤 Analizando Cliente: ${cliente.user_id}`);
        
        // 🚨 SI EL CLIENTE APRETÓ EL BOTÓN NUCLEAR
        if (cliente.panic_mode === true) {
            console.log(`🚨 [PÁNICO DETECTADO] Ejecutando protocolo para este cliente...`);
            await CERRAR_TODO_CLIENTE(cliente);
            await supabase.from('bot_settings').update({ panic_mode: false, is_active: false }).eq('id', cliente.id);
            console.log(`🛑 Cliente apagado por seguridad.`);
            continue; 
        }

        // 💤 SI EL CLIENTE TIENE EL BOT APAGADO
        if (!cliente.is_active) {
            console.log(`💤 Cliente pausado. Solo rastrearemos operaciones huérfanas.`);
            await RASTREAR_RESULTADOS(cliente);
            continue;
        }

        // 🔥 SI EL CLIENTE ESTÁ ACTIVO, ARRANCAMOS SU MOTOR
        try {
            await KAIROS_SISTEMA_COMPLETO(cliente);
            await sleep(2000); // Pausa para no saturar la API
            await RASTREAR_RESULTADOS(cliente); // El Sabueso olfatea sus operaciones
        } catch (e: any) {
             console.error(`❌ Error general con el cliente ${cliente.user_id.substring(0,6)}:`, e.message);
        }
    }
    console.log(`\n✅ RONDA TERMINADA. En espera de la próxima vela de 15m.`);
}

// Ejecución inicial de prueba al encender
(async () => {
    await EJECUTAR_CICLO_SAAS();
})();

// El Reloj Principal (Cada 15 minutos)
cron.schedule('*/15 * * * *', async () => {
    const hora = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${hora}] Reloj activado. Iniciando barrido global...`);
    await EJECUTAR_CICLO_SAAS();
});

// ==========================================
// 🚨 OÍDO SUPERSÓNICO (Canal de Pánico Global)
// ==========================================
supabase
    .channel('panic-listener')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bot_settings' }, async (payload) => {
        // Escuchamos si CUALQUIER fila de la tabla cambió su panic_mode a true
        if (payload.new.panic_mode === true) {
            console.log(`\n🚨 ALERTA NUCLEAR EN TIEMPO REAL (Cliente ID: ${payload.new.user_id})`);
            await CERRAR_TODO_CLIENTE(payload.new);
            await supabase.from('bot_settings').update({ panic_mode: false, is_active: false }).eq('id', payload.new.id);
        }
    })
    .subscribe();