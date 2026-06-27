# --- Stage 1: Build the React frontend SPA ---
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Copy package descriptors and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static assets
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Create python server and serve backend & frontend ---
FROM python:3.11-slim
WORKDIR /app

# Install system utilities (SQLite is built-in, build-essential for pip compiling if any)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-create data directory for persistent SQLite database
RUN mkdir -p /app/data

# Copy backend python code
COPY backend/ /app/backend/

# Copy React production build from Stage 1 into expected backend static paths
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

# Expose Uvicorn default port
EXPOSE 8000

# Set Python path to ensure module loading runs correctly
ENV PYTHONPATH=/app

# Start the application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
