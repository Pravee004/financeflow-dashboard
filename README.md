# FinanceFlow Dashboard

A secure finance management system with role-based access control, transaction tracking, and real-time analytics.

## Tech Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Django + Django REST Framework
- **Auth:** JWT (djangorestframework-simplejwt)
- **Database:** SQLite

## Roles
| Role | Permissions |
|------|-------------|
| Admin | Manage users, view dashboard, full transaction access |
| Analyst | Add, edit, delete transactions |
| Viewer | View dashboard and transactions only |

## Setup — Backend
```bash
cd financeflow-Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "SECRET_KEY=your-secret-key" > .env
echo "DEBUG=True" >> .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Setup — Frontend
```bash
cd financeflow-Frontend
npm install
npm run dev
```

## API Endpoints
- `POST /api/auth/login` — Login
- `GET /api/summary` — Dashboard summary
- `GET/POST /api/transactions` — List and create transactions
- `PATCH/DELETE /api/transactions/:id` — Edit and delete
- `GET/POST /api/users` — User management (Admin only)
- `PATCH /api/users/:id` — Update user role/status (Admin only)
