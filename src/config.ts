export const KAIROS_CONFIG = {
  // 1. IDENTIDAD DEL ACTIVO
  PAIR: 'SOL/USDT',
  
  // 2. TIPO DE MERCADO
  // 'SPOT': Compras reales (Menor riesgo, sin apalancamiento)
  // 'FUTURE': Contratos perpetuos (Mayor riesgo, permite apalancamiento)
  MARKET_TYPE: 'FUTURE', 
  
  // 3. APALANCAMIENTO (Solo para FUTURE)
  // 1 = Normal, 10 = x10 (Multiplica ganancias y pérdidas)
  LEVERAGE: 5, 
  
  // 4. GESTIÓN DE CAPITAL (Money Management)
  // 'PERCENTAGE': Usa un % de tu billetera (Recomendado para interés compuesto)
  // 'FIXED': Usa una cantidad fija de USDT (Ej: $20 siempre)
  CAPITAL_MODE: 'PERCENTAGE', 
  CAPITAL_VALUE: 10, // Si es %, usa el 10% del saldo. Si es Fixed, usa $10.
  
  // 5. ESTRATEGIA Y TIEMPO
  // 'SCALPING': Operaciones rápidas (Timeframe 5m/15m)
  // 'SWING': Operaciones de días (Timeframe 1h/4h)
  STRATEGY_NAME: 'SCALPING_AGRESIVO',
  TIMEFRAME: '15m', 
  
  // 6. GESTIÓN DE RIESGO (Vital para no quemar la cuenta)
  // Porcentaje de movimiento del precio para salir
  STOP_LOSS_PERCENT: 2.0, // Si baja 2%, cortamos pérdidas
  TAKE_PROFIT_PERCENT: 4.0, // Si sube 4%, tomamos ganancias (Ratio 1:2)
  
  // 7. SENTIMIENTO MÍNIMO
  // Qué tan seguro debe estar el Juez (Llama 3) para disparar (0 a 100)
  MIN_CONFIDENCE: 75
};