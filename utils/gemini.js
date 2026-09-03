const { GoogleGenAI } = require("@google/genai");

let genAIClient = null;

function getGeminiClient() {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Fallback clinical dialogue mode will be used.");
    } else {
      console.log("Gemini API Client initialized successfully.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || "dummy_key",
    });
  }
  return genAIClient;
}

module.exports = {
  getGeminiClient
};
