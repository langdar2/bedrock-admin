import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || '/app/data/admin.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    recovery_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    device_type TEXT,
    backed_up INTEGER DEFAULT 0,
    transports TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    token TEXT PRIMARY KEY,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    used INTEGER DEFAULT 0
  );
`);

export function hasUsers() {
  return db.prepare('SELECT COUNT(*) as count FROM users').get().count > 0;
}

export function createUser(id, username, recoveryHash) {
  db.prepare('INSERT INTO users (id, username, recovery_hash) VALUES (?, ?, ?)').run(id, username, recoveryHash);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUsers() {
  return db.prepare('SELECT id, username, created_at FROM users').all();
}

export function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function saveCredential(credentialId, userId, publicKey, counter, deviceType, backedUp, transports) {
  db.prepare(
    'INSERT INTO credentials (credential_id, user_id, public_key, counter, device_type, backed_up, transports) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(credentialId, userId, publicKey, counter, deviceType, backedUp ? 1 : 0, JSON.stringify(transports || []));
}

export function getCredentialsByUserId(userId) {
  return db.prepare('SELECT * FROM credentials WHERE user_id = ?').all(userId).map(c => ({
    ...c,
    backed_up: !!c.backed_up,
    transports: JSON.parse(c.transports || '[]'),
  }));
}

export function getCredentialById(credentialId) {
  const c = db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(credentialId);
  if (!c) return null;
  return { ...c, backed_up: !!c.backed_up, transports: JSON.parse(c.transports || '[]') };
}

export function getAllCredentials() {
  return db.prepare('SELECT * FROM credentials').all().map(c => ({
    ...c,
    backed_up: !!c.backed_up,
    transports: JSON.parse(c.transports || '[]'),
  }));
}

export function updateCredentialCounter(credentialId, newCounter) {
  db.prepare('UPDATE credentials SET counter = ? WHERE credential_id = ?').run(newCounter, credentialId);
}

export function createInvite(token, createdBy) {
  db.prepare('INSERT INTO invites (token, created_by) VALUES (?, ?)').run(token, createdBy);
}

export function getInvite(token) {
  return db.prepare('SELECT * FROM invites WHERE token = ? AND used = 0').get(token);
}

export function markInviteUsed(token) {
  db.prepare('UPDATE invites SET used = 1 WHERE token = ?').run(token);
}

export function updateRecoveryHash(userId, hash) {
  db.prepare('UPDATE users SET recovery_hash = ? WHERE id = ?').run(hash, userId);
}

export default db;
