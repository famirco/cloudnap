# Contributing to CloudNap 😴

Thank you for your interest in contributing to CloudNap! We welcome bug reports, feature suggestions, documentation updates, and pull requests.

This guide will help you set up your local development environment and understand the codebase.

---

## 🏗️ Architecture Overview

CloudNap is composed of two main components:
1. **FastAPI Backend (`/backend`)**: Serves the REST API, executes AWS API integration calls using `boto3`, and schedules continuous background state audits via `APScheduler`.
2. **React SPA Frontend (`/frontend`)**: Built with Vite and Vanilla CSS. Serves as a responsive cost-optimization management panel.

---

## ⚡ Quick Start: Local Development (Mock AWS Mode)

You do **not** need an AWS account or active credentials to contribute to CloudNap. We support a full **Mock AWS mode** that simulates active EC2/RDS instances and database transitions entirely in memory.

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/cloudnap.git
cd cloudnap
```

### Step 2: Configure Environment Variables
Copy the sample environment configuration:
```bash
cp backend/.env.example backend/.env
```
Inside `backend/.env`, ensure mock mode is enabled:
```env
MOCK_AWS=true
APP_PASSWORD=secret123
DATABASE_URL=sqlite:///./data/cloudnap.db
```

### Step 3: Run with Docker Compose (Easiest)
You can launch both the frontend and backend with one command:
```bash
docker compose up --build
```
Open `http://localhost:8000` in your browser. Authenticate using the `APP_PASSWORD` configured in your `.env`.

---

## 🛠️ Manual Development Setup

If you prefer to run the backend and frontend separately for hot-reloading:

### 1. Backend Setup (FastAPI)
1. Navigate to the backend directory and create a virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   PYTHONPATH=.. uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend Setup (React + Vite)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Run the hot-reloading Vite dev server:
   ```bash
   npm run dev
   ```
3. The dev server runs on `http://localhost:5173`. Make sure to configure the backend API proxy inside `vite.config.js` to point to the FastAPI port (`http://localhost:8000`).

---

## 🧪 Running Tests

Ensure your changes do not break existing logic. Run backend integration tests using `pytest`:
```bash
cd backend
pytest
```

---

## 🤝 Contribution Guidelines

1. **Check open issues**: Look for tags labeled `good first issue` or `help wanted`.
2. **Create a branch**: Use descriptive names like `feature/slack-alerts` or `bugfix/timezone-evaluation`.
3. **Format your code**: Ensure Python code follows standard linting and formatting.
4. **Write tests**: If you are adding a backend feature, please include corresponding test coverage.
5. **Submit a Pull Request (PR)**: Provide a clear description of the problem solved and links to any related issues.
