import axios from 'axios';
import FormData from 'form-data';

// Groq Whisper — grátis até 18.000 min/mês
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioRes = await axios.get<ArrayBuffer>(audioUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(audioRes.data);

  const form = new FormData();
  form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${process.env['GROQ_API_KEY']}`,
    },
  });

  return res.data.text as string;
}
