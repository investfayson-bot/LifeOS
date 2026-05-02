# LifeOS — Prompt de Arquitetura Completa

---

You are a senior system architect and full-stack engineer.

I am building a product called **LifeOS** — an AI-powered personal and professional assistant operating system delivered entirely through WhatsApp.

---

## VISION

A single WhatsApp number that acts as a smart assistant for any person's life:
- A realtor pulls up leads, schedules visits, and follows up on clients
- A dentist manages appointments and sends reminders
- An aesthetician controls her client book and finances
- A regular person tracks bills, family calendar, and expenses

Everything through natural conversation. No app to install.

---

## PLANS

### Plan 1 — Dia a Dia (Personal / PF)
- Expense tracking via chat ("gastei R$80 no mercado")
- Receipt scanning (photo → expense via OCR)
- OFX/PDF bank statement import and parsing
- Bill and subscription reminders
- Family calendar (school, appointments, events)
- Financial summaries on demand
- Personal chat assistant
- **Bank direct integration (Open Finance) — EM BREVE**

### Plan 2 — Dedicado (Professional)
Everything in Plan 1, plus:
- Full CRM (leads, clients, pipeline, follow-ups)
- Profession-aware scheduling (dentist, realtor, aesthetician, photographer, etc.)
- Marketing AI (captions, posts, stories, scripts for Instagram)
- Business automation (automatic follow-up sequences, reminders)
- Integration with external CRMs and platforms (FactorOne, VN Prime, custom APIs)
- Basic business intelligence reports
- Multi-user (assistant + professional in same account)

---

## PROFESSION PROFILES

The system must support configurable profession profiles that activate different agent behaviors:

| Profile | Active Agents | Key Features |
|---|---|---|
| `REALTOR` | CRM, Scheduling, Marketing, Finance | Lead funnel, FactorOne integration, VN Prime sync |
| `DENTIST` | Scheduling, CRM, Finance | Procedure types, return scheduling, anamnese |
| `AESTHETICIAN` | Scheduling, CRM, Finance, Marketing | Service duration, loyalty, before/after posts |
| `PHOTOGRAPHER` | Scheduling, Marketing, Finance | Delivery tracking, contract dates |
| `PERSONAL` | Finance, Scheduling | No CRM, personal-only features |
| `CUSTOM` | All | Fully configurable |

---

## CORE ARCHITECTURE

### System Flow

```
USUÁRIO (WhatsApp)
        ↓
Evolution API (webhook)
        ↓
Message Queue (BullMQ + Redis)
        ↓
AI Orchestrator — AssistantOrchestrator
        ↓
ConversationMemory (Redis sliding window, last 20 messages)
        ↓
Intent Classifier (Claude API)
        ↓
Agent Router
        ├── FinanceAgent       — expenses, bills, reports, OFX parsing
        ├── CRMAgent           — leads, clients, follow-ups, pipeline
        ├── SchedulingAgent    — appointments, reminders, calendar
        ├── MarketingAgent     — posts, captions, scripts, content
        └── NotificationAgent  — proactive alerts, cron-based reminders
                ↓
        ConnectorManager       — optional external integrations
                ├── GoogleConnector    (Calendar, Gmail, Drive)
                ├── BankConnector      (OFX/PDF now → Open Finance EM BREVE)
                ├── CRMConnector       (FactorOne, VN Prime)
                ├── SocialConnector    (Instagram via Meta Graph API)
                └── CustomConnector    (any webhook/API)
                        ↓
                PostgreSQL (via Prisma ORM)
                        ↓
                Response → WhatsApp
```

---

## TECH STACK

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue | BullMQ + Redis |
| Memory/Cache | Redis (conversation context, session state) |
| WhatsApp | Evolution API (self-hosted) |
| AI Primary | Claude API (Anthropic) — claude-sonnet-4-20250514 |
| AI Fallback | OpenAI GPT-4o |
| File/OCR | multer + pdfparse + tesseract.js |
| Scheduler | node-cron (NotificationAgent proactive reminders) |
| Auth | JWT + phone number as identity (WhatsApp verified) |
| Hosting MVP | Railway or Render (Postgres + Redis included) |
| Cost MVP | ~R$0–75/mês |

---

## CONVERSATION MEMORY DESIGN

### Short-term (Redis)
```
Key: conversation:{userId}
Value: last 20 messages (role + content + timestamp + agent)
TTL: 24 hours of inactivity resets context
```

### Long-term (PostgreSQL)
Extracted facts stored permanently:
- Client/lead names mentioned
- Recurring expenses and patterns
- Important dates (birthdays, due dates, appointments)
- User preferences and habits

