import cron from 'node-cron';
import { KAIROS_SISTEMA_COMPLETO } from './main.ts';
import { ENVIAR_ALERTA } from './notifier.ts';
import { KAIROS_CONFIG } from './config.ts';

console.log("==========================================");
console.log(`⏱️ KAIROS AUTO-PILOT INICIADO`);
console.log(`   Par: ${KAIROS_CONFIG.PAIR}`);
console.log(`   Estrategia: ${KAIROS_CONFIG.STRATEGY_NAME} (${KAIROS_CONFIG.TIMEFRAME})`);
console.log("==========================================\n");

ENVIAR_ALERTA(`🟢 *KAIROS PILOTO AUTOMÁTICO ACTIVO*\nEl bot evaluará el mercado cada 15 minutos.`);

// Ejecutarlo una vez inmediatamente al encender el script
console.log("🚀 Ejecutando primer escaneo de arranque...");
KAIROS_SISTEMA_COMPLETO();

// El Reloj: Ejecuta el sistema exactamente cada 15 minutos reales.
cron.schedule('*/15 * * * *', async () => {
    const hora = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${hora}] Reloj activado. Despertando a KAIROS...`);
    await KAIROS_SISTEMA_COMPLETO();
    console.log(`\n💤 KAIROS vuelve a dormir hasta el próximo ciclo...`);
});