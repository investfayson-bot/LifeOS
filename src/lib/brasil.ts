import axios from 'axios';

const brasilApi = axios.create({ baseURL: 'https://brasilapi.com.br/api' });
const viaCep = axios.create({ baseURL: 'https://viacep.com.br/ws' });

// ─── CEP ─────────────────────────────────────────────────
export async function lookupCep(cep: string): Promise<string> {
  const clean = cep.replace(/\D/g, '');
  const { data } = await viaCep.get(`/${clean}/json/`);
  if (data.erro) return `CEP ${cep} não encontrado.`;
  return `📍 *CEP ${data.cep}*\n${data.logradouro}${data.complemento ? `, ${data.complemento}` : ''}\n${data.bairro} — ${data.localidade}/${data.uf}`;
}

// ─── CNPJ ─────────────────────────────────────────────────
export async function lookupCnpj(cnpj: string): Promise<string> {
  const clean = cnpj.replace(/\D/g, '');
  const { data } = await brasilApi.get(`/cnpj/v1/${clean}`);
  const status = data.descricao_situacao_cadastral ?? '';
  const porte = data.porte ?? '';
  return `🏢 *${data.razao_social}*\nFantasia: ${data.nome_fantasia || '—'}\nCNPJ: ${data.cnpj}\nSituação: ${status}\nPorte: ${porte}\nMunicípio: ${data.municipio}/${data.uf}`;
}

// ─── FIPE ─────────────────────────────────────────────────
export async function searchFipe(query: string): Promise<string> {
  const { data: brands } = await brasilApi.get('/fipe/marcas/v1/carros');
  const brand = brands.find((b: { nome: string; valor: string }) =>
    query.toLowerCase().includes(b.nome.toLowerCase())
  );
  if (!brand) return `Marca não encontrada para "${query}". Tente: "Tabela FIPE Chevrolet Onix 2020"`;

  const { data: models } = await brasilApi.get(`/fipe/veiculos/v1/carros/${brand.valor}`);
  const modelName = query.toLowerCase().replace(brand.nome.toLowerCase(), '').trim();
  const model = models.modelos?.find((m: { nome: string; codigo: number }) =>
    m.nome.toLowerCase().includes(modelName)
  );
  if (!model) return `Modelo não encontrado. Marcas disponíveis: ${brands.slice(0, 5).map((b: { nome: string }) => b.nome).join(', ')}...`;

  const yearMatch = query.match(/\d{4}/);
  const year = yearMatch?.[0] ?? new Date().getFullYear().toString();

  const { data: years } = await brasilApi.get(`/fipe/veiculos/v1/carros/${brand.valor}/${model.codigo}`);
  const yearData = years.find((y: { ano: string }) => y.ano.includes(year));
  if (!yearData) return `Ano ${year} não encontrado para este modelo.`;

  const { data: price } = await brasilApi.get(`/fipe/veiculos/v1/carros/${brand.valor}/${model.codigo}/${yearData.ano}`);
  return `🚗 *Tabela FIPE*\n${price.marca} ${price.modelo}\nAno: ${price.anoModelo}\nPreço: *${price.valor}*\nCódigo FIPE: ${price.codigoFipe}\nRef: ${price.mesReferencia}`;
}

// ─── FERIADOS ─────────────────────────────────────────────
export async function getHolidays(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const { data } = await brasilApi.get(`/feriados/v1/${y}`);
  const upcoming = data
    .filter((h: { date: string }) => new Date(h.date + 'T00:00:00') >= new Date())
    .slice(0, 5);
  if (!upcoming.length) return `Sem feriados próximos em ${y}.`;
  const lines = upcoming.map((h: { date: string; name: string; type: string }) => {
    const d = new Date(h.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `• ${d} — ${h.name}`;
  });
  return `📅 *Próximos feriados ${y}:*\n\n${lines.join('\n')}`;
}

// ─── BANCOS ───────────────────────────────────────────────
export async function lookupBank(query: string): Promise<string> {
  const { data } = await brasilApi.get('/banks/v1');
  const bank = data.find((b: { name: string; code: number }) =>
    b.name?.toLowerCase().includes(query.toLowerCase()) ||
    String(b.code) === query
  );
  if (!bank) return `Banco "${query}" não encontrado.`;
  return `🏦 *${bank.name}*\nCódigo: ${bank.code}\nISPB: ${bank.ispb ?? '—'}`;
}
