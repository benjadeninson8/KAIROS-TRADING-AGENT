import ccxt from 'ccxt';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';

dotenv.config();

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: { defaultType: KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'future' : 'spot' }
});

export async function EJECUTAR_ORDEN(decision: any, precioActual: number) {
  // 1. Filtro básico
  if (decision.decision === "ESPERAR") {
      console.log("   💤 Juez: Mercado lateral o peligroso. Esperando.");
      return; 
  }

  console.log(`\n🔫 ANALIZANDO VIABILIDAD DE LA OPERACIÓN...`);

  // 2. Validación de Precios Dinámicos (Evitamos errores de la IA)
  if (!decision.take_profit_price || !decision.stop_loss_price) {
      console.log("   ⚠️ ALERTA: La IA no definió precios de salida claros. Abortando.");
      return;
  }

  // 3. CÁLCULO DE RATIO RIESGO/BENEFICIO (Matemática Pura)
  const distanciaTP = Math.abs(decision.take_profit_price - precioActual);
  const distanciaSL = Math.abs(precioActual - decision.stop_loss_price);
  
  // Evitar división por cero
  if (distanciaSL === 0) { console.log("   ⚠️ Error: SL igual al precio de entrada."); return; }

  const ratio = distanciaTP / distanciaSL;
  
  console.log(`   📐 MATEMÁTICA DE LA OPERACIÓN:`);
  console.log(`      Riesgo (Distancia a SL): $${distanciaSL.toFixed(2)}`);
  console.log(`      Beneficio (Distancia a TP): $${distanciaTP.toFixed(2)}`);
  console.log(`      Ratio R/B: 1:${ratio.toFixed(2)}`);

  // FILTRO DE CALIDAD: Solo tomamos trades donde ganemos al menos 1.5 veces lo que arriesgamos
  if (ratio < 1.5) {
      console.log(`   ⛔ OPERACIÓN RECHAZADA: El riesgo es muy alto para la ganancia potencial.`);
      return;
  }

  try {
    // 4. Gestión de Capital (Entrada)
    const balance = await exchange.fetchBalance();
    const saldoUSDT = balance['USDT']?.free || 0;
    
    let montoInversion = 0;
    if (KAIROS_CONFIG.CAPITAL_MODE === 'FIXED') {
        montoInversion = KAIROS_CONFIG.CAPITAL_VALUE;
    } else {
        montoInversion = (saldoUSDT * KAIROS_CONFIG.CAPITAL_VALUE) / 100;
    }

    // Validación de saldo
    if (montoInversion > saldoUSDT) montoInversion = saldoUSDT * 0.95;

    // Apalancamiento
    const montoApalancado = KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' 
        ? montoInversion * KAIROS_CONFIG.LEVERAGE 
        : montoInversion;

    const cantidadTokens = montoApalancado / precioActual;

    console.log(`   💰 Capital Real: $${montoInversion.toFixed(2)} | Posición (x${KAIROS_CONFIG.LEVERAGE}): $${montoApalancado.toFixed(2)}`);
    console.log(`   📉 Cantidad Activo: ${cantidadTokens.toFixed(4)} ${KAIROS_CONFIG.PAIR}`);

    // 5. Configurar Apalancamiento en Binance
    if (KAIROS_CONFIG.MARKET_TYPE === 'FUTURE') {
        try { await exchange.setLeverage(KAIROS_CONFIG.LEVERAGE, KAIROS_CONFIG.PAIR); } catch (e) {}
    }

    // 6. ¡FUEGO! (SIMULACIÓN)
    // Aquí es donde en el futuro descomentaremos exchange.createOrder
    console.log(`   🚀 [SIMULACIÓN] ENVIANDO ORDEN MARKET...`);
    console.log(`      LADO: ${decision.decision}`);
    console.log(`      CANTIDAD: ${cantidadTokens.toFixed(4)}`);
    
    // OJO: En la realidad, aquí enviaríamos una orden OCO (One Cancels the Other) o 3 órdenes:
    // 1. Market Buy
    // 2. Stop Loss (Trigger)
    // 3. Take Profit (Limit)
    console.log(`   🛡️ [SIMULACIÓN] STOP LOSS PROGRAMADO EN: $${decision.stop_loss_price}`);
    console.log(`   🤑 [SIMULACIÓN] TAKE PROFIT PROGRAMADO EN: $${decision.take_profit_price}`);

  } catch (error) {
    console.error("   ❌ ERROR CRÍTICO AL EJECUTAR:", error);
  }
}