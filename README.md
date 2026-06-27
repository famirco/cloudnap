# CloudNap 😴

An open-source, self-hosted AWS Instance Scheduler designed to run inside a single Docker container using Docker Compose. CloudNap helps you automatically schedule the shutdown and startup of AWS resources (EC2 and RDS) to optimize operations and cloud resource runtime.

---

## 🚀 Features

1. **Auto-Discovery**: Automatically scan and list EC2 and RDS instances across selected AWS regions.
2. **Date-Based Sleep Windows (Sleep Duration)**: Define date and time ranges (Turn OFF date to Turn ON date) where the resource must be stopped (sleeping). Outside of these ranges, the resource automatically runs.
3. **Resource Details Routing & Chronological View**: Clicking a resource card routes you to a dedicated detail page where all sleep schedules are displayed, sorted chronologically.
4. **Manual Controls & Holds**: Start or stop instances manually directly from the details view with a single click. The scheduler locks the state and pauses automated schedules until "Resume Schedule" is clicked.
5. **Operational Overview Dashboard**: Monitor your infrastructure at a glance with metrics showing Managed Resources, Scheduled Resources, Manual Holds, and Sleeping instances.
6. **Pure UTC Engine**: The calendar picker, time text fields, and scheduling backend run entirely on UTC. No local browser timezone conversions are applied.
7. **Conflict & Overlap Prevention**: The backend validates sleep windows on creation, rejecting overlapping date/time ranges.
8. **State-Based Self-Healing**: Scheduler ticks are range-based (every minute) rather than event-triggered, ensuring instances heal to their target state even after container restarts or host downtime.
9. **Mock Mode for Testing**: Run locally without any AWS credentials or active AWS resources by enabling `MOCK_AWS=true`.

---

## 🛠️ Tech Stack

*   **Backend**: Python (FastAPI) + `boto3` (AWS SDK) + `APScheduler`.
*   **Database**: SQLite (SQLAlchemy) for persistent resource mappings, sleep schedules, and manual overrides.
*   **Frontend**: React (Vite) + Tailwind CSS + Glassmorphism UI (Dark Mode), served statically by FastAPI.
*   **Containerization**: Docker & Docker Compose.

---

## 📂 Project Structure

```text
cloudnap/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI entrypoint & static file mounting
│   │   ├── config.py        # Settings & environment variables
│   │   ├── db.py            # SQLite database & self-healing migrations
│   │   ├── models.py        # Database models (Resource, ResourceSchedule, ResourceOverride)
│   │   ├── schemas.py       # Pydantic validation schemas
│   │   ├── aws.py           # Boto3 logic & Mock AWS implementation
│   │   ├── scheduler.py     # Background state-based check job (every minute)
│   │   └── routes/
│   │       ├── auth.py      # Basic/Local password authentication
│   │       └── instances.py # Endpoints for resource management and active windows
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Multi-stage build (React build + Python backend)
├── frontend/
│   ├── src/                 # React UI code (Components, Dashboards)
│   ├── package.json         # Node dependencies
│   ├── tailwind.config.js   # Custom Tailwind theme (Glassmorphism)
│   └── vite.config.js       # Vite configuration
├── docker-compose.yml       # Production-ready compose configuration
├── LICENSE                  # MIT License
└── README.md                # Documentation (this file)
```

---

## 🗺️ Execution Roadmap

### Step 1: Mock-Capable AWS Wrapper & Backend Setup
*   Create `backend/requirements.txt` with FastAPI, boto3, APScheduler, etc.
*   Implement `backend/app/aws.py` featuring Mock AWS implementation (`MOCK_AWS=true`) for developer testing.

### Step 2: Database Schema & Extensible Resource-Centric Models
*   Implement `backend/app/models.py` and `db.py` supporting self-healing migrations.
*   Link multiple `ResourceSchedule` date-based sleep windows to a single `Resource` model.

### Step 3: Background Scheduler Logic
*   Implement `backend/app/scheduler.py` using `APScheduler`.
*   Ticks every minute to evaluate target state (running vs stopped) based on active sleep windows.

### Step 4: FastAPI Router & REST API
*   Implement `backend/app/main.py` and endpoints in `backend/app/routes/`.
*   Provide routes to discover instances, apply overrides, and manage sleep windows.

### Step 5: Glassmorphism React Frontend (Resource Details Page)
*   Create Vite + React + Tailwind CSS project in `frontend/`.
*   Develop a sleek dark UI featuring a clean instances grid, details routing, chronological schedules sort, and direct manual holds.
*   Integrate a side-by-side Date Range Calendar Picker operating entirely on UTC.

### Step 6: Containerization & Deployment Setup
*   Write `Dockerfile` for unified delivery.
*   Write `docker-compose.yml` mounting SQLite database and exposing ports.

---

## 🔒 Required AWS IAM Permissions

If deploying to AWS (with `MOCK_AWS=false`), the IAM role running the container requires the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeRegions",
        "rds:DescribeDBInstances",
        "rds:StartDBInstance",
        "rds:StopDBInstance"
      ],
      "Resource": "*"
    }
  ]
}
```

