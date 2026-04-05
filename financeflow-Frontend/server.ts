import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'finance-dashboard-secret-key';

// Database Initialization
const db = new Database('finance.db');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'analyst', 'viewer')) NOT NULL,
    status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed Initial Data (if empty)
const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const analystPass = bcrypt.hashSync('analyst123', salt);
  const viewerPass = bcrypt.hashSync('viewer123', salt);

  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminPass, 'admin');
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('analyst', analystPass, 'analyst');
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('viewer', viewerPass, 'viewer');

  // Seed some transactions
  const transactions = [
    [5000, 'income', 'Salary', '2026-03-01', 'Monthly salary'],
    [150, 'expense', 'Food', '2026-03-02', 'Grocery shopping'],
    [1200, 'expense', 'Rent', '2026-03-05', 'Monthly rent'],
    [200, 'expense', 'Utilities', '2026-03-10', 'Electricity bill'],
    [300, 'income', 'Freelance', '2026-03-15', 'Logo design project'],
    [50, 'expense', 'Transport', '2026-03-20', 'Fuel'],
    [100, 'expense', 'Entertainment', '2026-03-25', 'Movie night'],
  ];

  const insertTx = db.prepare('INSERT INTO transactions (amount, type, category, date, description, user_id) VALUES (?, ?, ?, ?, ?, 1)');
  transactions.forEach(tx => insertTx.run(...tx));
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // --- Middleware ---

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid token.' });
      (req as any).user = user;
      next();
    });
  };

  const authorize = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!roles.includes((req as any).user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      next();
    };
  };

  // --- Auth Routes ---

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });

  // --- Transaction Routes ---

  app.get('/api/transactions', authenticateToken, (req, res) => {
    const { type, category, startDate, endDate } = req.query;
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  });

  app.post('/api/transactions', authenticateToken, authorize(['admin', 'analyst']), (req, res) => {
    const schema = z.object({
      amount: z.number().positive(),
      type: z.enum(['income', 'expense']),
      category: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().optional(),
    });

    try {
      const data = schema.parse(req.body);
      const result = db.prepare('INSERT INTO transactions (amount, type, category, date, description, user_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(data.amount, data.type, data.category, data.date, data.description || '', (req as any).user.id);
      
      const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(newTx);
    } catch (err) {
      res.status(400).json({ error: 'Invalid input data' });
    }
  });

  app.put('/api/transactions/:id', authenticateToken, authorize(['admin']), (req, res) => {
    const { id } = req.params;
    const { amount, type, category, date, description } = req.body;
    
    try {
      db.prepare('UPDATE transactions SET amount = ?, type = ?, category = ?, date = ?, description = ? WHERE id = ?')
        .run(amount, type, category, date, description, id);
      res.json({ message: 'Transaction updated successfully' });
    } catch (err) {
      res.status(400).json({ error: 'Update failed' });
    }
  });

  app.delete('/api/transactions/:id', authenticateToken, authorize(['admin']), (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    res.json({ message: 'Transaction deleted successfully' });
  });

  // --- Summary Routes ---

  app.get('/api/summary', authenticateToken, (req, res) => {
    const summary = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpenses
      FROM transactions
    `).get() as any;

    const categoryWise = db.prepare(`
      SELECT category, SUM(amount) as total, type
      FROM transactions
      GROUP BY category, type
    `).all();

    const recentActivity = db.prepare(`
      SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5
    `).all();

    res.json({
      totalIncome: summary.totalIncome || 0,
      totalExpenses: summary.totalExpenses || 0,
      netBalance: (summary.totalIncome || 0) - (summary.totalExpenses || 0),
      categoryWise,
      recentActivity
    });
  });

  // --- User Management (Admin Only) ---

  app.get('/api/users', authenticateToken, authorize(['admin']), (req, res) => {
    const users = db.prepare('SELECT id, username, role, status, created_at FROM users').all();
    res.json(users);
  });

  app.patch('/api/users/:id/status', authenticateToken, authorize(['admin']), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    res.json({ message: 'User status updated' });
  });

  // --- Vite Setup ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
