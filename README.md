## Team - ClaimHeart

1. Sandeep Prajapati
2. Sachin Manral
3. Simran Kukreja
4. Vaibhav Yadav


---

# ClaimHeart - AI-Powered Medical Claims Processing System

## 🎉 Phase 8 Implementation Complete!

ClaimHeart is a production-ready AI-powered medical claims processing system with fraud detection, policy validation, and automated decision-making.

## 🚀 Quick Start

```bash
# 1. Add Groq API keys to backend/.env
# 2. Run the system
./start.sh

# Or with Docker
docker-compose up
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## ✨ Key Features

- 🤖 **Groq LLM Integration** - Load-balanced across 4 API keys
- 🔐 **JWT Authentication** - Secure role-based access control
- 📄 **OCR Processing** - Extract data from medical documents
- 🚨 **Fraud Detection** - Multi-layered fraud analysis
- 📚 **RAG System** - Policy query system
- 🔄 **Complete Pipeline** - OCR → Policy → Fraud → Decision
- 🐳 **Docker Ready** - Full stack orchestration

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Complete setup instructions |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Testing procedures |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Quick reference card |
| [FINAL_SUMMARY.md](FINAL_SUMMARY.md) | Complete implementation summary |

## 🏗️ Architecture

```
Frontend (Next.js) → Backend (FastAPI) → PostgreSQL + Redis + ChromaDB + Groq API
```

## 🔧 Configuration Required

1. **Groq API Keys** (Get from https://console.groq.com/)
   ```env
   # backend/.env
   GROQ_API_KEY_1=gsk_your_key_1
   GROQ_API_KEY_2=gsk_your_key_2
   GROQ_API_KEY_3=gsk_your_key_3
   GROQ_API_KEY_4=gsk_your_key_4
   ```

2. **Backend URL**
   ```env
   # frontend/.env.local
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

## 🧪 Quick Test

```bash
# Health check
curl http://localhost:8000/api/health

# Upload document
curl -X POST http://localhost:8000/api/ocr/upload -F "file=@document.pdf"
```

## 📊 Tech Stack

- **Backend**: FastAPI, Python 3.11, PostgreSQL, Redis, ChromaDB, Groq LLM
- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS
- **Infrastructure**: Docker, Prometheus, Grafana

## 🎯 Phase 8 Deliverables

✅ Groq LLM integration with load balancing  
✅ JWT authentication middleware  
✅ OCR → Fraud pipeline connectivity  
✅ Frontend-backend integration  
✅ Docker orchestration  
✅ Complete documentation  

**See [FINAL_SUMMARY.md](FINAL_SUMMARY.md) for complete details.**

---

**Built with ❤️ for efficient medical claims processing**
