import axios from 'axios';
import FormData from 'form-data';

// Groq Whisper — grátis até 18.000 min/mês
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioRes = await axios.get<ArrayBuffer>(audioUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(audioRes.data);

  const urlClean = audioUrl.split('?')[0];
  const ext = urlClean.split('.').pop()?.toLowerCase() ?? 'ogg';
  const contentTypeMap: Record<string, string> = {
    mp3: 'audio/mpeg', mp4: 'audio/mp4', m4a: 'audio/mp4',
    wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', oga: 'audio/ogg',
  };
  const contentType = contentTypeMap[ext] ?? 'audio/ogg';
  const filename = `audio.${ext in contentTypeMap ? ext : 'ogg'}`;

  const form = new FormData();
  form.append('file', buffer, { filename, contentType });
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
