import cron from 'node-cron';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { KAIROS_SISTEMA_COMPLETO } from './main.ts';
import { RASTREAR_RESULTADOS } from './tracker.ts';
import { ENVIAR_ALERTA } from './notifier.ts';
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

let estadoAnterior = false; // Memoria para saber si estaba apagado o prendido

console.log("==========================================");
console.log(`⏱️ KAIROS AUTO-PILOT INICIADO`);
console.log(`   Par Base: ${KAIROS_CONFIG.PAIR}`);
console.log("==========================================\n");

ENVIAR_ALERTA(`🟢 *KAIROS MOTOR ENCENDIDO*\nConectado al Command Center. Esperando el próximo ciclo de 15m.`);

// Función para revisar los botones de la web
async function LEER_CONTROLES() {
    try {
        const { data, error } = await supabase.from('bot_settings').select('*').eq('id', 1).single();
        if (data) {
            KAIROS_CONFIG.MARKET_TYPE = data.market_type; 
            return data.is_active; 
        }
    } catch (e) {
        console.error("❌ Error leyendo controles:", e);
    }
    return false;
}

// Ejecución inicial
(async () => {
    console.log("🚀 Sincronizando con Dashboard por primera vez...");
    const isOn = await LEER_CONTROLES();
    estadoAnterior = isOn;
    
    if (isOn) {
        console.log(`[SYS ON] Operando en mercado: ${KAIROS_CONFIG.MARKET_TYPE}`);
        await KAIROS_SISTEMA_COMPLETO();
    } else {
        console.log(`[SYS OFF] Bot pausado desde el Command Center. No se abrirán operaciones.`);
    }
    
    await RASTREAR_RESULTADOS(); 
    console.log(`\n⏳ KAIROS en espera. El próximo escaneo será en el minuto :00, :15, :30 o :45...`);
})();

// El Reloj Principal
cron.schedule('*/15 * * * *', async () => {
    const hora = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${hora}] Reloj activado. Revisando controles...`);
    
    const isOn = await LEER_CONTROLES();
    
    // Si hubo un cambio de estado desde la web, avisamos por Telegram
    if (isOn !== estadoAnterior) {
        if (isOn) {
            await ENVIAR_ALERTA(`✅ *SISTEMA ACTIVADO DESDE LA WEB*\nKAIROS reanuda operaciones en ${KAIROS_CONFIG.MARKET_TYPE}.`);
        } else {
            await ENVIAR_ALERTA(`⏸️ *SISTEMA PAUSADO DESDE LA WEB*\nKAIROS ha sido detenido. No se abrirán nuevas operaciones.`);
        }
        estadoAnterior = isOn; // Actualizamos la memoria
    }
    
    if (isOn) {
        console.log(`🔥 [KAIROS ACTIVO] Mercado: ${KAIROS_CONFIG.MARKET_TYPE}. Iniciando escaneo...`);
        await KAIROS_SISTEMA_COMPLETO();
    } else {
        console.log(`💤 [KAIROS PAUSADO] Órdenes del jefe: No operar.`);
    }
    
    await RASTREAR_RESULTADOS(); 
    console.log(`\n⏳ Análisis terminado. Durmiendo hasta el próximo cuarto de hora...`);
});