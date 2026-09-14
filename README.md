
# Road Watch — Pothole Detection & Reporting System

A system that detects potholes from photos, tags them with location, timestamp,
and severity, automatically identifies the responsible civic authority, sends
an automated report, and tracks each pothole's repair status on a dashboard.

## Approach

The system is split into three independent services:

1. **Detection service** (Python/FastAPI) — runs a pretrained YOLOv8 model to
   detect potholes in an uploaded image and returns bounding boxes, confidence
   scores, and a severity estimate derived from box size and confidence.
2. **Backend** (Node/Express) — receives an image + coordinates, forwards the
   image to the detection service, reverse-geocodes the coordinates to find
   the responsible civic authority, stores the record in Postgres, and sends
   an automated report.
3. **Frontend** (React + Vite) — a dashboard showing all reported potholes on
   a Leaflet map with severity-colored markers, a filterable ticket list, and
   status updates (Reported → Acknowledged → In Progress → Resolved).

## Architecture

```
[React Dashboard] ──HTTP──> [Node/Express Backend] ──HTTP──> [Python Detection Service (YOLOv8)]
                                    │
                                    ├──> [PostgreSQL (Supabase)]
                                    ├──> [Nominatim reverse geocoding]
                                    └──> [Automated email report]
```

## Libraries & Services Used

| Layer | Choice | Why |
|---|---|---|
| Detection model | YOLOv8 (Ultralytics), pretrained pothole-detection weights | Pretrained model avoids the time cost of training from scratch while still giving real bounding-box detections |
| Detection API | FastAPI | Lightweight Python service, easy to wrap a PyTorch model in an HTTP endpoint |
| Backend | Express, `pg`, `multer`, `axios`, `nodemailer` | Standard REST API stack; `multer` handles image uploads, `pg` talks to Postgres directly |
| Database | PostgreSQL (hosted on Supabase) | Pothole/authority/status-history data is inherently relational (foreign keys) |
| Geocoding | Nominatim (OpenStreetMap) | Free reverse-geocoding, no API key required |
| Maps | Leaflet + react-leaflet | No API key or billing account required, unlike Google Maps/Mapbox |
| Frontend | React (Vite) | Fast dev server, minimal config |

## How to Run

### Prerequisites
- Node.js and npm
- Python 3.9+ with `pip`
- A PostgreSQL database (this project used Supabase's free tier)

### 1. Detection service
```bash
cd detection-service
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn ultralytics python-multipart pillow
python -m uvicorn main:app --reload --port 8001
```

### 2. Database
Run the SQL in `docs/schema.sql` against your Postgres instance to create the
`authorities`, `potholes`, and `status_history` tables and seed sample
authority data.

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, SMTP credentials, etc.
node index.js
curl http://localhost:4000/authorities
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the printed local URL (typically `http://localhost:5173`).

### Testing the pipeline
```bash
curl -X POST http://localhost:4000/detections \
  -F "image=@sample_pothole.jpg" \
  -F "lat=18.5204" \
  -F "lng=73.8567"
```
Or use the "Report a pothole" form directly in the dashboard.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `DETECTION_SERVICE_URL` | URL of the running detection service (e.g. `http://localhost:8001/detect`) |
| `SMTP_USER` / `SMTP_PASS` | Gmail credentials (use an App Password, not your normal password) for sending automated report emails |

## Known Limitations & What I'd Improve With More Time

- **Video input isn't supported yet** — the detection service currently
  accepts single images only. Video support would mean extracting frames at
  a set interval and running the same detection endpoint on each frame.
- **Civic authority mapping is simplified.** Locations are matched to an
  authority via a small hardcoded pincode table (2 sample zones) rather than
  real MCD/PWD ward boundary data. In production this would use actual GIS
  ward polygons and a proper geofencing lookup.
- **Image storage is local**, not cloud storage (S3/R2/GCS). For a
  production deployment, uploaded images should go to object storage instead
  of the backend's local disk.
- **Severity estimation is heuristic** — based on detection confidence and
  bounding-box size relative to the image, not a model trained specifically
  for severity classification. A dedicated severity model would be more
  reliable.
- **No authentication** — the dashboard and API are open. A real deployment
  would need auth for both citizens submitting reports and civic staff
  managing statuses.

