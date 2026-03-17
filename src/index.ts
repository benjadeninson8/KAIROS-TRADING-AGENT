import cron from 'node-cron';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { KAIROS_SISTEMA_COMPLETO } from './main.ts';
import { RASTREAR_RESULTADOS } from './tracker.ts';
import { ENVIAR_ALERTA } from './notifier.ts';
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

console.log("==========================================");
console.log(`⏱️ KAIROS AUTO-PILOT INICIADO`);
console.log(`   Par Base: ${KAIROS_CONFIG.PAIR}`);
console.log("==========================================\n");

ENVIAR_ALERTA(`🟢 *KAIROS CONECTADO AL COMMAND CENTER*\nEsperando órdenes maestras.`);

// Función para revisar los botones de la web
async function LEER_CONTROLES() {
    try {
        const { data, error } = await supabase.from('bot_settings').select('*').eq('id', 1).single();
        if (data) {
            KAIROS_CONFIG.MARKET_TYPE = data.market_type; // Actualizamos el mercado al vuelo
            return data.is_active; // Retornamos true (ON) o false (OFF)
        }
    } catch (e) {
        console.error("❌ Error leyendo controles:", e);
    }
    return false; // Por seguridad, si falla la lectura, se queda apagado.
}

// Ejecución inicial
(async () => {
    console.log("🚀 Sincronizando con Dashboard...");
    const isOn = await LEER_CONTROLES();
    
    if (isOn) {
        console.log(`[SYS ON] Operando en mercado: ${KAIROS_CONFIG.MARKET_TYPE}`);
        await KAIROS_SISTEMA_COMPLETO();
    } else {
        console.log(`[SYS OFF] Bot pausado desde el Command Center. No se abrirán operaciones.`);
    }
    
    await RASTREAR_RESULTADOS(); // El Sabueso trabaja incluso con el bot apagado
})();

// El Reloj Principal
cron.schedule('*/15 * * * *', async () => {
    const hora = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${hora}] Reloj activado. Revisando controles...`);
    
    const isOn = await LEER_CONTROLES();
    
    if (isOn) {
        console.log(`🔥 [KAIROS ACTIVO] Mercado: ${KAIROS_CONFIG.MARKET_TYPE}. Iniciando escaneo...`);
        await KAIROS_SISTEMA_COMPLETO();
    } else {
        console.log(`💤 [KAIROS PAUSADO] Órdenes del jefe: No operar.`);
    }
    
    await RASTREAR_RESULTADOS(); // Siempre rastrea los cierres
    console.log(`\nEsperando el próximo ciclo...`);
});