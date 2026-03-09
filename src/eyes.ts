import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';

// Configuración inicial
const symbol = 'SOL/USDT';
const timeframe = '1h';

async function verElMercado() {
  console.log(`👀 KAIROS está observando el mercado real (${symbol})...`);

  // 1. Instanciamos Binance
  const exchange = new ccxt.binance();

  try {
    // 2. Descargar velas
    const velas = await exchange.fetchOHLCV(symbol, timeframe, undefined, 100);

    if (!velas || velas.length === 0) {
      throw new Error("No se pudieron descargar datos del Exchange.");
    }

    // --- CORRECCIÓN AQUÍ ---
    // TypeScript se quejaba porque vela[4] podía ser undefined.
    // Hacemos 2 cosas:
    // 1. "as number": Le juramos a TS que es un número.
    // 2. .filter(...): Eliminamos cualquier valor que no sea un número real.
    const preciosCierre: number[] = velas
      .map(vela => vela[4] as number)
      .filter((precio): precio is number => typeof precio === 'number');

    // Validamos que tengamos suficientes datos para calcular (min 20 para Bollinger)
    if (preciosCierre.length < 20) {
      throw new Error("Datos insuficientes para calcular indicadores.");
    }

    // 3. Calcular RSI (14 periodos)
    const inputRSI = {
      values: preciosCierre,
      period: 14
    };
    const rsiResultados = RSI.calculate(inputRSI);
    const rsiActual = rsiResultados[rsiResultados.length - 1];

    // 4. Calcular Bandas de Bollinger (20 periodos, desv 2)
    const inputBB = {
      period: 20,
      values: preciosCierre,
      stdDev: 2
    };
    const bbResultados = BollingerBands.calculate(inputBB);
    const bbActual = bbResultados[bbResultados.length - 1];

    // 5. Analizar dónde está el precio
    // --- CORRECCIÓN AQUÍ ---
    // Usamos el operador "!" (Non-null assertion) porque ya validamos arriba que el array no está vacío
    const precioActual = preciosCierre[preciosCierre.length - 1]!;
    
    let estadoBandas = "DENTRO_DEL_CANAL";
    
    // Validamos que bbActual exista antes de comparar
    if (bbActual) {
        if (precioActual > bbActual.upper) estadoBandas = "ROMPIENDO_ARRIBA (Sobrecompra extrema)";
        if (precioActual < bbActual.lower) estadoBandas = "ROMPIENDO_ABAJO (Sobreventa extrema)";
    }

    // 6. Reporte Visual
    console.log("\n📊 REPORTE DE OJOS (Datos Reales):");
    console.log("--------------------------------------");
    console.log(`💰 Precio Actual: $${precioActual}`);
    // Usamos ?. por seguridad si el cálculo falló
    console.log(`📉 RSI (14):      ${rsiActual?.toFixed(2) || 'N/A'}`);
    console.log(`🌊 Bandas:        ${estadoBandas}`);
    if (bbActual) {
        console.log(`   ⬆️ Upper:      $${bbActual.upper.toFixed(2)}`);
        console.log(`   ⬇️ Lower:      $${bbActual.lower.toFixed(2)}`);
    }
    console.log("--------------------------------------");

    return {
      precio: precioActual,
      rsi: rsiActual,
      bandas: estadoBandas,
      bb_upper: bbActual?.upper || 0,
      bb_lower: bbActual?.lower || 0
    };

  } catch (error) {
    console.error("❌ Error en los ojos:", error);
    return null; // Retornamos null si falló para que el cerebro sepa
  }
}

// Ejecutar
verElMercado();