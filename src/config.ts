export const KAIROS_CONFIG = {
  // 1. IDENTIDAD DEL ACTIVO
  PAIR: 'SOL/USDT',
  
  // 2. TIPO DE MERCADO ('SPOT' o 'FUTURE' - Ahora controlado por la WEB)
  MARKET_TYPE: 'FUTURE', 
  
  // 3. APALANCAMIENTO (Solo para FUTURE)
  LEVERAGE: 5, 
  
  // 4. GESTIÓN DE CAPITAL (Entrada)
  CAPITAL_MODE: 'PERCENTAGE', 
  CAPITAL_VALUE: 10,
  
  // 5. ESTRATEGIA
  STRATEGY_NAME: 'SCALPING_DINAMICO',
  TIMEFRAME: '15m', 
  
  // 6. SEGURIDAD
  MAX_STOP_LOSS_PERCENT: 5.0,
  
  // 7. SENTIMIENTO MÍNIMO
  MIN_CONFIDENCE: 80,

  // 8. LÍMITE DIARIO
  MAX_TRADES_PER_DAY: 10,

  // 9. MODO COPILOTO (NUEVO)
  COPILOT_MODE: false,


  // 10. PROTECCIÓN ACTIVA (BREAKEVEN) <-- ¡NUEVO!
  USE_BREAKEVEN: true,          // Encender o apagar el escudo
  BREAKEVEN_TRIGGER_PERCENT: 2.0 // Cuando la ganancia llegue al +2%, subimos el escudo

};