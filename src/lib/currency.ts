import axios from 'axios';

const api = axios.create({ baseURL: 'https://economia.awesomeapi.com.br' });

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Dólar americano', EUR: 'Euro', GBP: 'Libra', BTC: 'Bitcoin',
  ETH: 'Ethereum', ARS: 'Peso argentino', CLP: 'Peso chileno',
  CAD: 'Dólar canadense', AUD: 'Dólar australiano', JPY: 'Iene japonês',
  CNY: 'Yuan chinês', CHF: 'Franco suíço', MXN: 'Peso mexicano',
};

export async function getRate(from: string, to = 'BRL'): Promise<string> {
  const pair = `${from.toUpperCase()}-${to.toUpperCase()}`;
  const { data } = await api.get(`/json/last/${pair}`);
  const key = pair.replace('-', '');
  const r = data[key];
  if (!r) return `Par ${pair} não encontrado.`;

  const bid = parseFloat(r.bid).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const ask = parseFloat(r.ask).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const pct = parseFloat(r.pctChange);
  const arrow = pct >= 0 ? '▲' : '▼';
  const name = CURRENCY_NAMES[from.toUpperCase()] ?? from.toUpperCase();

  return `💱 *${name}*\nCompra: R$ ${bid}\nVenda: R$ ${ask}\nVariação: ${arrow} ${Math.abs(pct).toFixed(2)}%\nAtualizado: ${new Date(Number(r.timestamp) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export async function getAllRates(): Promise<string> {
  const pairs = 'USD-BRL,EUR-BRL,BTC-BRL,GBP-BRL,ARS-BRL';
  const { data } = await api.get(`/json/last/${pairs}`);

  const lines = Object.values(data).map((r: any) => {
    const bid = parseFloat(r.bid).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const pct = parseFloat(r.pctChange);
    const arrow = pct >= 0 ? '▲' : '▼';
    const name = CURRENCY_NAMES[r.code] ?? r.code;
    return `${name}: R$ ${bid} ${arrow}${Math.abs(pct).toFixed(2)}%`;
  });

  return `💱 *Cotações agora:*\n\n${lines.join('\n')}`;
}
