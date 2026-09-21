import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const model = 'gemini-3.5-flash-lite';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 

app.post('/api/chat', async (req, res) => {
  const { conversations } = req.body;

  try {
    if (!conversations || !Array.isArray(conversations)) {    
        throw new Error('Invalid conversations format. It should be an array of messages.'); 
    }
    const contents = conversations.map(({role, text  }  ) => ({
        role,   
        parts: [{ text }],
    }));
    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            temperature: 0.9,
            // systemInstruction: 'Jawab hanya dengan mengngunakan bahasa Indonesia.',
            systemInstruction: `Anda adalah assistent sales fragrance yang berpengalaman 10 tahun.
            Jawab hanya pertanyaan seputar parfum, fragrance, dan wewangian.
            Jangan jawab pertanyaan yang tidak relevan dengan parfum, fragrance, dan wewangian.
            Jawab dengan ramah, tanyakan mau mengetahui parfum yang seperti apa.
            lalu buatkan itenerary parfum yang sesuai dengan keinginan user.
            `,
        },
    });
    
    res.status(200).json({ result: response.text });    

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});