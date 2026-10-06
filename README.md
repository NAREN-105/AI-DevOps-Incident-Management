# AI-Powered DevOps Incident Management System
A web-based incident management system built to help IT teams track and manage system issues efficiently. Instead of calling managers or sending emails when something breaks, engineers can just log the incident here and everyone stays updated in real time.

## What This Project Does
When something goes wrong in an IT environment like a server crash, network failure, or security issue, engineers need a way to report it quickly and make sure the right people are aware. This system solves that problem by giving teams a simple dashboard where incidents can be created, tracked, and resolved.

The interesting part is that the system uses a basic AI model to automatically predict how serious an incident is based on the words used in the description. So if someone types "server is down and website is not loading", the system will automatically mark it as Critical without the engineer having to decide that manually.

## Features
- Role-based login and signup with JWT authentication
- Separate reporter, technician, manager, and administrator workspaces
- Automatic least-loaded technician assignment and incident activity history
- Optional Google sign-in and configurable SMTP notifications
- Create incidents with title and description
- AI automatically predicts severity as Critical, High, Medium or Low
- Dashboard with live charts showing incident distribution
- Update incident status from Open to In Progress to Resolved
- All incidents stored in PostgreSQL database
- Clean dark-themed UI built with React

## Tech Stack
- Frontend: React.js with Recharts for data visualization
- Backend: Python Flask with REST API
- Database: PostgreSQL
- Authentication: JWT tokens
- AI: Keyword-based severity prediction using scikit-learn logic


## How to Run Locally

**Backend:**
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**Frontend:**
```
cd frontend
npm install
npm start
```

Make sure PostgreSQL is running and create a database called `incident_db` before starting the backend. Copy `backend/.env.example` to `backend/.env` and set its database connection and secrets. Apply the workflow migration once from the `backend` folder:

```powershell
python -c "from pathlib import Path; import psycopg2; from config import Config; conn=psycopg2.connect(Config.DATABASE_URL); cur=conn.cursor(); cur.execute(Path('migrations/001_role_incident_workflow.sql').read_text()); conn.commit(); cur.close(); conn.close()"
```

New signups require a username, email, and a password of at least 12 characters. They start as reporters. An administrator can promote registered accounts to technician or manager in **Team accounts**. Public signup cannot create elevated roles.

### Demo Login Accounts

| Role | Username | Password |
| --- | --- | --- |
| User | `user` | `OpsUser!26-V7q3K` |
| Administrator | `admin` | `OpsAdmin!26-H8m4R` |

Choose the matching role on the login page. Users can create and view incidents; administrators can also change incident status. Use **Sign up** to create a regular user account; signup requires the configured PostgreSQL database and cannot create administrators. Passwords are stored as hashes. Demo credentials are for local development only. Before deployment, replace them with managed user accounts and set unique `SECRET_KEY` and `JWT_SECRET_KEY` values in the backend environment.

### Email and Google Sign-In

Email notifications are sent only after SMTP is configured in `backend/.env`. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; use your provider's app password. Add organization-wide recipients to `INCIDENT_MANAGER_EMAILS` as a comma-separated list. New incidents alert managers, assignments alert technicians, and status changes/resolution notify the reporter; resolution also alerts managers.

To enable Google sign-in, create a Google OAuth web client. Set its client ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `REACT_APP_GOOGLE_CLIENT_ID` in `frontend/.env.local`. Add `http://localhost:3001` (or the actual frontend origin) to the OAuth client's authorized JavaScript origins, then restart both apps. Google-created accounts receive the reporter role; administrators can promote them later.

Without provider credentials, Google sign-in and email delivery stay disabled; local username/password sign-in and the incident workflow remain available.



## How It Works
1. Engineer logs in with their credentials
2. They create a new incident by entering a title and description
3. The AI reads the description and predicts the severity automatically
4. The incident appears on the dashboard for the manager to see
5. The responsible team picks it up and starts working on it
6. Once fixed, the status is updated to Resolved
7. Manager can see everything on the dashboard including charts

## Why I Built This
I wanted to build something that actually solves a real problem. In most companies, incident reporting is still done through emails or phone calls which makes it hard to track what is happening and who is responsible. This project is a simplified version of tools like Jira and ServiceNow that big companies use every day.

## Future Improvements
- Email notifications when a critical incident is created
- Assign incidents to specific team members
- Add Docker support for easy deployment
- Improve AI model with real machine learning instead of keyword matching
