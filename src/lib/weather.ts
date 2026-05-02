import axios from 'axios';

const api = axios.create({ baseURL: 'https://api.openweathermap.org/data/2.5' });
const KEY = () => process.env['OPENWEATHER_API_KEY'] ?? '';

const ICONS: Record<string, string> = {
  '01': '☀️', '02': '⛅', '03': '🌤', '04': '☁️',
  '09': '🌧', '10': '🌦', '11': '⛈', '13': '❄️', '50': '🌫',
};

function icon(code: string): string {
  return ICONS[code.slice(0, 2)] ?? '🌡';
}

export async function getWeather(city: string): Promise<string> {
  if (!KEY()) return 'Previsão do tempo não configurada. Adicione OPENWEATHER_API_KEY no .env';

  const { data } = await api.get('/weather', {
    params: { q: `${city},BR`, appid: KEY(), units: 'metric', lang: 'pt_br' },
  });

  const temp = Math.round(data.main.temp);
  const feels = Math.round(data.main.feels_like);
  const desc = data.weather[0].description;
  const humidity = data.main.humidity;
  const wind = Math.round(data.wind.speed * 3.6);
  const ico = icon(data.weather[0].icon);

  return `${ico} *${data.name} agora*\n${temp}°C (sensação ${feels}°C)\n${desc}\nUmidade: ${humidity}% · Vento: ${wind} km/h`;
}

export async function getForecast(city: string): Promise<string> {
  if (!KEY()) return 'Previsão do tempo não configurada. Adicione OPENWEATHER_API_KEY no .env';

  const { data } = await api.get('/forecast', {
    params: { q: `${city},BR`, appid: KEY(), units: 'metric', lang: 'pt_br', cnt: 24 },
  });

  const days = new Map<string, { min: number; max: number; desc: string; icon: string }>();

  for (const item of data.list) {
    const day = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const existing = days.get(day);
    if (!existing) {
      days.set(day, { min: item.main.temp_min, max: item.main.temp_max, desc: item.weather[0].description, icon: item.weather[0].icon });
    } else {
      days.set(day, { ...existing, min: Math.min(existing.min, item.main.temp_min), max: Math.max(existing.max, item.main.temp_max) });
    }
  }

  const lines = Array.from(days.entries()).slice(0, 4).map(([day, d]) =>
    `${icon(d.icon)} ${day}: ${Math.round(d.min)}°–${Math.round(d.max)}° ${d.desc}`
  );

  return `🌤 *Previsão — ${data.city.name}*\n\n${lines.join('\n')}`;
}
