import dotenv from 'dotenv';
dotenv.config();

// IMPORTANTE: Asegúrate de haber guardado los cambios que hicimos en src/execution.ts
import { EJECUTAR_ORDEN } from './execution.ts';

async function FORZAR_DISPARO() {
    console.log("🚀 [HACK ACTIVADO] INYECTANDO ORDEN A BYBIT Y SUPABASE...");
    
    // Le inventamos un precio y un RSI de mentira para el Dashboard
    const precioActual = 86.83; 
    const rsiSimulado = 55.40;
    
    const decisionFalsa = {
        decision: "COMPRAR",
        confianza: 99,
        razonamiento: "Simulación de francotirador. Bybit confirmado.",
        take_profit_price: 88.50, // Distancia $1.67
        stop_loss_price: 85.00    // Distancia $1.83 (Ratio 0.9, el filtro actual lo deja pasar)
    };

    // Fíjate que ahora pasamos 3 variables: decisión, precio, y RSI.
    await EJECUTAR_ORDEN(decisionFalsa, precioActual, rsiSimulado);
}

FORZAR_DISPARO();