# Document Translation App

MVP monorepo scaffold for a document translation application.

## Tech Stack

- **Frontend**: Next.js, Tailwind CSS
- **Backend**: FastAPI
- **Database**: PostgreSQL

## Project Structure

```
.
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── docker-compose.yml
└── README.md
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- Node.js 18+ and npm (for local development without Docker)

## Running with Docker Compose

1. Start all services:

   ```bash
   docker compose up --build
   ```

2. Access the application:

   - **Frontend**: http://localhost:3000
   - **Upload page**: http://localhost:3000/upload
   - **Documents list**: http://localhost:3000/documents
   - **Backend API**: http://localhost:8000
   - **API docs**: http://localhost:8000/docs

3. Stop services:

   ```bash
   docker compose down
   ```

## Running Locally (without Docker)

### Backend

1. Create and activate a virtual environment:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install dependencies and run:

   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

### Frontend

1. Install dependencies and run:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Open http://localhost:3000

### PostgreSQL

Use Docker for PostgreSQL only, or install it locally and create a `translation` database.

## Database Setup

Tables are created automatically on backend startup. For a clean start (e.g. after schema changes), run:

```bash
docker compose down -v
docker compose up --build
```

**Migrations for schema changes:** If you have an existing database:

- **Optional industry/domain and source_language:** Run:

```bash
docker compose exec postgres psql -U translation -d translation -c "
  ALTER TABLE documents ALTER COLUMN industry DROP NOT NULL;
  ALTER TABLE documents ALTER COLUMN domain DROP NOT NULL;
  ALTER TABLE documents ALTER COLUMN source_language DROP NOT NULL;
"
```

- **translation_provider column:** Run:

```bash
docker compose exec postgres psql -U translation -d translation -c "
  ALTER TABLE translation_jobs ADD COLUMN IF NOT EXISTS translation_provider VARCHAR(50);
  ALTER TABLE translation_jobs ADD COLUMN IF NOT EXISTS translation_batch_size INTEGER;
  ALTER TABLE translation_results ADD COLUMN IF NOT EXISTS ambiguity_detected BOOLEAN DEFAULT FALSE;
  ALTER TABLE translation_results ADD COLUMN IF NOT EXISTS ambiguity_details JSONB;
"
```

## Document Upload

- **Upload**: DOCX, TXT, or RTF files, max 10 MB
- **Metadata**: target language (required); source language (auto-detected); industry, domain (optional)
- Files are stored in `backend/uploads` (or `/app/uploads` in Docker)

## Document Parsing

- **Parse**: TXT split by blank lines; DOCX/RTF extract paragraph text
- **Segments**: Each non-empty paragraph becomes a segment with context
- **Endpoints**: `POST /api/documents/{id}/parse`, `GET /api/documents/{id}/segments`

## Translation Jobs

- **Create job**: For parsed documents with segments
- **Providers**: Mock (default) or OpenAI when `TRANSLATION_PROVIDER=openai` and `OPENAI_API_KEY` set
- **Batching**: Segments translated in batches (`TRANSLATION_BATCH_SIZE`, default 5)
- **Ambiguity detection** (OpenAI): Material ambiguities flagged with alternate suggestions
- **Endpoints**: `POST /api/documents/{id}/translation-jobs`, `GET /api/translation-jobs/{id}/results`
- Tables: `translation_jobs`, `translation_results` (created automatically on startup)

### OpenAI Translation

1. Create a `.env` file in the project root (copy from `.env.example`)
2. Set `OPENAI_API_KEY`, `TRANSLATION_PROVIDER=openai`, and optionally `TRANSLATION_BATCH_SIZE=5`
3. Run `docker compose up --build` (Compose reads `.env` automatically)

## License

MIT
