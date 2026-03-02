const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function run() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log("Fetching model list...");

        // In newer versions of the SDK, listModels might be located differently
        // but historically it's been on the genAI instance.
        const result = await genAI.listModels();

        console.log("Models found:");
        result.models.forEach((m) => {
            console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(", ")})`);
        });
    } catch (err) {
        console.error("ListModels Error:", err.message);
        if (err.message.includes("404")) {
            console.error("\nANALIZ: API anahtarı geçersiz veya 'Generative Language API' kapalı.");
        }
    }
}

run();
