/* ============================================================
   EduRanker — Express Server
   server.js — API Endpoints, Auth, Session Management
   ============================================================ */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const {
  initDatabase,
  findUserByUsername,
  findUserById,
  getAllStudents,
  addStudentDb,
  updateStudentDb,
  deleteStudentDb,
  deleteAllStudentsDb,
  bulkAddStudentsDb,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

let isDbConnected = false;

// Middleware to check database status for API requests
app.use((req, res, next) => {
  const allowedPaths = ['/login.html', '/style.css', '/app.js', '/api/me', '/api/login', '/api/logout'];
  if (req.path.startsWith('/api/') && !allowedPaths.includes(req.path) && !isDbConnected) {
    return res.status(503).json({ 
      error: 'Koneksi ke database gagal. Pastikan Apache & MySQL di XAMPP sudah diaktifkan.' 
    });
  }
  next();
});

app.use(session({
  secret: 'eduranker-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ─────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Anda belum login.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Anda belum login.' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang bisa melakukan ini.' });
  }
  next();
}

// ─── Auth Routes ─────────────────────────────────────────────

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password harus diisi.' });
  }

  try {
    const user = await findUserByUsername(username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.role = user.role;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal logout.' });
    }
    res.json({ success: true });
  });
});

// GET /api/me — check current auth status
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Belum login.' });
  }

  try {
    const user = await findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User tidak ditemukan.' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// ─── Student Routes ──────────────────────────────────────────

// GET /api/students — all users can read
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const students = await getAllStudents();
    res.json({ students });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Gagal mengambil data siswa.' });
  }
});

// POST /api/students — admin only
app.post('/api/students', requireAdmin, async (req, res) => {
  try {
    const { name, subjects, class_name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama siswa harus diisi.' });
    }

    if (subjects) {
      for (const [sub, score] of Object.entries(subjects)) {
        const scoreVal = parseInt(score, 10);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          return res.status(400).json({ error: `Nilai mata pelajaran ${sub} harus berupa angka 0-100.` });
        }
      }
    }

    const cleanedClass = class_name && typeof class_name === 'string' ? class_name.trim() : '10-A';
    if (!cleanedClass) {
      return res.status(400).json({ error: 'Kelas harus diisi.' });
    }

    const studentId = await addStudentDb(name.trim(), subjects || {}, cleanedClass);
    res.json({ success: true, id: studentId });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: 'Gagal menambahkan siswa.' });
  }
});

// PUT /api/students/:id — admin only
app.put('/api/students/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, subjects, class_name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama siswa harus diisi.' });
    }

    if (subjects) {
      for (const [sub, score] of Object.entries(subjects)) {
        const scoreVal = parseInt(score, 10);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          return res.status(400).json({ error: `Nilai mata pelajaran ${sub} harus berupa angka 0-100.` });
        }
      }
    }

    const cleanedClass = class_name && typeof class_name === 'string' ? class_name.trim() : '10-A';
    if (!cleanedClass) {
      return res.status(400).json({ error: 'Kelas harus diisi.' });
    }

    await updateStudentDb(id, name.trim(), subjects || {}, cleanedClass);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Gagal memperbarui data siswa.' });
  }
});

// DELETE /api/students/:id — admin only
app.delete('/api/students/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await deleteStudentDb(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Gagal menghapus siswa.' });
  }
});

// DELETE /api/students — delete all, admin only
app.delete('/api/students', requireAdmin, async (req, res) => {
  try {
    await deleteAllStudentsDb();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting all students:', err);
    res.status(500).json({ error: 'Gagal menghapus semua siswa.' });
  }
});

// POST /api/students/bulk — bulk add (CSV import), admin only
app.post('/api/students/bulk', requireAdmin, async (req, res) => {
  try {
    const { students, replaceAll } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Data siswa kosong.' });
    }

    if (replaceAll) {
      await deleteAllStudentsDb();
    }

    const ids = await bulkAddStudentsDb(students);
    res.json({ success: true, imported: ids.length });
  } catch (err) {
    console.error('Error bulk adding students:', err);
    res.status(500).json({ error: 'Gagal mengimport data siswa.' });
  }
});

// ─── Page Routes ─────────────────────────────────────────────

// Redirect root to login if not authenticated
app.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  res.redirect('/index.html');
});

// ─── Initialize & Start ──────────────────────────────────────
async function startServer() {
  try {
    await initDatabase();
    isDbConnected = true;
  } catch (err) {
    console.warn('\n⚠️ WARNING: Database MySQL tidak terdeteksi atau mati.');
    console.warn('   Silakan nyalakan Apache dan MySQL di XAMPP Control Panel Anda.');
    console.warn('   Aplikasi akan berjalan dalam mode offline/terbatas.\n');
    isDbConnected = false;
  }

  app.listen(PORT, () => {
    console.log(`\n🎓 EduRanker Server running at http://localhost:${PORT}`);
    console.log(`   Login: http://localhost:${PORT}/login.html`);
    console.log(`   Default accounts: admin/admin123, user/user123\n`);
  });
}

startServer();
