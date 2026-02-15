# AI Utils

A full-stack AI chat application with React (Vite), Node.js, LangGraph, Socket.io, and MCP (Model Context Protocol) integration. The backend serves both the API and the built frontend at http://localhost:3005.

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API key

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-utils
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3005) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Required in production for auth tokens |
| `OPENAI_API_KEY` | Required for chat AI |
| `OPENAI_MODEL` | Model name (default: gpt-3.5-turbo) |
| `OPENAI_TEMPERATURE` | 0–1 (default: 0) |
| `CORS_ORIGIN` | Allowed frontend origin(s) in production |

### 3. Install dependencies

```bash
npm install
cd frontend && npm install
```

## Running

### Development

**Terminal 1 – backend**

```bash
npm run dev
```

**Terminal 2 – frontend**

```bash
cd frontend && npm run dev
```

Frontend (Vite dev): http://localhost:5173  
Backend (API): http://localhost:3005

### Production

```bash
npm run build
npm start
```

`npm run build` builds both the frontend and backend. The backend serves the built frontend from `frontend/dist` when `NODE_ENV=production`.

## Project structure

```
ai-utils/
├── src/             # Entry point (index.ts)
├── config/          # Configuration
├── lib/             # Auth, logger, schemas, utilities
├── routes/          # API routes
├── models/          # Mongoose models
├── services/        # Business logic
├── langgraph/       # LangGraph workflows
├── sockets/         # Socket.io handlers
├── prompts/         # LLM prompts
├── middleware/      # Express middleware
├── repositories/    # Data access layer
├── interfaces/      # TypeScript interfaces
├── types/           # TypeScript types
├── enums/           # Enums
├── constants/       # Constants
├── utils/           # Utility functions
├── public/          # Static assets
├── tests/           # Test files
├── frontend/        # React (Vite) application
├── .env.example
└── README.md
```

## Features

- AI chat with **streaming** responses and conversation history
- MCP tool integration (connect via URL or command)
- Skills and prompt context
- Chat persistence: localStorage + **MongoDB** (chats sync to server when available)
- Rate limiting, Zod validation, structured logging
