# Custos das APIs — LifeOS

> Referência: maio/2026. Cotação: 1 USD ≈ R$ 5,70

---

## 📱 WhatsApp (Gateway)

| Serviço | Modelo | Custo | Obs |
|---|---|---|---|
| **Z-API** | Plano Basic | R$ 89/mês | 1 instância, sem limite de msg |
| **Z-API** | Plano Pro | R$ 179/mês | Multi-instância, suporte prioritário |
| **Evolution API** | Self-hosted | **R$ 0** | Você hospeda, usa Baileys/Baileys |
| **Twilio WhatsApp** | Por mensagem | ~R$ 0,57/msg enviada + R$ 0,57/msg recebida | Caro para volume alto |
| **Meta Cloud API** | Oficial Meta | Grátis até 1.000 conv/mês, depois ~R$ 0,42/conv | Requer aprovação da Meta |
| **WPPConnect** | Self-hosted | **R$ 0** | Open source, similar ao Baileys |

**Recomendação MVP:** Evolution API (grátis, já está no docker-compose)
**Recomendação Produção:** Meta Cloud API (oficial, estável, custo previsível)

---

## 🤖 IA / LLM

| Serviço | Modelo | Input | Output | Estimativa 50 usuários/20 msgs/dia |
|---|---|---|---|---|
| **Anthropic** | Claude Sonnet 4.5 | $3/M tokens | $15/M tokens | ~R$ 45/mês |
| **Anthropic** | Claude Haiku 3.5 | $0,80/M tokens | $4/M tokens | ~R$ 12/mês |
| **OpenAI** | GPT-4o | $2,50/M tokens | $10/M tokens | ~R$ 35/mês |
| **OpenAI** | GPT-4o mini | $0,15/M tokens | $0,60/M tokens | ~R$ 3/mês |
| **Groq** | Llama 3.3 70B | $0,59/M tokens | $0,79/M tokens | ~R$ 9/mês |

**Atual:** Claude Sonnet (orquestrador + agentes)
**Otimização futura:** Claude Haiku para classificação de intent, Sonnet só para respostas complexas

---

## 🎤 Transcrição de Áudio (Whisper)

| Serviço | Preço | Estimativa 50 usuários/5 áudios/dia |
|---|---|---|
| **OpenAI Whisper** | $0,006/minuto | ~R$ 9/mês (áudios de ~30s) |
| **Groq Whisper** | **Grátis** (18.000 min/mês free tier) | R$ 0 no MVP |
| **AssemblyAI** | $0,012/minuto | ~R$ 18/mês |

**Atual:** OpenAI Whisper
**Otimização:** Migrar para Groq (grátis até 18.000 min/mês)

---

## 📅 Google APIs

| API | Custo | Limite gratuito |
|---|---|---|
| **Google Calendar API** | **Grátis** | 1M requests/dia |
| **Google Drive API** | **Grátis** | 10GB armazenamento |
| **Google Gmail API** | **Grátis** | 1B requests/dia |
| **Google OAuth** | **Grátis** | Ilimitado |

**Implementação futura:** conectar Google Calendar para sincronizar agendamentos

---

## 📊 CRM Integrações

| Serviço | Plano | Custo |
|---|---|---|
| **FactorOne** | API parceiro | Consultar (geralmente % da transação) |
| **VN Prime** | API parceiro | Consultar |
| **HubSpot API** | Free tier | Grátis até 1M contacts |
| **Pipedrive API** | Plano Essential | ~R$ 80/usuário/mês |

---

## 📸 OCR / Leitura de Recibos

| Serviço | Custo | Obs |
|---|---|---|
| **Tesseract.js** | **Grátis** | Open source, já no package.json |
| **Google Vision API** | $1,50/1000 imagens | Mais preciso |
| **AWS Textract** | $1,50/1000 páginas | Bom para documentos |
| **OpenAI Vision (GPT-4o)** | ~$0,003/imagem | Muito preciso, entende contexto |

**Atual:** Tesseract.js (grátis)
**Upgrade futuro:** OpenAI Vision para recibos complexos

---

## 🏦 Open Finance / Bancos

| Serviço | Modelo | Custo |
|---|---|---|
| **Pluggy** | Por conexão | ~R$ 5/conexão ativa/mês |
| **Belvo** | Por request | $0,10/account sync |
| **OpenFinance Brasil** | Direto com bancos | Grátis (requer certificação BCB) |
| **Guiabolso API** | Parceria | Consultar |

---

## 🏗️ Infraestrutura

| Serviço | Plano | Custo | Inclui |
|---|---|---|---|
| **Railway** | Hobby | R$ 28/mês | Postgres + Redis + 1 serviço |
| **Railway** | Pro | R$ 114/mês | Mais recursos, sem cold start |
| **Render** | Free | R$ 0 | Cold start de 30s, limitado |
| **Render** | Individual | R$ 42/mês | Sem cold start |
| **Supabase** | Free | R$ 0 | Postgres 500MB + Auth |
| **Upstash Redis** | Free | R$ 0 | 10K requests/dia |
| **VPS (DigitalOcean)** | Droplet 2GB | R$ 57/mês | Controle total |

---

## 💳 Pagamentos (Futuro)

| Serviço | Taxa | Obs |
|---|---|---|
| **Stripe** | 2,9% + R$ 1,70/transação | Internacional |
| **Pagar.me** | 2,49% + R$ 0,09/transação | Brasil, PIX incluso |
| **Mercado Pago** | 4,99% (cartão) / grátis (PIX) | Mais fácil de integrar |
| **Asaas** | 2% (PIX/boleto) | Foco em recorrência/SaaS |

**Recomendação para LifeOS:** Asaas (melhor para assinatura recorrente no Brasil)

---

## 📊 Estimativa Total MVP (50 usuários)

| Item | Custo/mês |
|---|---|
| Evolution API (self-hosted no Railway) | R$ 28 |
| Claude Sonnet (IA principal) | R$ 45 |
| OpenAI Whisper (áudio) | R$ 9 |
| **Total** | **~R$ 82/mês** |

### Com otimizações:
| Item | Custo/mês |
|---|---|
| Evolution API (self-hosted) | R$ 28 |
| Claude Haiku (intent) + Sonnet (resposta) | R$ 20 |
| Groq Whisper (áudio grátis) | R$ 0 |
| **Total otimizado** | **~R$ 48/mês** |

---

## 🚀 Escala (500 usuários)

| Item | Custo/mês |
|---|---|
| Infraestrutura (Railway Pro) | R$ 114 |
| Claude API | R$ 450 |
| Áudio (Groq free + OpenAI overflow) | R$ 30 |
| Meta Cloud API (WhatsApp oficial) | R$ 210 |
| **Total** | **~R$ 804/mês** |

Ticket mínimo viável por usuário: **R$ 1,60/mês**
Preço sugerido plano básico: **R$ 49-89/mês** → margem de 96%+
