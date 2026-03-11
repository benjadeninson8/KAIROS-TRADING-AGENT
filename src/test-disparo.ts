import dotenv from 'dotenv';
dotenv.config();
import { EJECUTAR_ORDEN } from './execution.ts';

async function FORZAR_DISPARO() {
    console.log("🚀 [HACK ACTIVADO] SALTANDO AL JUEZ E INYECTANDO ORDEN...");
    
    const precioActual = 85.00; // Simulamos que SOL está en $85
    
    const decisionFalsa = {
        decision: "COMPRAR",
        take_profit_price: 86.50, // Distancia $1.50
        stop_loss_price: 84.00    // Distancia $1.00
        // El Ratio es 1.5, así que pasará todos tus filtros de seguridad
    };

    // Le mandamos la orden falsa a tus manos
    await EJECUTAR_ORDEN(decisionFalsa, precioActual);
}

FORZAR_DISPARO();