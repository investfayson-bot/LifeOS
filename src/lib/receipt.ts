import OpenAI from 'openai';
import axios from 'axios';

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

export interface ReceiptData {
  amount: number;
  description: string;
  category: string;
  date?: string;
  items?: string[];
}

export async function parseReceipt(imageUrl: string): Promise<ReceiptData> {
  const imageResponse = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(imageResponse.data).toString('base64');
  const mimeType = imageResponse.headers['content-type'] ?? 'image/jpeg';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: `Analise este recibo/nota fiscal e retorne JSON:
{
  "amount": <valor total como número>,
  "description": "<nome do estabelecimento ou tipo de compra>",
  "category": "<FOOD|TRANSPORT|HEALTH|EDUCATION|HOUSING|ENTERTAINMENT|BUSINESS|OTHER>",
  "date": "<data no formato YYYY-MM-DD se visível>",
  "items": ["<item1>", "<item2>"] // até 3 itens principais
}
Retorne APENAS o JSON, sem texto adicional.`,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message.content ?? '{}';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean) as ReceiptData;
  } catch {
    throw new Error('Não consegui ler o recibo. Tente uma foto mais nítida.');
  }
}
