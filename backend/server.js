import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Log incoming requests to terminal only (Stateless)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "You are a basic health assistant. Give only general advice. Do not provide medical diagnosis. Always suggest consulting a doctor for any health concerns or emergencies."
});

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const lastUserMessage = message || "Hello";

    const result = await model.generateContent(lastUserMessage);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });
  } catch (error) {
    console.error('Gemini API Error details:', error);
    res.status(500).json({ 
      message: "AI service error", 
      details: error.message,
      reply: "I'm having trouble thinking right now. Please try again." 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`AI Proxy (Gemini) running on port ${PORT}`);
});
