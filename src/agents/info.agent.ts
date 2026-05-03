import { lookupCep, lookupCnpj, searchFipe, getHolidays, lookupBank } from '../lib/brasil';
import { getRate, getAllRates } from '../lib/currency';
import { getWeather, getForecast } from '../lib/weather';
import { getTransitRoute, getDrivingRoute, searchNearby } from '../lib/maps';

export async function handleInfo(
  action: string,
  entities: Record<string, unknown>,
  rawText: string
): Promise<string> {
  try {
    switch (action) {

      // ─── Transporte público ───────────────────────────────
      case 'transit_route': {
        const origin = String(entities['origin'] ?? '');
        const destination = String(entities['destination'] ?? '');
        if (!origin || !destination) return 'De onde para onde? Ex: "ônibus da Savassi para Pampulha"';
        return await getTransitRoute(origin + ', Belo Horizonte, MG', destination + ', Belo Horizonte, MG');
      }

      case 'driving_route': {
        const origin = String(entities['origin'] ?? '');
        const destination = String(entities['destination'] ?? '');
        return await getDrivingRoute(origin, destination);
      }

      // ─── Lugares próximos ─────────────────────────────────
      case 'nearby': {
        const location = String(entities['location'] ?? rawText);
        const type = String(entities['place_type'] ?? 'restaurant');
        return await searchNearby(location, type);
      }

      // ─── Clima ────────────────────────────────────────────
      case 'weather': {
        const city = String(entities['city'] ?? 'Belo Horizonte');
        return await getWeather(city);
      }

      case 'forecast': {
        const city = String(entities['city'] ?? 'Belo Horizonte');
        return await getForecast(city);
      }

      // ─── Câmbio ───────────────────────────────────────────
      case 'currency_rate': {
        const from = String(entities['currency'] ?? 'USD');
        return await getRate(from);
      }

      case 'all_rates': {
        return await getAllRates();
      }

      // ─── CEP ──────────────────────────────────────────────
      case 'cep_lookup': {
        const cep = String(entities['cep'] ?? rawText.replace(/\D/g, ''));
        return await lookupCep(cep);
      }

      // ─── CNPJ ─────────────────────────────────────────────
      case 'cnpj_lookup': {
        const cnpj = String(entities['cnpj'] ?? rawText.replace(/\D/g, ''));
        return await lookupCnpj(cnpj);
      }

      // ─── FIPE ─────────────────────────────────────────────
      case 'fipe_lookup': {
        const query = String(entities['query'] ?? rawText);
        return await searchFipe(query);
      }

      // ─── Feriados ─────────────────────────────────────────
      case 'holidays': {
        const year = entities['year'] ? Number(entities['year']) : undefined;
        return await getHolidays(year);
      }

      // ─── Bancos ───────────────────────────────────────────
      case 'bank_lookup': {
        const query = String(entities['query'] ?? rawText);
        return await lookupBank(query);
      }

      default:
        return 'Não entendi o que você quer buscar. Tente: cotação do dólar, previsão do tempo, CEP, CNPJ, tabela FIPE ou rota de ônibus.';
    }
  } catch (err: any) {
    console.error(`[InfoAgent] ${action} failed:`, err?.message ?? err);
    const isNetwork = err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.response?.status >= 500;
    const is401 = err?.response?.status === 401;
    const is404 = err?.response?.status === 404;
    if (is401) return 'Chave de API inválida para este serviço. Verifique as configurações.';
    if (is404) return 'Informação não encontrada. Verifique o dado informado e tente novamente.';
    if (isNetwork) return 'Serviço externo fora do ar. Tente novamente em alguns minutos.';
    return 'Não consegui buscar essa informação agora. Tente novamente.';
  }
}
