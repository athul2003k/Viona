# 🚀 Viona Pro v3

Viona Pro v3 is an AI-powered SaaS platform for business operations management, combining inventory management, order processing, analytics, notifications, file storage, and intelligent AI agents into a unified system.

The platform is built using a microservices architecture powered by Next.js, FastAPI, Bun, RabbitMQ, Redis, MongoDB, PostgreSQL, and AI integrations.

---

## ✨ Features

### 🧠 AI Agent System
- Multi-agent AI architecture
- Domain-specific agents:
  - Inventory Agent
  - Orders Agent
  - Analytics Agent
- Intent classification
- Model selection and routing
- Budget allocation for AI requests
- WebSocket-based real-time AI chat

### 📦 Inventory Management
- Product management
- Warehouse tracking
- Stock monitoring
- Inventory analytics

### 🛒 Order Management
- Order creation and tracking
- Employee workflows
- Organization-level management

### 👥 Multi-Tenant SaaS
- Organization management
- Team members & roles
- Organization invites
- Subscription support

### 🔐 Authentication & Security
- Clerk authentication
- JWT verification
- Secure API access

### 📢 Notification System
- RabbitMQ event processing
- Real-time notifications
- Redis caching

### ☁️ File Storage
- Azure Blob Storage integration
- File upload APIs
- Secure storage access

### 💳 Billing & Subscription
- Stripe integration
- Multiple pricing plans
- Usage tracking

---

# 🏗 Architecture

```text
                    ┌─────────────────┐
                    │   Next.js App   │
                    │   (Frontend)    │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
 ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
 │ AI Agent API  │ │ Notification   │ │ Storage Server │
 │   FastAPI     │ │    Server      │ │      Bun       │
 └────────────────┘ └────────────────┘ └────────────────┘
          │                  │                  │
          └────────────┬─────┴─────┬────────────┘
                       ▼           ▼
                 ┌─────────┐ ┌──────────┐
                 │ Redis   │ │ RabbitMQ │
                 └─────────┘ └──────────┘
                       │
                       ▼
                  ┌──────────┐
                  │ MongoDB  │
                  └──────────┘
                       │
                       ▼
                  ┌──────────┐
                  │PostgreSQL│
                  │ Prisma   │
                  └──────────┘
```

---

# 📁 Project Structure

```text
Viona-pro--v3/
│
├── viona/                 # Next.js frontend
├── ai-agent-server/       # FastAPI AI backend
├── notification-server/  # Notification microservice
├── storage-server/       # File storage service
├── docker-compose.yml
└── README.md
```

---

# 🧰 Tech Stack

## Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Clerk Authentication
- Prisma ORM

## Backend
### AI Agent Server
- FastAPI
- LangChain
- LangGraph
- Redis
- RabbitMQ
- MongoDB

### Notification Server
- Express.js
- TypeScript
- Redis
- RabbitMQ
- MongoDB

### Storage Server
- Bun
- Express.js
- Azure Blob Storage

## Databases
- PostgreSQL
- MongoDB
- Redis

## Messaging
- RabbitMQ

## AI Providers
- OpenAI
- Groq
- Anthropic
- Google AI

---

# ⚙️ Environment Variables

Create a `.env` file in the root project.

## Frontend

```env
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=

ENCRYPTION_KEY=
NGROK_URL=
```

---

## AI Agent Server

```env
OPENAI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

REDIS_URL=
MONGO_URL=
RABBITMQ_URL=
DATABASE_URL=
CLERK_JWKS_URL=
```

---

## Storage Server

```env
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=
CLERK_SECRET_KEY=
MONGODB_URI=
```

---

# 🐳 Running with Docker

## Start Services

```bash
docker compose up --build
```

---

## Services

| Service | Port |
|---------|------|
| Frontend | 3000 |
| AI Agent Server | 8000 |
| Notification Server | 5002 |
| Storage Server | 5003 |
| RabbitMQ | 5672 |
| RabbitMQ Dashboard | 15672 |
| MongoDB | 27017 |
| Redis | 6379 |

---

# 🚀 Local Development

## Frontend

```bash
cd viona

npm install

npm run dev
```

---

## AI Agent Server

```bash
cd ai-agent-server

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

## Notification Server

```bash
cd notification-server

npm install

npm run dev
```

---

## Storage Server

```bash
cd storage-server

bun install

bun run src/server.ts
```

---

# 🧠 AI Agent Capabilities

The AI server includes:

- Intent classification
- Dynamic model selection
- Budget-aware routing
- Session memory using Redis
- Organization-aware context
- Domain-specific agents

### Available Domains

- Inventory
- Orders
- Analytics

---

# 📡 API Endpoints

## AI Agent Server

### Health Check

```http
GET /health
```

### Readiness Check

```http
GET /ready
```

### WebSocket Chat

```http
/ws
```

### Session APIs

```http
/api/*
```

---

# 🗄 Database Models

The Prisma schema includes:

- Users
- Organizations
- Employees
- Products
- Warehouses
- Orders
- Subscriptions
- Workflows
- Credentials
- Usage Records

---

# 🔄 Event-Driven Architecture

Viona uses RabbitMQ for:

- Notification delivery
- AI events
- Background jobs
- Service communication

Redis is used for:

- Session memory
- Caching
- AI conversation state

---

# 🔐 Authentication

Authentication is handled through **Clerk**.

Features include:

- Sign in / Sign up
- JWT verification
- Organization support
- Role-based access control

---

# ☁️ Storage

Storage service supports:

- Azure Blob Storage
- File uploads
- Secure file access
- Metadata storage

---

# 🧪 Health Monitoring

Available health endpoints:

```http
GET /health
GET /ready
```

Logging and observability are included within the AI Agent Server.

---
