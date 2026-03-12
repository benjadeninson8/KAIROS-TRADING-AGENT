import ccxt from 'ccxt';
import dotenv from "dotenv";
import { KAIROS_CONFIG } from './config.ts';
import { ENVIAR_ALERTA } from './notifier.ts';
import { createClient } from '@supabase/supabase-js'; // <-- NUEVO IMPORT

dotenv.config();

// <-- INICIAMOS SUPABASE AQUÍ TAMBIÉN -->
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

// Fíjate que añadimos rsiActual como parámetro
export async function EJECUTAR_ORDEN(decision: any, precioActual: number, rsiActual: number = 0) {
  if (decision.decision === "ESPERAR") {
      console.log("   💤 Juez: Mercado lateral o peligroso. Esperando.");
      return; 
  }

  console.log(`\n🔫 ANALIZANDO VIABILIDAD DE LA OPERACIÓN...`);

  const modoPrueba = process.env.KAIROS_MODE === 'TEST';
  
  console.log(`   🔌 DIAGNÓSTICO DE CONEXIÓN (BYBIT):`);
  console.log(`      Modo: ${modoPrueba ? 'TESTNET (Simulador)' : 'REAL'}`);
  console.log(`      API Key detectada: ${process.env.EXCHANGE_API_KEY ? 'SÍ ✅' : 'NO ❌'}`);

  const exchange = new ccxt.bybit({
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_SECRET,
    enableRateLimit: true,
    options: { 
        defaultType: KAIROS_CONFIG.MARKET_TYPE === 'FUTURE' ? 'swap' : 'spot',
        adjustForTimeDifference: true,
        recvWindow: 10000
    }
  });

  if (modoPrueba) {
      exchange.setSandboxMode(true);
      console.log("   🔌 [MODO TESTNET ACTIVADO] Conectado a Bybit Testnet.");
  }

  if (!decision.take_profit_price || !decision.stop_loss_price) {
      console.log("   ⚠️ ALERTA: La IA no definió precios de salida claros. Abortando.");
      return;
  }

  const distanciaTP = Math.abs(decision.take_profit_price - precioActual);
  const distanciaSL = Math.abs(precioActual - decision.stop_loss_price);
  
  if (distanciaSL === 0) { console.log("   ⚠️ Error: SL igual al precio de entrada."); return; }

  const ratio = distanciaTP / distanciaSL;
  
  console.log(`   📐 MATEMÁTICA DE LA OPERACIÓN:`);
  console.log(`      Riesgo (Distancia a SL): $${distanciaSL.toFixed(2)}`);
  console.log(`      Beneficio (Distancia a TP): $${distanciaTP.toFixed(2)}`);
  console.log(`      Ratio R/B: 1:${ratio.toFixed(2)}`);

  // FILTRO TEMPORAL A 0.1 PARA PROBAR EL DISPARO
  if (ratio < 0.1) { 
      console.log(`   ⛔ OPERACIÓN RECHAZADA: El riesgo es muy alto para la ganancia potencial.`);
      return;
  }

  try {
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

    if (montoInversion <= 0) {
        throw new Error(`No tienes fondos en USDT en la Testnet. Ve a la web de Bybit Testnet y pide monedas falsas.`);
    }

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
            console.log(`   ⚠️ Apalancamiento ya configurado o no soportado/necesario.`);
        }
    }

    console.log(`   🚀 ENVIANDO ORDEN DE MERCADO A BYBIT...`);
    const side = decision.decision === "COMPRAR" ? 'buy' : 'sell';
    
    // 🔥 EL DISPARO A BYBIT 🔥
    const order = await exchange.createMarketOrder(KAIROS_CONFIG.PAIR, side, parseFloat(cantidadTokens));
    
    console.log(`   ✅ ¡ORDEN EJECUTADA EN BYBIT! ID: ${order.id}`);

    // --- NUEVO: GUARDAR EN SUPABASE SOLO SI LA ORDEN FUE EXITOSA ---
    console.log(`   💾 Guardando operación real en Supabase...`);
    const { error: supabaseError } = await supabase.from('ai_logs').insert([{
        pair: KAIROS_CONFIG.PAIR,
        price_at_time: precioActual,
        rsi: rsiActual, // Lo recibimos desde el cerebro
        judge_verdict: decision.decision,
        confidence_score: decision.confianza || 0,
        reasoning: `[ORDEN EJECUTADA] Ratio: 1:${ratio.toFixed(2)} | SL: ${decision.stop_loss_price} | TP: ${decision.take_profit_price} | Razón IA: ${decision.razonamiento}`
    }]);

    if (supabaseError) {
        console.error("   ⚠️ Alerta: La orden se ejecutó en Bybit, pero falló al guardar en Supabase:", supabaseError);
    } else {
        console.log(`   ✅ Operación registrada en base de datos correctamente.`);
    }
    // -----------------------------------------------------------------

    await ENVIAR_ALERTA(
        `🚨 *KAIROS EJECUTÓ UNA ORDEN (BYBIT ${modoPrueba ? 'TESTNET' : 'REAL'})*\n\n` +
        `🤖 Acción: *${decision.decision}*\n` +
        `🪙 Par: ${KAIROS_CONFIG.PAIR}\n` +
        `📦 Tamaño: ${cantidadTokens}\n` +
        `💵 Precio de Entrada: $${precioActual}\n` +
        `🎯 TP Sugerido: $${decision.take_profit_price}\n` +
        `🛡️ SL Sugerido: $${decision.stop_loss_price}`
    );

  } catch (error: any) {
    console.error("   ❌ ERROR CRÍTICO AL EJECUTAR:", error.message);
    await ENVIAR_ALERTA(`❌ *ERROR EJECUTANDO ORDEN KAIROS*\n${error.message}`);
  }
}