---

## FOLDER STRUCTURE

```
lifeos/
├── src/
│   ├── agents/
│   │   ├── orchestrator.ts        # Intent classifier + router
│   │   ├── finance.agent.ts
│   │   ├── crm.agent.ts
│   │   ├── scheduling.agent.ts
│   │   ├── marketing.agent.ts
│   │   └── notification.agent.ts
│   ├── connectors/
│   │   ├── connector.manager.ts
│   │   ├── google.connector.ts
│   │   ├── bank.connector.ts      # OFX parser now, Open Finance later
│   │   ├── crm.connector.ts       # FactorOne, VN Prime
│   │   └── social.connector.ts    # Instagram
│   ├── memory/
│   │   ├── conversation.store.ts  # Redis sliding window
│   │   └── longterm.store.ts      # PostgreSQL facts
│   ├── queue/
│   │   ├── message.queue.ts       # BullMQ setup
│   │   └── message.worker.ts      # Queue processor
│   ├── webhooks/
│   │   └── evolution.webhook.ts   # Receives WhatsApp messages
│   ├── api/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   └── connector.routes.ts    # OAuth flows
│   ├── scheduler/
│   │   └── cron.jobs.ts           # NotificationAgent triggers
│   ├── lib/
│   │   ├── claude.ts              # Anthropic client
│   │   ├── redis.ts
│   │   └── evolution.ts           # Evolution API client
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── .env
└── package.json
```

---

## PRISMA SCHEMA

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────────

enum PlanType {
  PERSONAL
  PROFESSIONAL
}

enum ProfessionType {
  PERSONAL
  REALTOR
  DENTIST
  AESTHETICIAN
  PHOTOGRAPHER
  CUSTOM
}

enum ConnectorType {
  GOOGLE
  BANK_OFX
  OPEN_FINANCE
  FACTORONE
  VN_PRIME
  INSTAGRAM
  CUSTOM
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum ExpenseCategory {
  FOOD
  TRANSPORT
  HEALTH
  EDUCATION
  HOUSING
  ENTERTAINMENT
  BUSINESS
  OTHER
}

// ─── CORE ────────────────────────────────────────────────

model Tenant {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  users     User[]
}

model User {
  id             String         @id @default(uuid())
  phone          String         @unique
  name           String?
  plan           PlanType       @default(PERSONAL)
  professionType ProfessionType @default(PERSONAL)
  tenantId       String
  tenant         Tenant         @relation(fields: [tenantId], references: [id])
  tokenBudget    Float          @default(10.0) // USD per month limit
  tokenUsed      Float          @default(0.0)
  createdAt      DateTime       @default(now())

  connectors    Connector[]
  expenses      Expense[]
  bills         Bill[]
  leads         Lead[]
  appointments  Appointment[]
  memories      LongTermMemory[]
  notifications NotificationSchedule[]
}

// ─── CONNECTORS ──────────────────────────────────────────

model Connector {
  id           String        @id @default(uuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  type         ConnectorType
  accessToken  String?
  refreshToken String?
  metadata     Json?         // connector-specific config
  active       Boolean       @default(true)
  createdAt    DateTime      @default(now())

  @@unique([userId, type])
}

// ─── FINANCE ─────────────────────────────────────────────

model Expense {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  description String
  amount      Float
  category    ExpenseCategory @default(OTHER)
  date        DateTime        @default(now())
  receiptUrl  String?         // OCR source image
  source      String          @default("manual") // manual | ocr | ofx | whatsapp
  createdAt   DateTime        @default(now())
}

model Bill {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  description String
  amount      Float
  dueDate     DateTime
  paid        Boolean   @default(false)
  recurring   Boolean   @default(false)
  createdAt   DateTime  @default(now())
}

// ─── CRM ─────────────────────────────────────────────────

model Lead {
  id           String     @id @default(uuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id])
  name         String
  phone        String?
  email        String?
  status       LeadStatus @default(NEW)
  notes        String?
  source       String?    // instagram, indicação, site, etc.
  externalId   String?    // ID no FactorOne ou VN Prime
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  followUps    FollowUp[]
}

model FollowUp {
  id          String    @id @default(uuid())
  leadId      String
  lead        Lead      @relation(fields: [leadId], references: [id])
  notes       String
  scheduledAt DateTime?
  done        Boolean   @default(false)
  createdAt   DateTime  @default(now())
}

// ─── SCHEDULING ──────────────────────────────────────────

model Appointment {
  id            String            @id @default(uuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id])
  clientName    String
  clientPhone   String?
  service       String?
  status        AppointmentStatus @default(SCHEDULED)
  scheduledAt   DateTime
  durationMins  Int               @default(60)
  notes         String?
  reminderSent  Boolean           @default(false)
  createdAt     DateTime          @default(now())
}

