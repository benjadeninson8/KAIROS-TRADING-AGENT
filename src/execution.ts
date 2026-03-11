import ccxt from 'ccxt';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';
import { ENVIAR_ALERTA } from './notifier.ts';

dotenv.config();

export async function EJECUTAR_ORDEN(decision: any, precioActual: number) {
  // 1. Filtro básico
  if (decision.decision === "ESPERAR") {
      console.log("   💤 Juez: Mercado lateral o peligroso. Esperando.");
      return; 
  }

  console.log(`\n🔫 ANALIZANDO VIABILIDAD DE LA OPERACIÓN...`);

  // --- ADAPTADO A TU FORMATO EXACTO DEL .ENV ---
  const modoPrueba = process.env.KAIROS_MODE === 'TEST';
  
  console.log(`   🔌 DIAGNÓSTICO DE CONEXIÓN:`);
  console.log(`      Modo: ${modoPrueba ? 'TESTNET (Simulador)' : 'REAL'}`);
  // Aquí busca exactamente la variable que tú configuraste
  console.log(`      API Key detectada: ${process.env.EXCHANGE_API_KEY ? 'SÍ ✅' : 'NO ❌'}`);

  const exchange = new ccxt.binance({
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_SECRET,
    options: { defaultType: KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'future' : 'spot' }
  });

  // ¡EL INTERRUPTOR MÁGICO DE LA TESTNET!
  if (modoPrueba) {
      exchange.setSandboxMode(true);
      console.log("   🔌 [MODO TESTNET ACTIVADO] Operando con dinero de mentira.");
  }
  // -----------------------------

  // 2. Validación de Precios Dinámicos
  if (!decision.take_profit_price || !decision.stop_loss_price) {
      console.log("   ⚠️ ALERTA: La IA no definió precios de salida claros. Abortando.");
      return;
  }

  // 3. CÁLCULO DE RATIO RIESGO/BENEFICIO
  const distanciaTP = Math.abs(decision.take_profit_price - precioActual);
  const distanciaSL = Math.abs(precioActual - decision.stop_loss_price);
  
  if (distanciaSL === 0) { console.log("   ⚠️ Error: SL igual al precio de entrada."); return; }

  const ratio = distanciaTP / distanciaSL;
  
  console.log(`   📐 MATEMÁTICA DE LA OPERACIÓN:`);
  console.log(`      Riesgo (Distancia a SL): $${distanciaSL.toFixed(2)}`);
  console.log(`      Beneficio (Distancia a TP): $${distanciaTP.toFixed(2)}`);
  console.log(`      Ratio R/B: 1:${ratio.toFixed(2)}`);

  // FILTRO DE CALIDAD TEMPORAL: Rebajado a 0.1 para la prueba (Volver a 1.5 después)
  if (ratio < 0.1) { 
      console.log(`   ⛔ OPERACIÓN RECHAZADA: El riesgo es muy alto para la ganancia potencial.`);
      return;
  }

  try {
    // 4. Gestión de Capital
    await exchange.loadMarkets(); 
    const balance = await exchange.fetchBalance();
    const saldoUSDT = balance['USDT']?.free || 0;
    
    let montoInversion = 0;
    if (KAIROS_CONFIG.CAPITAL_MODE === 'FIXED') {
        montoInversion = KAIROS_CONFIG.CAPITAL_VALUE;
    } else {
        montoInversion = (saldoUSDT * KAIROS_CONFIG.CAPITAL_VALUE) / 100;
    }

    if (montoInversion > saldoUSDT) montoInversion = saldoUSDT * 0.95;

    const montoApalancado = KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' 
        ? montoInversion * KAIROS_CONFIG.LEVERAGE 
        : montoInversion;

    const cantidadTokensBruta = montoApalancado / precioActual;
    const cantidadTokens = exchange.amountToPrecision(KAIROS_CONFIG.PAIR, cantidadTokensBruta);

    console.log(`   💰 Capital Real: $${montoInversion.toFixed(2)} | Posición (x${KAIROS_CONFIG.LEVERAGE}): $${montoApalancado.toFixed(2)}`);
    console.log(`   📉 Cantidad Activo: ${cantidadTokens} ${KAIROS_CONFIG.PAIR}`);

    if (KAIROS_CONFIG.MARKET_TYPE === 'FUTURE') {
        try { 
            await exchange.setLeverage(KAIROS_CONFIG.LEVERAGE, KAIROS_CONFIG.PAIR); 
            console.log(`   ⚙️ Apalancamiento ajustado a ${KAIROS_CONFIG.LEVERAGE}x`);
        } catch (e) {
            console.log(`   ⚠️ Apalancamiento ya configurado o no soportado en este modo.`);
        }
    }

    // 5. ¡FUEGO!
    console.log(`   🚀 ENVIANDO ORDEN DE MERCADO...`);
    const side = decision.decision === "COMPRAR" ? 'buy' : 'sell';
    
    const order = await exchange.createMarketOrder(KAIROS_CONFIG.PAIR, side, parseFloat(cantidadTokens));
    
    console.log(`   ✅ ¡ORDEN EJECUTADA! ID: ${order.id}`);

    await ENVIAR_ALERTA(
        `🚨 *KAIROS EJECUTÓ UNA ORDEN (${modoPrueba ? 'TESTNET' : 'REAL'})*\n\n` +
        `🤖 Acción: *${decision.decision}*\n` +
        `🪙 Par: ${KAIROS_CONFIG.PAIR}\n` +
        `📦 Tamaño: ${cantidadTokens}\n` +
        `💵 Precio de Entrada: $${precioActual}\n` +
        `🎯 TP Sugerido: $${decision.take_profit_price}\n` +
        `🛡️ SL Sugerido: $${decision.stop_loss_price}`
    );

    console.log(`   🛡️ NOTA: Stop Loss y Take Profit deben colocarse (Fase 2 de ejecución).`);
    console.log(`      SL Sugerido: $${decision.stop_loss_price}`);
    console.log(`      TP Sugerido: $${decision.take_profit_price}`);

  } catch (error: any) {
    console.error("   ❌ ERROR CRÍTICO AL EJECUTAR:", error.message);
    await ENVIAR_ALERTA(`❌ *ERROR EJECUTANDO ORDEN KAIROS*\n${error.message}`);
  }
}