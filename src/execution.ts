import ccxt from 'ccxt';
import dotenv from "dotenv";
import { ENVIAR_ALERTA } from './notifier.ts';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

// Fíjate que ahora recibe "userConfig" (los datos del cliente actual)
export async function EJECUTAR_ORDEN(
    decision: any, 
    precioActual: number, 
    rsiActual: number = 0,
    userConfig: any // <-- ESTO ES NUEVO
) {
  if (decision.decision === "ESPERAR") {
      console.log(`  💤 [${userConfig.user_id.substring(0,6)}] Juez: Mercado lateral. Esperando.`);
      return; 
  }

  console.log(`\n🔫 [${userConfig.user_id.substring(0,6)}] ANALIZANDO VIABILIDAD DE LA OPERACIÓN...`);

  const modoPrueba = process.env.KAIROS_MODE === 'TEST';
  
  // Verificamos si EL CLIENTE puso sus llaves
  if (!userConfig.bybit_api_key || !userConfig.bybit_api_secret) {
      console.log(`  ❌ [${userConfig.user_id.substring(0,6)}] El cliente no tiene configuradas sus API Keys de Bybit. Abortando.`);
      return;
  }

  console.log(`  🔌 DIAGNÓSTICO DE CONEXIÓN (BYBIT):`);
  console.log(`      Modo: ${modoPrueba ? 'TESTNET (Simulador)' : 'REAL'}`);
  console.log(`      API Key Cliente: SÍ ✅`);
  console.log(`🔍 DEBUG: El mercado configurado por el cliente es: '${userConfig.market_type}'`);

  // Conectamos a Bybit usando LAS LLAVES DEL CLIENTE
  const exchange = new ccxt.bybit({
    apiKey: userConfig.bybit_api_key,
    secret: userConfig.bybit_api_secret,
    enableRateLimit: true,
    options: { 
        defaultType: userConfig.market_type === 'FUTURE' ? 'swap' : 'spot',
        adjustForTimeDifference: true,
        recvWindow: 10000
    }
  });

  if (modoPrueba) {
      exchange.setSandboxMode(true);
      console.log("  🔌 [MODO TESTNET ACTIVADO] Conectado a Bybit Testnet.");
  }

  if (!decision.take_profit_price || !decision.stop_loss_price) {
      console.log("  ⚠️ ALERTA: La IA no definió precios de salida claros. Abortando.");
      return;
  }

  const distanciaTP = Math.abs(decision.take_profit_price - precioActual);
  const distanciaSL = Math.abs(precioActual - decision.stop_loss_price);
  
  if (distanciaSL === 0) { console.log("  ⚠️ Error: SL igual al precio de entrada."); return; }

  const ratio = distanciaTP / distanciaSL;
  
  if (ratio < 0.1) { 
      console.log(`  ⛔ OPERACIÓN RECHAZADA: El riesgo es muy alto para la ganancia potencial.`);
      return;
  }

  try {
    await exchange.loadMarkets(); 
    const balance = await exchange.fetchBalance();
    const saldoUSDT = balance['USDT']?.free || 0;
    
    // Usamos el capital configurado POR EL CLIENTE en su Dashboard
    let montoInversion = userConfig.capital_value;

    if (montoInversion > saldoUSDT) montoInversion = saldoUSDT * 0.95;

    if (montoInversion <= 0) {
        throw new Error(`El cliente no tiene fondos suficientes en USDT.`);
    }

    // Para el SaaS vamos a fijar el apalancamiento en 10x por ahora, luego lo puedes poner en el Dashboard
    const leverageSaaS = 10; 
    const montoApalancado = userConfig.market_type === 'FUTURE' 
        ? montoInversion * leverageSaaS 
        : montoInversion;

    // 🔥 FORMATEADOR DE PARES INTELIGENTE 🔥
    let parFinal = userConfig.pair;
    if (userConfig.market_type === 'FUTURE' && !parFinal.includes(':USDT')) {
        parFinal = `${userConfig.pair}:USDT`;
        console.log(`  🔧 Par adaptado para Bybit Futuros: ${parFinal}`);
    }

    const cantidadTokensBruta = montoApalancado / precioActual;
    const cantidadTokens = exchange.amountToPrecision(parFinal, cantidadTokensBruta);

    console.log(`  💰 Capital Real: $${montoInversion.toFixed(2)} | Posición (x${leverageSaaS}): $${montoApalancado.toFixed(2)}`);
    console.log(`  📉 Cantidad Activo: ${cantidadTokens} ${parFinal}`);

    if (userConfig.market_type === 'FUTURE') {
        try { 
            await exchange.setLeverage(leverageSaaS, parFinal); 
            console.log(`  ⚙️ Apalancamiento ajustado a ${leverageSaaS}x`);
        } catch (e) {
            console.log(`  ⚠️ Apalancamiento ya configurado o ignorado por el exchange.`);
        }
    }

    console.log(`  🚀 ENVIANDO ORDEN DE MERCADO Y ESCUDOS A BYBIT...`);
    const side = decision.decision === "COMPRAR" ? 'buy' : 'sell';
    
    const parametrosExtra = {
        stopLoss: parseFloat(decision.stop_loss_price).toString(),
        takeProfit: parseFloat(decision.take_profit_price).toString()
    };
    
    const order = await exchange.createMarketOrder(parFinal, side, parseFloat(cantidadTokens), undefined, parametrosExtra);
    
    console.log(`  ✅ ¡ORDEN EJECUTADA! ID: ${order.id}`);

    // 🔥 GUARDAMOS EL LOG EN LA FILA DEL CLIENTE ESPECÍFICO 🔥
    console.log(`  💾 Guardando operación en el historial del cliente...`);
    const { error: supabaseError } = await supabase.from('ai_logs').insert([{
        user_id: userConfig.user_id, // <-- EL ID DEL DUEÑO DE LA CUENTA
        pair: userConfig.pair,
        price_at_time: precioActual,
        rsi: rsiActual, 
        judge_verdict: decision.decision,
        confidence_score: decision.confianza || 0,
        reasoning: `[ORDEN PROTEGIDA] Ratio: 1:${ratio.toFixed(2)} | SL: ${decision.stop_loss_price} | TP: ${decision.take_profit_price} | Razón IA: ${decision.razonamiento}`
    }]);

    if (supabaseError) {
        console.error("  ⚠️ Falló al guardar en Supabase:", supabaseError);
    }

    // Le pasamos el telegram_chat_id del cliente al Notificador
    await ENVIAR_ALERTA(
        `🚨 *KAIROS CLOUD EJECUTÓ UNA ORDEN (${modoPrueba ? 'TESTNET' : 'REAL'})*\n\n` +
        `🤖 Acción: *${decision.decision}*\n` +
        `🪙 Par: ${parFinal}\n` +
        `💵 Entrada: $${precioActual}\n` +
        `🎯 TP: $${decision.take_profit_price}\n` +
        `🛡️ SL: $${decision.stop_loss_price}`,
        userConfig.telegram_chat_id // <-- EL TELEGRAM DEL CLIENTE
    );

  } catch (error: any) {
    console.error(`  ❌ [${userConfig.user_id.substring(0,6)}] ERROR CRÍTICO AL EJECUTAR:`, error.message);
    await ENVIAR_ALERTA(`❌ *ERROR EJECUTANDO ORDEN*\n${error.message}`, userConfig.telegram_chat_id);
  }
}