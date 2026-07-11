# Use python base image
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the backend requirements first
COPY backend/requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY backend/ /app/

# Expose port
EXPOSE 5000

# Start server using Gunicorn (reads $PORT dynamically for platforms like Render/GCP)
CMD sh -c "gunicorn --bind 0.0.0.0:${PORT:-5000} --timeout 300 --workers 1 --threads 2 --access-logfile - app:app"
