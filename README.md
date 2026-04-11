# ClaimHeart - AI-Powered Medical Claims Processing

Multi-agent AI system for automated medical claims processing with fraud detection.

## 🚀 Quick Start (Localhost)

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your Groq API keys:
# GROQ_API_KEY_1=your_key_here
# GROQ_API_KEY_2=your_key_here
# GROQ_API_KEY_3=your_key_here
# GROQ_API_KEY_4=your_key_here

# Start backend server
uvicorn app.main:app --reload --port 8000
```

Backend will run at: http://localhost:8000

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend will run at: http://localhost:3000

### 3. Test the Multi-Agent Workflow

Open http://localhost:3000/demo

- Upload a medical document (image or PDF)
- Watch the complete agent pipeline process it
- See results from all agents in real-time

## 🤖 Multi-Agent Architecture

```
Document Upload
    ↓
Agent 01: Extractor (OCR + Entity Extraction)
    ↓
Agent A2: Policy (Compliance Check)
    ↓
Agent A3: Fraud (Risk Analysis)
    ↓
Router (R5/R3/R4) (Decision Routing)
    ↓
Agent 04: Mediator (Communication & Action)
```

## 📋 API Endpoints

- `POST /api/ocr/upload` - Upload document for processing
- `POST /api/ocr/process-local` - Process local file
- `POST /api/fraud/decision` - Fraud evaluation
- `POST /api/rag/patient-chat` - Query patient context
- `POST /api/rag/policy-chat` - Query policy
- `GET /api/health` - Health check

## 🔧 Configuration

### Backend (.env)
```env
# Groq API Keys (required)
GROQ_API_KEY_1=your_key_1
GROQ_API_KEY_2=your_key_2
GROQ_API_KEY_3=your_key_3
GROQ_API_KEY_4=your_key_4

# JWT (optional for demo)
JWT_SECRET_KEY=your_secret_key

# CORS
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📁 Project Structure

```
claimheart/
├── backend/
│   ├── app/
│   │   ├── agents/          # AI agents
│   │   │   ├── extractor/   # Agent 01
│   │   │   ├── policy/      # Agent A2
│   │   │   └── mediator/    # Agent 04
│   │   ├── api/routes/      # API endpoints
│   │   ├── services/        # Business logic
│   │   │   ├── fraud_service.py    # Agent A3
│   │   │   ├── decision_router.py  # Router
│   │   │   └── pipeline.py         # Orchestrator
│   │   └── core/
│   │       └── groq_client.py      # LLM client
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   └── demo/           # Demo page
│   ├── lib/
│   │   └── api/
│   │       └── backend.ts  # API client
│   └── package.json
└── README.md
```

## 🧪 Testing

### Test Backend
```bash
curl http://localhost:8000/api/health
```

### Test File Upload
```bash
curl -X POST http://localhost:8000/api/ocr/upload \
  -F "file=@/path/to/medical/document.pdf"
```

## 🎯 Features

- ✅ Multi-agent AI workflow
- ✅ OCR with entity extraction
- ✅ Policy compliance checking
- ✅ Fraud detection with risk scoring
- ✅ Intelligent decision routing
- ✅ Automated communication
- ✅ RAG-based context retrieval
- ✅ Groq LLM integration with load balancing
- ✅ Real-time pipeline visualization

## 📝 Notes

- **Authentication**: Firebase auth is commented out for demo. Mock auth is used.
- **Database**: Uses local SQLite and ChromaDB (no PostgreSQL required for demo)
- **Docker**: Removed for simplicity. Run directly on localhost.
- **LLM**: Uses Groq API (requires API keys)

## 🐛 Troubleshooting

**Backend won't start:**
- Check if port 8000 is available
- Verify Groq API keys in .env
- Install all requirements: `pip install -r requirements.txt`

**Frontend won't start:**
- Check if port 3000 is available
- Run `npm install` first
- Verify NEXT_PUBLIC_API_URL in .env.local

**Upload fails:**
- Check backend is running at http://localhost:8000
- Check file size (max 10MB)
- Check file type (PNG, JPG, PDF only)

## 📄 License

MIT License - see LICENSE file
