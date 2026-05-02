import axios from 'axios';

const ORS_KEY = () => process.env['ORS_API_KEY'] ?? '';
const nominatim = axios.create({ baseURL: 'https://nominatim.openstreetmap.org', headers: { 'User-Agent': 'LifeOS/1.0' } });
const ors = axios.create({ baseURL: 'https://api.openrouteservice.org' });
const overpass = axios.create({ baseURL: 'https://overpass-api.de/api' });

async function geocode(address: string): Promise<{ lat: number; lon: number; display: string } | null> {
  const { data } = await nominatim.get('/search', {
    params: { q: address, format: 'json', limit: 1, countrycodes: 'br' },
  });
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name.split(',').slice(0, 2).join(',') };
}

export async function getDrivingRoute(origin: string, destination: string): Promise<string> {
  const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
  if (!from) return `Endereço "${origin}" não encontrado.`;
  if (!to) return `Endereço "${destination}" não encontrado.`;

  if (!ORS_KEY()) {
    const dist = haversine(from.lat, from.lon, to.lat, to.lon);
    return `🚗 ${from.display} → ${to.display}\nDistância aproximada: ${dist.toFixed(1)} km\n\nPara rota detalhada, adicione ORS_API_KEY no .env (openrouteservice.org — grátis)`;
  }

  const { data } = await ors.post('/v2/directions/driving-car', {
    coordinates: [[from.lon, from.lat], [to.lon, to.lat]],
  }, { headers: { Authorization: ORS_KEY() } });

  const seg = data.routes[0].segments[0];
  const dist = (seg.distance / 1000).toFixed(1);
  const mins = Math.round(seg.duration / 60);
  const steps = seg.steps.slice(0, 5).map((s: any) => `• ${s.instruction} (${(s.distance / 1000).toFixed(1)} km)`);

  return `🚗 *${from.display} → ${to.display}*\n${dist} km · ${mins} min\n\n${steps.join('\n')}`;
}

export async function getTransitRoute(origin: string, destination: string): Promise<string> {
  const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
  if (!from) return `Endereço "${origin}" não encontrado.`;
  if (!to) return `Endereço "${destination}" não encontrado.`;

  const dist = haversine(from.lat, from.lon, to.lat, to.lon);
  const walkMins = Math.round((dist / 5) * 60);

  return `🚌 *${from.display} → ${to.display}*\nDistância: ${dist.toFixed(1)} km\nCaminhando: ~${walkMins} min\n\nPara horários de ônibus em BH: consulte o app BHBus ou Moovit.\nLinha específica? Me diga o número da linha.`;
}

export async function searchNearby(location: string, type: string): Promise<string> {
  const geo = await geocode(location);
  if (!geo) return `Localização "${location}" não encontrada.`;

  const osmTags: Record<string, string> = {
    restaurant: 'amenity=restaurant', pharmacy: 'amenity=pharmacy',
    hospital: 'amenity=hospital', supermarket: 'shop=supermarket',
    bank: 'amenity=bank', atm: 'amenity=atm', gas_station: 'amenity=fuel',
    cafe: 'amenity=cafe', school: 'amenity=school',
  };

  const tag = osmTags[type] ?? `amenity=${type}`;
  const query = `[out:json];node[${tag}](around:1000,${geo.lat},${geo.lon});out 5;`;

  const { data } = await overpass.get('/interpreter', { params: { data: query } });

  if (!data.elements?.length) return `Nenhum resultado para "${type}" perto de "${location}".`;

  const typeLabel: Record<string, string> = {
    restaurant: 'Restaurantes', hospital: 'Hospitais', pharmacy: 'Farmácias',
    gas_station: 'Postos', supermarket: 'Mercados', bank: 'Bancos', atm: 'Caixas eletrônicos', cafe: 'Cafés',
  };

  const places = data.elements.slice(0, 5).map((p: any) => {
    const name = p.tags?.name ?? 'Sem nome';
    const dist = haversine(geo.lat, geo.lon, p.lat, p.lon);
    return `• ${name} (${dist.toFixed(2)} km)`;
  });

  return `📍 *${typeLabel[type] ?? type} perto de ${location}:*\n\n${places.join('\n')}`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
