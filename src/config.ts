export const KAIROS_CONFIG = {
  // 1. IDENTIDAD DEL ACTIVO
  PAIR: 'SOL/USDT',
  
  // 2. TIPO DE MERCADO
  // 'SPOT' o 'FUTURE'
  MARKET_TYPE: 'FUTURE', 
  
  // 3. APALANCAMIENTO (Solo para FUTURE)
  LEVERAGE: 5, 
  
  // 4. GESTIÓN DE CAPITAL (Entrada)
  // 'PERCENTAGE' o 'FIXED'
  CAPITAL_MODE: 'PERCENTAGE', 
  CAPITAL_VALUE: 10, // 10% del saldo o $10 fijos
  
  // 5. ESTRATEGIA
  STRATEGY_NAME: 'SCALPING_DINAMICO',
  TIMEFRAME: '15m', 
  
  // 6. SEGURIDAD (Cinturón de seguridad)
  // YA NO usamos TP/SL fijos. La IA decide según las Bandas.
  // Pero, por seguridad, nunca permitas una pérdida mayor a esta:
  MAX_STOP_LOSS_PERCENT: 5.0, // Hard Stop de emergencia
  
  // 7. SENTIMIENTO MÍNIMO
  MIN_CONFIDENCE: 80
};