// ─── MEMORY ──────────────────────────────────────────────

model LongTermMemory {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  key       String   // e.g. "client_name", "birthday", "preference"
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, key])
}

// ─── NOTIFICATIONS ───────────────────────────────────────

model NotificationSchedule {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  message     String
  sendAt      DateTime
  sent        Boolean   @default(false)
  recurring   Boolean   @default(false)
  cronExpr    String?   // for recurring notifications
  createdAt   DateTime  @default(now())
}
```

---

## API ROUTES

```
POST   /webhook/evolution          # Receives WhatsApp messages (Evolution API)

POST   /auth/token                 # JWT login by phone
GET    /user/me                    # Current user profile
PATCH  /user/me                    # Update plan, profession, preferences

GET    /connectors                 # List active connectors
POST   /connectors/google/auth     # Start Google OAuth
GET    /connectors/google/callback # Complete Google OAuth
DELETE /connectors/:type           # Disconnect a connector

POST   /expenses                   # Manual expense entry
GET    /expenses                   # List with filters
POST   /expenses/ofx               # Upload OFX file for parsing

GET    /leads                      # CRM lead list
POST   /leads                      # Create lead
PATCH  /leads/:id                  # Update lead status
POST   /leads/:id/followup         # Add follow-up note

GET    /appointments               # Calendar view
POST   /appointments               # Create appointment
PATCH  /appointments/:id           # Update status

GET    /notifications              # Pending notifications
```

---

## AGENT ROUTING LOGIC (Orchestrator)

```typescript
const INTENT_PROMPT = `
You are LifeOS Orchestrator. Classify the user's message intent.
Return JSON: { agent: string, action: string, entities: object }

Agents: FINANCE | CRM | SCHEDULING | MARKETING | NOTIFICATION | GENERAL

Examples:
"gastei 50 reais no almoço" → { agent: "FINANCE", action: "add_expense", entities: { amount: 50, description: "almoço" } }
"agende cliente João amanhã às 14h" → { agent: "SCHEDULING", action: "create_appointment", entities: { client: "João", time: "tomorrow 14:00" } }
"como estão meus leads?" → { agent: "CRM", action: "list_leads", entities: {} }
"cria legenda para post de antes e depois" → { agent: "MARKETING", action: "create_caption", entities: { type: "before_after" } }
"me lembra do vencimento do cartão dia 10" → { agent: "NOTIFICATION", action: "schedule_reminder", entities: { date: "day 10", topic: "cartão" } }
`;
```

---

## MVP IMPLEMENTATION ORDER

### Phase 1 — Core (Week 1-2)
- [ ] Evolution API setup + webhook receiver
- [ ] BullMQ message queue
- [ ] Redis conversation memory
- [ ] Orchestrator with intent classifier
- [ ] FinanceAgent (add expense, list, summary)

### Phase 2 — CRM + Scheduling (Week 3-4)
- [ ] CRMAgent (leads, follow-ups, pipeline)
- [ ] SchedulingAgent (appointments, reminders)
- [ ] NotificationAgent + cron jobs

### Phase 3 — Connectors (Week 5-6)
- [ ] Google Calendar connector
- [ ] OFX file parser (bank statements)
- [ ] FactorOne / VN Prime connector

### Phase 4 — Marketing + Polish (Week 7-8)
- [ ] MarketingAgent (captions, scripts)
- [ ] Instagram connector (Meta Graph API)
- [ ] Token budget per user
- [ ] Audit logs

### Phase 5 — Scale (Future)
- [ ] Open Finance / Pluggy integration
- [ ] Web dashboard (Next.js)
- [ ] Billing (Stripe)
- [ ] Multi-tenant onboarding flow

---

## COST ESTIMATE (MVP)

| Item | Cost |
|---|---|
| Evolution API (self-hosted, Railway) | R$0–25/mês |
| PostgreSQL + Redis (Railway) | R$25/mês |
| Claude API (~50 users, ~20 msgs/day) | ~R$50/mês |
| Total | **~R$75–100/mês** |

Open Finance integration: **EM BREVE** (Pluggy/Belvo when user base justifies cost)

---

## OUTPUT REQUIRED FROM THIS PROMPT

1. Confirm or improve the architecture above
2. Generate the complete folder structure with all files
3. Implement the core: webhook receiver → queue → orchestrator → FinanceAgent
4. Generate the full Prisma schema migration
5. Provide Evolution API setup instructions
6. Identify any architectural gaps or risks
