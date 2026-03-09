import ccxt from 'ccxt';
import { RSI, BollingerBands } from 'technicalindicators';
import Groq from "groq-sdk";
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";

dotenv.config();

// Inicializar Clientes
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const exchange = new ccxt.binance();

// Configuración
const symbol = 'SOL/USDT';
const timeframe = '1h';

async function KAIROS_SISTEMA_COMPLETO() {
    console.log(`🚀 INICIANDO KAIROS: Ojos, Cerebro y Memoria...`);

    try {
        // --- 1. OJOS: Obtener datos reales ---
        const velas = await exchange.fetchOHLCV(symbol, timeframe, undefined, 100);
        const preciosCierre = velas.map(v => v[4] as number).filter(p => typeof p === 'number');
        
        const rsiRaw = RSI.calculate({ values: preciosCierre, period: 14 });
        const bbRaw = BollingerBands.calculate({ values: preciosCierre, period: 20, stdDev: 2 });

        const precioActual = preciosCierre[preciosCierre.length - 1];
        const rsiActual = rsiRaw[rsiRaw.length - 1];
        const bbActual = bbRaw[bbRaw.length - 1];

        const datosMercado = {
            precio: precioActual,
            rsi: rsiActual.toFixed(2),
            banda_sup: bbActual.upper.toFixed(2),
            banda_inf: bbActual.lower.toFixed(2)
        };

        // --- 2. CEREBRO: Análisis de IA ---
        console.log(`🧠 Analizando con Llama 3.3...`);
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "Eres KAIROS, trader experto. Responde SOLO en JSON: {\"decision\": \"...\", \"razonamiento\": \"...\", \"confianza\": 0-100, \"sl\": 0, \"tp\": 0}" },
                { role: "user", content: `Datos: ${JSON.stringify(datosMercado)}` }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
        });

        const decision = JSON.parse(completion.choices[0]?.message?.content || "{}");

        // --- 3. MEMORIA: Guardar en Supabase ---
        console.log(`💾 Guardando en Supabase...`);
        const { error } = await supabase
            .from('ai_logs')
            .insert([{
                pair: symbol,
                price_at_time: precioActual,
                rsi: parseFloat(datosMercado.rsi),
                bollinger_status: precioActual > bbActual.upper ? 'SOBRECOMPRA' : precioActual < bbActual.lower ? 'SOBREVENTA' : 'NEUTRAL',
                judge_verdict: decision.decision,
                confidence_score: decision.confianza,
                reasoning: decision.razonamiento // Asegúrate que esta columna existe en tu tabla
            }]);

        if (error) throw error;

        // Mostrar resultado final en consola
        console.log("\n========================================");
        console.log(`✅ ANÁLISIS COMPLETADO Y GUARDADO`);
        console.log(`📢 DECISIÓN: ${decision.decision}`);
        console.log(`📝 RAZÓN: ${decision.razonamiento}`);
        console.log("========================================\n");

    } catch (error) {
        console.error("❌ Error en el sistema:", error);
    }
}

KAIROS_SISTEMA_COMPLETO();