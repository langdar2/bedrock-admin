import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectSqlite3 from 'connect-sqlite3';
import authRoutes from './auth/routes.js';
import adminRoutes from './admin/routes.js';
import { redirectToSetupOrLogin } from './auth/middleware.js';
import { mkdirSync } from 'fs';

const SQLiteStore = connectSqlite3(session);
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const dbDir = process.env.DB_DIR || '/app/data';
mkdirSync(dbDir, { recursive: true });

app.set('trust proxy', 1);
app.use(express.json());

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: dbDir }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV !== 'development',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(authRoutes);
app.use(adminRoutes);
app.use(redirectToSetupOrLogin);
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Bedrock Admin running on :${PORT}`));
