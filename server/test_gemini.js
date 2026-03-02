const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API Key found in .env");
        return;
    }

    console.log("Testing API Key:", key.substring(0, 6) + "..." + key.slice(-4));
    const genAI = new GoogleGenerativeAI(key);

    try {
        console.log("\n--- Listing available models ---");
        const modelsResult = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).listModels ? await genAI.listModels() : null;

        // Actually, listModels is not on genAI in the new SDK. 
        // It's on a separate client usually, but let's try a different approach.
        // Let's try to list by calling the API directly or using a different model name.

        console.log("Fallback: Trying to list models via fetch if possible...");
        // For simplicity, let's just try gemini-pro (legacy) or gemini-1.0-pro
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"];
        for (const m of models) {
            try {
                const tm = genAI.getGenerativeModel({ model: m });
                await tm.generateContent("test");
                console.log(`✅ Model ${m} is WORKING`);
            } catch (e) {
                console.log(`❌ Model ${m} FAILED: ${e.message.substring(0, 100)}...`);
            }
        }

    } catch (err) {
        console.error("\n!!! TEST FAILED !!!");
        console.error("Status:", err.status);
        console.error("Message:", err.message);

        if (err.message.includes("404")) {
            console.log("\n💡 ANALİZ: 404 hatası genellikle iki anlama gelir:");
            console.log("1. 'Generative Language API' bu Google projesinde aktif edilmemiş.");
            console.log("2. API anahtarı yanlış proje üzerinde oluşturulmuş.");
        }
    }
}

testModels();
