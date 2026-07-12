'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'stardance.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  city TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','juez','profesor')),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  club_id INTEGER REFERENCES clubs(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dni TEXT,
  birth_date TEXT,
  gender TEXT,
  club_id INTEGER REFERENCES clubs(id),
  level TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  label TEXT,
  filename TEXT NOT NULL,
  original_name TEXT,
  size INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT,
  location TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','publicado','cerrado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  age_min INTEGER,
  age_max INTEGER,
  gender TEXT,
  schedule TEXT
);

CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professor_id INTEGER NOT NULL REFERENCES users(id),
  paid INTEGER NOT NULL DEFAULT 0,
  payment_note TEXT,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (category_id, student_id)
);

CREATE TABLE IF NOT EXISTS judge_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  full_name TEXT NOT NULL,
  specialty TEXT,
  bio TEXT,
  photo TEXT,
  visible INTEGER NOT NULL DEFAULT 1
);
`);

module.exports = db;
