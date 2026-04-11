#!/bin/bash

# ClaimHeart Quick Start Script
# This script helps you start the ClaimHeart system quickly

set -e

echo "🚀 ClaimHeart Quick Start"
echo "========================="
echo ""

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Backend .env file not found!"
    echo "Creating from .env.example..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
    echo "⚠️  IMPORTANT: Edit backend/.env and add your Groq API keys!"
    echo ""
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "⚠️  Frontend .env.local file not found!"
    echo "Creating from .env.example..."
    cp frontend/.env.example frontend/.env.local
    echo "✅ Created frontend/.env.local"
    echo ""
fi

# Check for Groq API keys
if grep -q "gsk_placeholder" backend/.env; then
    echo "❌ ERROR: Groq API keys not configured!"
    echo ""
    echo "Please edit backend/.env and add your Groq API keys:"
    echo "  GROQ_API_KEY_1=gsk_your_actual_key_1"
    echo "  GROQ_API_KEY_2=gsk_your_actual_key_2"
    echo "  GROQ_API_KEY_3=gsk_your_actual_key_3"
    echo "  GROQ_API_KEY_4=gsk_your_actual_key_4"
    echo ""
    echo "Get API keys from: https://console.groq.com/"
    echo ""
    exit 1
fi

echo "✅ Configuration files found"
echo ""

# Ask user how they want to run
echo "How do you want to run ClaimHeart?"
echo "1) Docker Compose (Recommended - runs everything)"
echo "2) Local Development (Backend + Frontend separately)"
echo "3) Backend only"
echo "4) Frontend only"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "🐳 Starting with Docker Compose..."
        echo ""
        docker-compose up
        ;;
    2)
        echo ""
        echo "💻 Starting Local Development..."
        echo ""
        echo "Starting Backend..."
        cd backend
        pip install -r requirements.txt > /dev/null 2>&1 || true
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
        BACKEND_PID=$!
        cd ..
        
        echo "Starting Frontend..."
        cd frontend
        npm install > /dev/null 2>&1 || true
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        
        echo ""
        echo "✅ Services started!"
        echo "   Backend:  http://localhost:8000"
        echo "   Frontend: http://localhost:3000"
        echo "   API Docs: http://localhost:8000/docs"
        echo ""
        echo "Press Ctrl+C to stop all services"
        
        # Wait for Ctrl+C
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
        wait
        ;;
    3)
        echo ""
        echo "🔧 Starting Backend only..."
        echo ""
        cd backend
        pip install -r requirements.txt
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
        ;;
    4)
        echo ""
        echo "🎨 Starting Frontend only..."
        echo ""
        cd frontend
        npm install
        npm run dev
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
