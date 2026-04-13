# Backend - Healthcare Hub API

Main Express.js server handling all backend operations for the Healthcare Hub application.

## Folder Structure

```
backend/
├── data/                   # Local data persistence
│   └── appointments.json   # Patient appointments (JSON file store)
├── utils/                  # Utility modules
│   ├── healthcare.js       # Healthcare engine (hospitals, services, pricing logic)
│   └── appointments-store.js  # Appointment persistence layer
├── server.js               # Main Express application with API routes
├── package.json            # Dependencies and scripts
└── .env.example            # Environment variables template
```

Database schema and SQL migrations now live in `../database/`.

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys:
  - `OLLAMA_BASE_URL` - Ollama server URL (default: `http://127.0.0.1:11434`)
  - `OLLAMA_MODEL` - Local model name (default: `llama3.2:1b`)
   - `PORT` - Server port (default: 5001)

  Also ensure Ollama is running locally:
  ```bash
  ollama pull llama3.2
  ollama run llama3.2
  ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   (Or `npm run dev` from project root to start both frontend and backend)

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Hospitals
- `GET /api/hospitals/nearby` - Search nearby hospitals
  - Query: `lat`, `lng`, `query` (optional), `filter` (optional)
  - Returns: List of hospitals with details

- `GET /api/hospitals/detail` - Get hospital details with enrichment
  - Query: `hospitalId`
  - Returns: Full hospital profile with specialties, doctors, services

### Services
- `GET /api/services/search` - Search available services
  - Query: `lat`, `lng`, `query`
  - Returns: List of available services with pricing

### Nearby Places
- `GET /api/places/nearby` - Get nearby cities/areas
  - Query: `lat`, `lng`
  - Returns: List of nearby place names

### Appointments
- `GET /api/appointments` - List patient appointments
  - Query: `userId`
  - Returns: All appointments for the user

- `POST /api/appointments` - Create new appointment
  - Body: `(hospitalId, serviceId, appointmentDate, timeSlot, patientName, userId)`
  - Returns: Confirmation with appointment ID

### AI Chat
- `POST /api/chat` - Chat with local Ollama model
  - Body: `{ message: string }`
  - Returns: AI response

## Key Features

### Healthcare Engine (`utils/healthcare.js`)
- **Hospital Search:** Retrieves hospitals from Overpass API or falls back to 134 synthetic hospitals
- **Service Pricing:** Estimates service costs based on hospital rating and service type
- **Detail Enrichment:** Builds comprehensive hospital profiles with specialties, doctors, services, facilities
- **Specialty Rules:** Derives specialties from hospital tags (cardiology, orthopedics, etc.)

### Appointment Management (`utils/appointments-store.js`)
- File-based persistent storage (`data/appointments.json`)
- Automatic appointment ID generation
- User-based appointment queries
- No database required (JSON-based)

## Environment Variables

```env
PORT=5001                          # Server port
NODE_ENV=development               # Environment (development/production)
OLLAMA_BASE_URL=http://127.0.0.1:11434  # Local Ollama server URL
OLLAMA_MODEL=llama3.2:1b           # Faster local model name
OVERPASS_URL=...                   # Optional: Custom Overpass API endpoint
```

## Technologies

- **Runtime:** Node.js
- **Framework:** Express.js 4.19
- **AI:** Ollama (local LLM)
- **Data:** JSON file storage (appointments)
- **External APIs:** Overpass, Nominatim

## Development

Start with root-level command:
```bash
cd .. && npm run dev
```

This starts both frontend (5173) and backend (5001) services concurrently.

## Notes

- Hospital data falls back to synthetic 134-hospital dataset if Overpass API fails
- Appointments persist to local JSON file (suitable for development/demo)
- Auth/profile management is handled by Supabase (frontend responsibility)
- All API responses include error handling and fallback data
