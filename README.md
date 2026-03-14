# AI-Powered DevOps Incident Management System

A web-based incident management system built to help IT teams track and manage system issues efficiently. Instead of calling managers or sending emails when something breaks, engineers can just log the incident here and everyone stays updated in real time.

## What This Project Does

When something goes wrong in an IT environment like a server crash, network failure, or security issue, engineers need a way to report it quickly and make sure the right people are aware. This system solves that problem by giving teams a simple dashboard where incidents can be created, tracked, and resolved.

The interesting part is that the system uses a basic AI model to automatically predict how serious an incident is based on the words used in the description. So if someone types "server is down and website is not loading", the system will automatically mark it as Critical without the engineer having to decide that manually.

## Features

- Login system with JWT authentication
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

Make sure PostgreSQL is running and create a database called `incident_db` before starting the backend. Also create a `.env` file inside the backend folder with your database credentials.

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
- Add user roles like Admin, Manager and Engineer
