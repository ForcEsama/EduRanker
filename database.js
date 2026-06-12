/* ============================================================
   EduRanker — Database Module (MySQL)
   database.js — Schema, Seed Data, Query Helpers
   ============================================================ */

const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eduranker',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ─── Initialize ──────────────────────────────────────────────
async function initDatabase() {
  let connection;
  try {
    // Attempt to connect directly to the database (Cloud DBs like Aiven/CleverCloud usually pre-create the DB)
    connection = await mysql.createConnection({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
      port: DB_CONFIG.port,
      ssl: DB_CONFIG.ssl
    });
  } catch (err) {
    // If database doesn't exist (e.g. local XAMPP first run), connect without DB and create it
    if (err.code === 'ER_BAD_DB_ERROR') {
      connection = await mysql.createConnection({
        host: DB_CONFIG.host,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        port: DB_CONFIG.port,
        ssl: DB_CONFIG.ssl
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\``);
      await connection.changeUser({ database: DB_CONFIG.database });
    } else {
      throw err;
    }
  }

  try {

    // Create Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Added class_name column to students
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        class_name VARCHAR(50) NOT NULL DEFAULT '10-A',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Self-healing migration for existing databases
    try {
      await connection.query("ALTER TABLE students ADD COLUMN class_name VARCHAR(50) NOT NULL DEFAULT '10-A'");
      console.log('   ✓ Added class_name column to students table');
    } catch (err) {
      // Ignore if duplicate column name error (1060 or ER_DUP_FIELDNAME)
      if (err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Migration error:', err);
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject VARCHAR(50) NOT NULL,
        score INT NOT NULL,
        UNIQUE KEY student_subject (student_id, subject),
        CONSTRAINT fk_scores_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed default users
    const [userRows] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (userRows[0].count === 0) {
      console.log('📦 Seeding database with default users...');
      const bcrypt = require('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      
      await connection.query(
        'INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)',
        ['admin', bcrypt.hashSync('admin123', salt), 'Administrator', 'admin']
      );

      await connection.query(
        'INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)',
        ['user', bcrypt.hashSync('user123', salt), 'User Viewer', 'user']
      );
      console.log('   ✓ 2 users created (admin, user)');
    }

    // Seed demo students with classes
    const [studentRows] = await connection.query('SELECT COUNT(*) as count FROM students');
    if (studentRows[0].count === 0) {
      console.log('📦 Seeding database with demo students...');
      const demoStudents = [
        { name: 'Andi Pratama', class_name: '10-A', subjects: { 'Matematika': 92, 'B. Indonesia': 88, 'B. Inggris': 85, 'IPA': 90, 'IPS': 87 } },
        { name: 'Budi Santoso', class_name: '10-A', subjects: { 'Matematika': 75, 'B. Indonesia': 80, 'B. Inggris': 70, 'IPA': 68, 'IPS': 72 } },
        { name: 'Citra Dewi', class_name: '10-B', subjects: { 'Matematika': 60, 'B. Indonesia': 65, 'B. Inggris': 58, 'IPA': 62 } },
        { name: 'Dina Fitriani', class_name: '10-B', subjects: { 'Matematika': 45, 'B. Indonesia': 50, 'IPS': 48 } },
        { name: 'Eko Setiawan', class_name: '10-A', subjects: { 'Matematika': 88, 'B. Indonesia': 92, 'B. Inggris': 90, 'IPA': 85, 'IPS': 89 } },
      ];

      for (const demo of demoStudents) {
        const [res] = await connection.query('INSERT INTO students (name, class_name) VALUES (?, ?)', [demo.name, demo.class_name]);
        const studentId = res.insertId;
        for (const [subject, score] of Object.entries(demo.subjects)) {
          await connection.query(
            'INSERT INTO scores (student_id, subject, score) VALUES (?, ?, ?)',
            [studentId, subject, parseInt(score, 10)]
          );
        }
      }
      console.log('   ✓ 5 demo students created');
    }

    console.log('✅ MySQL Database initialized & verified');
  } catch (err) {
    console.error('Error initializing MySQL database:', err);
    throw err; // Propagate up to server.js
  } finally {
    await connection.end();
  }
}

// ─── User Queries ────────────────────────────────────────────
async function findUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.query('SELECT id, username, display_name, role FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

// ─── Student Queries ─────────────────────────────────────────
async function getAllStudents() {
  const [students] = await pool.query('SELECT * FROM students ORDER BY id');
  const [scores] = await pool.query('SELECT * FROM scores ORDER BY student_id');

  const scoreMap = {};
  for (const s of scores) {
    if (!scoreMap[s.student_id]) {
      scoreMap[s.student_id] = {};
    }
    scoreMap[s.student_id][s.subject] = s.score;
  }

  return students.map(st => ({
    id: st.id,
    name: st.name,
    class_name: st.class_name, // Map class_name field
    subjects: scoreMap[st.id] || {}
  }));
}

async function addStudentDb(name, subjects, className = '10-A') {
  const [res] = await pool.query('INSERT INTO students (name, class_name) VALUES (?, ?)', [name, className]);
  const studentId = res.insertId;

  for (const [subject, score] of Object.entries(subjects)) {
    if (score !== null && score !== undefined && score !== '') {
      await pool.query(
        'INSERT INTO scores (student_id, subject, score) VALUES (?, ?, ?)',
        [studentId, subject, parseInt(score, 10)]
      );
    }
  }

  return studentId;
}

async function updateStudentDb(id, name, subjects, className = '10-A') {
  await pool.query('UPDATE students SET name = ?, class_name = ? WHERE id = ?', [name, className, id]);
  await pool.query('DELETE FROM scores WHERE student_id = ?', [id]);

  for (const [subject, score] of Object.entries(subjects)) {
    if (score !== null && score !== undefined && score !== '') {
      await pool.query(
        'INSERT INTO scores (student_id, subject, score) VALUES (?, ?, ?)',
        [id, subject, parseInt(score, 10)]
      );
    }
  }
}

async function deleteStudentDb(id) {
  await pool.query('DELETE FROM scores WHERE student_id = ?', [id]);
  await pool.query('DELETE FROM students WHERE id = ?', [id]);
}

async function deleteAllStudentsDb() {
  await pool.query('DELETE FROM scores');
  await pool.query('DELETE FROM students');
  await pool.query('ALTER TABLE scores AUTO_INCREMENT = 1');
  await pool.query('ALTER TABLE students AUTO_INCREMENT = 1');
}

async function bulkAddStudentsDb(studentsArray) {
  const results = [];

  for (const st of studentsArray) {
    const className = st.class_name || st.className || '10-A';
    const [res] = await pool.query('INSERT INTO students (name, class_name) VALUES (?, ?)', [st.name, className]);
    const studentId = res.insertId;

    for (const [subject, score] of Object.entries(st.subjects || {})) {
      if (score !== null && score !== undefined && score !== '') {
        await pool.query(
          'INSERT INTO scores (student_id, subject, score) VALUES (?, ?, ?)',
          [studentId, subject, parseInt(score, 10)]
        );
      }
    }
    results.push(studentId);
  }

  return results;
}

// ─── User Profile & Password Updates ─────────────────────────
async function updateUserProfile(id, displayName) {
  await pool.query('UPDATE users SET display_name = ? WHERE id = ?', [displayName, id]);
}

async function updateUserPassword(id, hashedPassword) {
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
}

async function getUserPassword(id) {
  const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [id]);
  return rows[0] ? rows[0].password : null;
}

module.exports = {
  initDatabase,
  findUserByUsername,
  findUserById,
  getAllStudents,
  addStudentDb,
  updateStudentDb,
  deleteStudentDb,
  deleteAllStudentsDb,
  bulkAddStudentsDb,
  updateUserProfile,
  updateUserPassword,
  getUserPassword,
};

