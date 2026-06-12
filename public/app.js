/* ============================================================
   EduRanker — Counting Sort Report Card Ranking System
   app.js — Core Logic, Algorithm & Interactivity
   ============================================================ */

"use strict";

// ─── Configuration ────────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  'Matematika',
  'B. Indonesia',
  'B. Inggris',
  'IPA',
  'IPS',
];

const SUBJECT_ABBREVS = {
  'Matematika': 'Mtk',
  'B. Indonesia': 'B.Ind',
  'B. Inggris': 'B.Ing',
  'IPA': 'IPA',
  'IPS': 'IPS',
};

function abbrevSubject(name) {
  return SUBJECT_ABBREVS[name] || name.split(/[\s.]+/)[0].substring(0, 5);
}

// ─── Data Store ──────────────────────────────────────────────
const store = {
  subjects: [...DEFAULT_SUBJECTS],
  students: [],
  sorted: [],
  steps: [],
  currentStep: -1,
  nextId: 1,
  activityLogs: [],
  currentClassFilter: 'all',
};

let currentUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    currentUser = data.user;
    
    // Set UI elements based on role
    document.body.className = `role-${currentUser.role}`;
    
    // Display user details in sidebar
    const displayNameEl = document.getElementById('sidebar-display-name');
    if (displayNameEl) displayNameEl.textContent = currentUser.display_name;
    
    const roleBadgeEl = document.getElementById('sidebar-role-badge');
    if (roleBadgeEl) {
      roleBadgeEl.textContent = currentUser.role === 'admin' ? 'Admin' : 'Siswa/Guru';
      roleBadgeEl.className = `sidebar-role-badge ${currentUser.role}`;
    }
    
    // Init avatar info
    const sidebarAvatarEl = document.getElementById('sidebar-avatar');
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = getInitials(currentUser.display_name);

    const topbarAvatarEl = document.getElementById('topbar-avatar');
    if (topbarAvatarEl) topbarAvatarEl.textContent = getInitials(currentUser.display_name);

  } catch (err) {
    console.error('Auth check error:', err);
    window.location.href = '/login.html';
  }
}

const logoutConfirmModal = document.getElementById('logout-confirm-modal');

function openLogoutModal() {
  if (logoutConfirmModal) {
    logoutConfirmModal.classList.add('show');
  }
}

function closeLogoutModal() {
  if (logoutConfirmModal) {
    logoutConfirmModal.classList.remove('show');
  }
}

async function executeLogout() {
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) {
      window.location.href = '/login.html';
    } else {
      showToast('Gagal logout.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat logout.', 'error');
  }
}

async function loadStudents() {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    store.students = data.students.map(s => {
      const average = calcAverage(s.subjects);
      return {
        id: s.id,
        name: s.name,
        class_name: s.class_name || '10-A',
        subjects: s.subjects,
        average,
        sortKey: calcSortKey(average)
      };
    });
    // Set nextId based on max ID
    if (store.students.length > 0) {
      store.nextId = Math.max(...store.students.map(s => s.id)) + 1;
    } else {
      store.nextId = 1;
    }
    // Automatically sort the data on load
    runSort();
  } catch (err) {
    console.error('Error loading students:', err);
    showToast('Gagal memuat data dari database.', 'error');
  }
}

// ─── Sample Names ─────────────────────────────────────────────
const SAMPLE_NAMES = [
  "Andi Pratama", "Budi Santoso", "Citra Dewi", "Dina Fitriani", "Eko Setiawan",
  "Fajar Nugroho", "Galih Wicaksono", "Hani Rahmawati", "Irfan Maulana", "Joko Susilo",
  "Karin Puspita", "Lina Saraswati", "Miko Hartono", "Nadia Permata", "Oscar Fernandez",
  "Putri Anggraeni", "Qori Yusuf", "Reza Hakim", "Siti Nurhaliza", "Tono Wijaya",
  "Ulfa Maharani", "Vino Saputra", "Winda Kusuma", "Xena Pratiwi", "Yogi Firmansyah",
  "Zara Anindita", "Agung Santoso", "Bella Kurnia", "Cahyo Wibowo", "Desi Ratnasari",
  "Erik Yulianto", "Fitra Ramadan", "Gita Nuraini", "Hendra Gunawan", "Intan Lestari",
  "Javier Christanto", "Kiki Amelia", "Leo Prasetyo", "Maya Sari", "Nando Putra",
  "Olive Simatupang", "Panca Wirahadi", "Queen Nabila", "Rafli Iskandar", "Sari Melati",
  "Teguh Prasetya", "Utami Rahayu", "Victor Halim", "Wulandari Putri", "Yuda Permana",
];

// ─── Utility ─────────────────────────────────────────────────
function uid() { return store.nextId++; }

function randomScore() {
  const r = Math.random();
  if (r < 0.05) return Math.floor(Math.random() * 30);
  if (r < 0.15) return 30 + Math.floor(Math.random() * 25);
  if (r < 0.45) return 55 + Math.floor(Math.random() * 30);
  if (r < 0.80) return 70 + Math.floor(Math.random() * 20);
  return 85 + Math.floor(Math.random() * 16);
}

function randomName(existingNames) {
  const pool = SAMPLE_NAMES.filter(n => !existingNames.has(n));
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  let suffix = store.nextId;
  while (existingNames.has(`Siswa ${suffix}`)) suffix++;
  return `Siswa ${suffix}`;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatStudentId(id) {
  return `ER-2024-${String(id).padStart(3, '0')}`;
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const icon = toast.querySelector('.material-symbols-outlined');

  msgEl.textContent = msg;
  toast.className = `toast show ${type}`;
  icon.textContent = type === 'error' ? 'error' : 'check_circle';

  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// ─── Activity Log ────────────────────────────────────────────
function addLog(title, sub, dotColor = 'green') {
  store.activityLogs.unshift({ title, sub, dotColor, time: new Date() });
  if (store.activityLogs.length > 5) store.activityLogs.pop();
  renderActivityLogs();
}

function renderActivityLogs() {
  const ul = document.getElementById('activity-logs');
  if (!ul) return;
  ul.innerHTML = store.activityLogs.map(log => `
    <li>
      <div class="log-dot ${log.dotColor}"></div>
      <div>
        <p class="log-title">${escHtml(log.title)}</p>
        <p class="log-sub">${escHtml(log.sub)}</p>
      </div>
    </li>
  `).join('');
}

// ─── Average & Sort Key ───────────────────────────────────────
function calcAverage(subjectScores) {
  const filled = Object.values(subjectScores)
    .filter(v => v !== null && v !== undefined && v !== '');
  if (filled.length === 0) return 0;
  const total = filled.reduce((s, v) => s + Number(v), 0);
  return Math.round((total / filled.length) * 10) / 10;
}

function calcSortKey(average) {
  return Math.round(average * 10);
}

function gradeOf(avg) {
  if (avg >= 90) return 'A';
  if (avg >= 80) return 'B';
  if (avg >= 70) return 'C';
  return 'D';
}

function isPass(avg) {
  return avg >= 55;
}

// ─── Student Management ───────────────────────────────────────
function addStudent(name, subjectScores) {
  const average = calcAverage(subjectScores);
  const sortKey = calcSortKey(average);
  const student = {
    id: uid(),
    name: name.trim(),
    subjects: { ...subjectScores },
    average,
    sortKey,
  };
  store.students.push(student);
  store.steps = [];
  store.sorted = [];
  store.currentStep = -1;
  return student;
}

function removeStudent(id) {
  store.students = store.students.filter(s => s.id !== id);
  store.steps = [];
  store.sorted = [];
  store.currentStep = -1;
}

function clearAllStudents() {
  store.students = [];
  store.sorted = [];
  store.steps = [];
  store.currentStep = -1;
  store.nextId = 1;
}

// ─── Counting Sort Algorithm ──────────────────────────────────
function countingSort(students) {
  const MAX = 1000;
  const steps = [];
  const count = new Array(MAX + 1).fill(0);

  steps.push({
    phase: 'init',
    title: '1. Inisialisasi Count Array',
    desc: `Buat count[0..${MAX}] diisi 0. Ukuran ${MAX + 1} merepresentasikan rata-rata 0.0–100.0 (dikali 10).`,
    countArr: [...count],
    activeStudentId: null,
    activeKey: null,
  });

  const n = students.length;
  const isDetailed = n <= 10;
  const countProgressInterval = isDetailed ? 1 : Math.ceil(n / 5);

  let currentCount = [...count];
  students.forEach((s, idx) => {
    currentCount[s.sortKey]++;
    if (isDetailed || (idx + 1) % countProgressInterval === 0 || idx === n - 1) {
      const pct = Math.round(((idx + 1) / n) * 100);
      steps.push({
        phase: 'count',
        title: `2. Hitung Frekuensi (${pct}%)`,
        desc: isDetailed
          ? `Menghitung ${s.name}: Avg ${s.average.toFixed(1)} (key ${s.sortKey}) → count[${s.sortKey}] = ${currentCount[s.sortKey]}`
          : `Memproses siswa ke-${idx + 1} dari ${n} (${pct}%).`,
        countArr: [...currentCount],
        activeStudentId: s.id,
        activeKey: s.sortKey,
      });
    }
  });

  // Calculate Cumulative Sum
  let cumArr = [...currentCount];
  let sum = 0;
  for (let i = 0; i <= MAX; i++) {
    sum += currentCount[i];
    cumArr[i] = sum;
  }

  steps.push({
    phase: 'cumulative',
    title: '3. Hitung Cumulative Count',
    desc: 'Jumlahkan count untuk menentukan posisi akhir di array output.',
    countArr: [...cumArr],
    activeStudentId: null,
    activeKey: null,
  });

  const byKey = {};
  for (const s of students) {
    if (!byKey[s.sortKey]) byKey[s.sortKey] = [];
    byKey[s.sortKey].push(s);
  }

  const sorted = [];
  let remainingCount = [...cumArr];
  const outputProgressInterval = isDetailed ? 1 : Math.ceil(n / 5);
  let placedCount = 0;

  for (let key = MAX; key >= 0; key--) {
    if (byKey[key]) {
      for (const s of byKey[key]) {
        sorted.push(s);
        remainingCount[key]--;
        placedCount++;
        if (isDetailed || placedCount % outputProgressInterval === 0 || placedCount === n) {
          const pct = Math.round((placedCount / n) * 100);
          steps.push({
            phase: 'output',
            title: `4. Bangun Output Descending (${pct}%)`,
            desc: isDetailed
              ? `Masukkan ${s.name} (Avg ${s.average.toFixed(1)}) ke peringkat. Sisa count[${key}] = ${remainingCount[key]}`
              : `Menyusun peringkat: ${placedCount}/${n} siswa ditempatkan (${pct}%).`,
            countArr: [...remainingCount],
            activeStudentId: s.id,
            activeKey: key,
          });
        }
      }
    }
  }

  steps.push({
    phase: 'done',
    title: '5. Selesai ✓',
    desc: `Counting Sort selesai! ${n} siswa diurutkan. Kompleksitas: O(n+k) = O(${n}+${MAX + 1}).`,
    countArr: [...remainingCount],
    activeStudentId: null,
    activeKey: null,
  });

  return { sorted, steps, countArr: currentCount };
}

// ─── Navigation ───────────────────────────────────────────────
const subtitles = {
  dashboard: 'Dashboard',
  input: 'Input Nilai Rapor',
  algorithm: 'Proses Algoritma',
  results: 'Hasil Perangkingan',
  analytics: 'Analitik Kelas',
};

function showPage(name) {
  document.querySelectorAll('.page-section').forEach(el => {
    el.classList.toggle('active', el.id === `page-${name}`);
  });
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });
  document.getElementById('topbar-subtitle').textContent = subtitles[name] || '';

  // Refresh pages
  if (name === 'dashboard') renderDashboard();
  if (name === 'input') renderInputTable();
  if (name === 'algorithm') renderAlgorithmPage();
  if (name === 'results') renderResultsPage();
  if (name === 'analytics') renderAnalyticsPage();
}

document.querySelectorAll('.sidebar-nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    showPage(a.dataset.page);
  });
});

// ─── Run Sort ─────────────────────────────────────────────────
function runSort() {
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  if (activeStudents.length === 0) {
    store.sorted = [];
    store.steps = [];
    store.currentStep = -1;
    return 0;
  }
  const t0 = performance.now();
  const result = countingSort(activeStudents);
  const t1 = performance.now();

  store.sorted = result.sorted;
  store.steps = result.steps;
  store.currentStep = 0;

  addLog('Sorting Selesai', `Counting Sort: ${activeStudents.length} siswa dalam ${(t1 - t0).toFixed(2)}ms`, 'green');
  return t1 - t0;
}

// ─── Dashboard Rendering ──────────────────────────────────────
function renderDashboard() {
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  const n = activeStudents.length;

  // Stats
  document.getElementById('dash-total').textContent = n;
  document.getElementById('dash-new-badge').textContent = n > 0 ? `${n} Total` : '';

  if (n === 0) {
    document.getElementById('dash-avg').textContent = '—';
    document.getElementById('dash-top').textContent = '—';
    document.getElementById('dash-low').textContent = '—';
    document.getElementById('dash-top-sub').textContent = '';
    document.getElementById('dash-low-sub').textContent = '';
    document.getElementById('dash-efficiency').textContent = '—';
    document.getElementById('dash-efficiency-bar').style.width = '0%';
    renderDashChart([]);
    renderDashTopTable([]);
    return;
  }

  const avgs = activeStudents.map(s => s.average);
  const mean = (avgs.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const maxAvg = Math.max(...avgs).toFixed(1);
  const minAvg = Math.min(...avgs).toFixed(1);

  document.getElementById('dash-avg').textContent = mean;
  document.getElementById('dash-top').textContent = maxAvg;
  document.getElementById('dash-low').textContent = minAvg;

  const topStudents = activeStudents.filter(s => s.average == Math.max(...avgs));
  document.getElementById('dash-top-sub').textContent = `Dicapai oleh ${topStudents.length} siswa`;
  document.getElementById('dash-low-sub').textContent = 'Perlu intervensi';

  document.getElementById('dash-efficiency').textContent = '99.8%';
  document.getElementById('dash-efficiency-bar').style.width = '99.8%';

  // Use sorted list if available, otherwise use raw unsorted list
  const isSorted = store.sorted.length > 0;
  const displayStudents = isSorted ? store.sorted.slice(0, 5) : activeStudents.slice(0, 5);

  renderDashChart(activeStudents);
  renderDashTopTable(displayStudents, isSorted);
}

function renderDashChart(students) {
  const container = document.getElementById('dash-chart');
  // Remove old bars but keep guides
  container.querySelectorAll('.chart-bar-group').forEach(el => el.remove());

  if (students.length === 0) return;

  const buckets = [
    { label: '0-59', min: 0, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ];

  const counts = buckets.map(b =>
    students.filter(s => s.average >= b.min && s.average <= b.max).length
  );
  const maxCount = Math.max(...counts, 1);

  buckets.forEach((b, i) => {
    const group = document.createElement('div');
    group.className = 'chart-bar-group';

    const pct = (counts[i] / maxCount) * 100;
    const opacity = 0.2 + (i / (buckets.length - 1)) * 0.8;
    const color = i === buckets.length - 1 ? 'var(--primary)' : `rgba(0, 40, 142, ${opacity})`;

    group.innerHTML = `
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height:0%;background:${color};">
          <div class="chart-tooltip">${counts[i]} siswa</div>
        </div>
      </div>
      <span class="chart-bar-label">${b.label}</span>
    `;
    container.appendChild(group);

    // Animate height
    setTimeout(() => {
      group.querySelector('.chart-bar').style.height = `${Math.max(pct, 2)}%`;
    }, i * 100);
  });
}

function renderDashTopTable(topStudents, isSorted = false) {
  const tbody = document.getElementById('dash-top-tbody');
  if (topStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--on-surface-variant);padding:40px;">
      Belum ada data. Masukkan nilai siswa melalui menu <strong>Input Nilai</strong>.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = topStudents.map((s, i) => {
    const rank = i + 1;
    const rankText = isSorted ? String(rank).padStart(2, '0') : '—';
    const initials = getInitials(s.name);
    const passed = isPass(s.average);
    const avatarClass = isSorted && rank <= 3 ? 'primary' : 'neutral';

    return `<tr>
      <td><span style="font-weight:600;color:var(--primary);">${rankText}</span></td>
      <td>
        <div class="student-info">
          <div class="student-avatar ${avatarClass}">${initials}</div>
          <span class="student-name">${escHtml(s.name)}</span>
        </div>
      </td>
      <td style="font-size:14px;color:var(--on-surface-variant);font-family:monospace;">${formatStudentId(s.id)}</td>
      <td style="font-weight:700;font-size:20px;color:var(--primary);">${s.average.toFixed(1)}</td>
      <td style="text-align:right;">
        <span class="status-chip ${passed ? 'pass' : 'fail'}">${passed ? 'Lulus' : 'Remedi'}</span>
      </td>
    </tr>`;
  }).join('');
}

// ─── Input Table Rendering ────────────────────────────────────
function renderInputTable() {
  const thead = document.getElementById('input-thead');
  const tbody = document.getElementById('input-tbody');
  const footer = document.getElementById('input-table-footer');
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  const n = activeStudents.length;

  // Build thead with subject columns and Class column
  thead.innerHTML = `<tr>
    <th>ID Siswa</th>
    <th>Nama Lengkap</th>
    <th style="width:80px;">Kelas</th>
    ${store.subjects.map(s => `<th style="width:80px;">${escHtml(abbrevSubject(s))}</th>`).join('')}
    <th style="width:80px;">Avg.</th>
    <th style="text-align:center;width:120px;">Aksi</th>
  </tr>`;

  if (n === 0) {
    tbody.innerHTML = `<tr><td colspan="${5 + store.subjects.length}" style="text-align:center;color:var(--on-surface-variant);padding:40px;">
      Belum ada data siswa untuk kelas ini. Tambahkan siswa atau pilih filter kelas lainnya.
    </td></tr>`;
    footer.innerHTML = '<span>0 siswa</span>';
    updateInputStats();
    return;
  }

  tbody.innerHTML = activeStudents.map(s => {
    const subjCells = store.subjects.map(subj => {
      const val = s.subjects[subj];
      const hasVal = val !== undefined && val !== null && val !== '';
      return `<td>
        <input type="number" class="form-input-score" min="0" max="100"
               value="${hasVal ? val : ''}" placeholder="—"
               data-student-id="${s.id}" data-subject="${escHtml(subj)}" />
      </td>`;
    }).join('');

    return `<tr>
      <td style="font-size:12px;font-weight:500;color:var(--primary);">${formatStudentId(s.id)}</td>
      <td style="font-weight:500;">${escHtml(s.name)}</td>
      <td style="font-weight:600;color:var(--on-surface-variant);white-space:nowrap;"><span class="status-chip neutral" style="font-size:12px;background:var(--surface-container-high);color:var(--on-surface-variant);">${escHtml(s.class_name)}</span></td>
      ${subjCells}
      <td style="font-weight:700;color:var(--primary);">${s.average.toFixed(1)}</td>
      <td style="text-align:center;">
        <div style="display:inline-flex; gap:8px;">
          <button class="btn-icon primary btn-edit-student" data-edit-id="${s.id}" title="Edit Siswa">
            <span class="material-symbols-outlined" style="font-size:20px;">edit</span>
          </button>
          <button class="btn-icon danger btn-delete-student-input" data-delete-id="${s.id}" title="Hapus Siswa">
            <span class="material-symbols-outlined" style="font-size:20px;">delete</span>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  footer.innerHTML = `<span>Menampilkan ${n} siswa</span>`;

  // Bind score change events
  tbody.querySelectorAll('.form-input-score').forEach(input => {
    input.addEventListener('change', async () => {
      const studentId = parseInt(input.dataset.studentId);
      const subject = input.dataset.subject;
      const student = store.students.find(s => s.id === studentId);
      if (!student) return;

      const val = input.value.trim();
      const updatedSubjects = { ...student.subjects };
      if (val === '') {
        delete updatedSubjects[subject];
      } else {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          updatedSubjects[subject] = num;
        }
      }

      try {
        const res = await fetch(`/api/students/${studentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: student.name, class_name: student.class_name, subjects: updatedSubjects })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Gagal memperbarui nilai.');
        }

        await loadStudents();
        renderInputTable();
      } catch (err) {
        showToast(err.message, 'error');
        renderInputTable(); // Revert visual state
      }
    });
  });

  // Bind edit buttons
  tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.editId);
      const student = store.students.find(s => s.id === id);
      if (student) {
        openEditStudentModal(student);
      }
    });
  });

  // Bind delete buttons
  tbody.querySelectorAll('.btn-delete-student-input').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.deleteId);
      const student = store.students.find(s => s.id === id);
      if (student) {
        showDeleteConfirm(`Apakah Anda yakin ingin menghapus data <strong>${escHtml(student.name)}</strong>?`, async () => {
          try {
            const res = await fetch(`/api/students/${id}`, {
              method: 'DELETE'
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || 'Gagal menghapus siswa.');
            }
            await loadStudents();
            renderInputTable();
            addLog('Siswa Dihapus', `${student.name} telah dihapus`, 'amber');
            showToast(`${student.name} dihapus`);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }
    });
  });

  updateInputStats();
}

function updateInputStats() {
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  const n = activeStudents.length;
  if (n === 0) {
    document.getElementById('input-completeness').textContent = '0%';
    document.getElementById('input-completeness-bar').style.width = '0%';
    document.getElementById('input-avg').textContent = '—';
    document.getElementById('input-std').textContent = '—';
    return;
  }

  // Completeness: % of cells filled
  let totalCells = 0;
  let filledCells = 0;
  activeStudents.forEach(s => {
    store.subjects.forEach(subj => {
      totalCells++;
      const v = s.subjects[subj];
      if (v !== undefined && v !== null && v !== '') filledCells++;
    });
  });
  const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  document.getElementById('input-completeness').textContent = completeness + '%';
  document.getElementById('input-completeness-bar').style.width = completeness + '%';

  const avgs = activeStudents.map(s => s.average);
  const mean = avgs.reduce((a, b) => a + b, 0) / n;
  document.getElementById('input-avg').textContent = mean.toFixed(1);

  // Std dev
  const variance = avgs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  document.getElementById('input-std').textContent = Math.sqrt(variance).toFixed(1);
}

// ─── Add Student Dialog (Modal) ───────────────────────────────
const addStudentModal = document.getElementById('add-student-modal');
const addStudentForm = document.getElementById('add-student-form');
const addStudentSubjectsContainer = document.getElementById('add-student-subjects');

document.getElementById('btn-add-student').addEventListener('click', () => {
  // Populate subject input fields dynamically
  addStudentSubjectsContainer.innerHTML = store.subjects.map(subj => `
    <div>
      <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--on-surface-variant);">${subj}</label>
      <input type="number" class="form-input add-score-input" min="0" max="100" data-subject="${subj}" placeholder="0-100" style="width:100%;" />
    </div>
  `).join('');

  // Reset form name
  document.getElementById('add-student-name').value = '';
  addStudentModal.classList.add('show');
});

// Close Add Student Modal
function closeAddStudentModal() {
  addStudentModal.classList.remove('show');
}

document.getElementById('btn-close-add-modal').addEventListener('click', closeAddStudentModal);
document.getElementById('btn-cancel-add').addEventListener('click', closeAddStudentModal);
addStudentModal.addEventListener('click', (e) => {
  if (e.target === addStudentModal) closeAddStudentModal();
});

// Handle form submission
addStudentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('add-student-name').value.trim();
  const className = document.getElementById('add-student-class').value;
  if (!name) return;

  const subjectScores = {};
  addStudentForm.querySelectorAll('.add-score-input').forEach(input => {
    const val = input.value.trim();
    if (val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        const subj = input.dataset.subject;
        subjectScores[subj] = num;
      }
    }
  });

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, class_name: className, subjects: subjectScores })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Gagal menambahkan siswa.');
    }
    const data = await res.json();

    await loadStudents();
    renderInputTable();
    closeAddStudentModal();

    const addedStudent = store.students.find(s => s.id === data.id) || { name, average: calcAverage(subjectScores) };
    addLog('Siswa Ditambahkan', `${addedStudent.name} (avg: ${addedStudent.average.toFixed(1)}, kelas: ${className})`, 'green');
    showToast(`✓ ${addedStudent.name} ditambahkan`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ─── Generate Random Data ────────────────────────────────────
document.querySelectorAll('[data-gen]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const count = parseInt(btn.dataset.gen);
    const existing = new Set(store.students.map(s => s.name));
    const studentsToCreate = [];

    for (let i = 0; i < count; i++) {
      const name = randomName(existing);
      existing.add(name);
      const subjectScores = {};
      store.subjects.forEach(subj => {
        if (Math.random() > 0.08) subjectScores[subj] = randomScore();
      });
      const className = store.currentClassFilter === 'all' ? (Math.random() > 0.5 ? '10-A' : '10-B') : store.currentClassFilter;
      studentsToCreate.push({ name, class_name: className, subjects: subjectScores });
    }

    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentsToCreate, replaceAll: false })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal mengenerate data acak.');
      }

      await loadStudents();
      renderInputTable();
      addLog('Data Digenerate', `${count} siswa acak ditambahkan`, 'blue');
      showToast(`✓ ${count} siswa acak ditambahkan`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});

// ─── Clear All ────────────────────────────────────────────────
document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (store.students.length === 0) return;
  showDeleteConfirm('Apakah Anda yakin ingin menghapus <strong>semua data siswa</strong>? Tindakan ini tidak dapat dibatalkan.', async () => {
    try {
      const res = await fetch('/api/students', {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menghapus semua data.');
      }
      await loadStudents();
      renderInputTable();
      renderDashboard();
      addLog('Data Dihapus', 'Semua data siswa telah dihapus', 'amber');
      showToast('Semua data dihapus');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});

// ─── Start Ranking Button ────────────────────────────────────
document.getElementById('btn-start-ranking').addEventListener('click', () => {
  if (store.students.length === 0) {
    showToast('Tambahkan data siswa terlebih dahulu!', 'error');
    return;
  }
  const ms = runSort();
  showPage('algorithm');
  showToast(`⚡ Sorting selesai: ${store.students.length} siswa dalam ${ms.toFixed(2)}ms`, 'success');
});

// ─── Recalculate from Dashboard ──────────────────────────────
document.getElementById('btn-recalc').addEventListener('click', () => {
  if (store.students.length === 0) {
    showToast('Tambahkan data siswa terlebih dahulu!', 'error');
    return;
  }
  const ms = runSort();
  renderDashboard();
  showToast(`⚡ Ranking dihitung ulang dalam ${ms.toFixed(2)}ms`, 'success');
});

// ─── View All Results from Dashboard ─────────────────────────
document.getElementById('btn-view-all-results').addEventListener('click', () => {
  showPage('results');
});

// ─── Algorithm Visualization Page ────────────────────────────
let algoCurrentStep = 0;
let algoIntervalId = null;

function renderAlgorithmPage() {
  if (store.steps.length === 0 || store.sorted.length === 0) {
    renderAlgoEmpty();
    return;
  }

  // Set slider max
  const slider = document.getElementById('algo-progress-slider');
  slider.max = store.steps.length - 1;
  slider.value = 0;

  // Clear previous intervals if any
  stopAlgoAutoplay();

  // Render initial step (step index 0)
  renderAlgoStep(0);
}

function renderAlgoEmpty() {
  document.getElementById('algo-canvas').innerHTML = `
    <div style="color:var(--on-surface-variant); padding:40px; text-align:center; font-weight: 500;">
      Jalankan Counting Sort terlebih dahulu dari halaman Input Nilai.
    </div>
  `;

  document.getElementById('algo-step-title').textContent = 'Fase: Inisialisasi';
  document.getElementById('algo-step-desc').textContent = 'Jalankan sorting untuk memulai visualisasi.';
  document.getElementById('algo-step-counter').textContent = 'Langkah: 0 / 0';
  document.getElementById('algo-progress-slider').max = 0;

  document.getElementById('btn-control-prev').disabled = true;
  document.getElementById('btn-control-play').disabled = true;
  document.getElementById('btn-control-next').disabled = true;
}

function renderAlgoStep(stepIdx) {
  if (store.steps.length === 0) return;

  // Bound checks
  if (stepIdx < 0) stepIdx = 0;
  if (stepIdx >= store.steps.length) {
    stepIdx = store.steps.length - 1;
    stopAlgoAutoplay();
  }

  algoCurrentStep = stepIdx;

  const step = store.steps[stepIdx];
  const students = store.students;
  const sorted = store.sorted;
  const MAX = 1000;

  // Update controls
  document.getElementById('algo-progress-slider').value = stepIdx;
  document.getElementById('algo-step-counter').textContent = `Langkah: ${stepIdx + 1} / ${store.steps.length}`;
  document.getElementById('algo-step-title').textContent = step.title;
  document.getElementById('algo-step-desc').textContent = step.desc;

  const canvas = document.getElementById('algo-canvas');
  const uniqueKeys = new Set(students.map(s => s.sortKey));
  const keys = Array.from(uniqueKeys).sort((a, b) => a - b);
  const displayKeys = keys.slice(0, 10);

  // Render based on Phase
  if (step.phase === 'init') {
    canvas.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <h4 style="font-size: 18px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">Fase 1: Inisialisasi Count Array</h4>
        <p style="font-size: 14px; color: var(--on-surface-variant);">Membuat count array berukuran ${MAX + 1} (representasi 0.0 - 100.0) diisi nilai awal 0.</p>
      </div>
      <div style="background: var(--surface-container-low); padding: var(--space-lg); border-radius: var(--radius-md); border: 1px solid var(--outline-variant); width: 100%; max-width: 600px;">
        <h5 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--outline); margin-bottom: var(--space-md); text-align: center;">Count Array (Frek)</h5>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
          ${displayKeys.map(key => `
            <div class="algo-count-cell">
              <span class="grade-label">Avg: ${(key / 10).toFixed(1)}</span>
              <span class="count-value no-value">0</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (step.phase === 'count') {
    const activeStudent = students.find(stud => stud.id === step.activeStudentId);
    const activeStudentNodeHtml = activeStudent ? `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: var(--primary-fixed); border: 2px solid var(--primary); padding: var(--space-md) var(--space-lg); border-radius: var(--radius-md); box-shadow: var(--shadow-md); animation: stepPulse 1.5s infinite; max-width: 280px; width: 100%;">
        <span style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">Memproses Siswa</span>
        <strong style="font-size: 16px; color: var(--on-surface); text-align: center;">${activeStudent.name}</strong>
        <div style="display: flex; gap: 16px; font-size: 14px; font-weight: 600; color: var(--on-surface-variant);">
          <span>Rata-rata: ${activeStudent.average.toFixed(1)}</span>
          <span>Index Key: ${activeStudent.sortKey}</span>
        </div>
      </div>
    ` : '';

    const countGridHtml = displayKeys.map(key => {
      const isActive = step.activeKey === key;
      const activeClass = isActive ? 'active-cell' : '';
      const displayVal = step.countArr[key] || 0;
      return `
        <div class="algo-count-cell ${activeClass}">
          <span class="grade-label">Avg: ${(key / 10).toFixed(1)}</span>
          <span class="count-value ${displayVal ? 'has-value' : 'no-value'}">${displayVal}</span>
        </div>
      `;
    }).join('');

    canvas.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <h4 style="font-size: 18px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">Fase 2: Menghitung Frekuensi</h4>
        <p style="font-size: 14px; color: var(--on-surface-variant);">Membaca nilai rata-rata siswa dan menambahkan 1 pada indeks count array yang sesuai.</p>
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); width: 100%;">
        ${activeStudentNodeHtml}
        
        <span class="material-symbols-outlined" style="font-size: 32px; color: var(--primary);">arrow_downward</span>
        
        <div style="background: var(--surface-container-low); padding: var(--space-lg); border-radius: var(--radius-md); border: 1px solid var(--outline-variant); width: 100%; max-width: 600px;">
          <h5 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--outline); margin-bottom: var(--space-md); text-align: center;">Count Array (Frek)</h5>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
            ${countGridHtml}
          </div>
        </div>
      </div>
    `;
  } else if (step.phase === 'cumulative') {
    const cumGridHtml = displayKeys.map(key => {
      const displayVal = step.countArr[key] || 0;
      return `
        <div class="algo-count-cell active-cell">
          <span class="grade-label">Avg: ${(key / 10).toFixed(1)}</span>
          <span class="count-value cumulative">${displayVal}</span>
        </div>
      `;
    }).join('');

    canvas.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <h4 style="font-size: 18px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">Fase 3: Cumulative Count</h4>
        <p style="font-size: 14px; color: var(--on-surface-variant);">Menjumlahkan frekuensi secara beruntun agar mengetahui posisi akhir penempatan siswa.</p>
      </div>
      <div style="background: var(--surface-container-low); padding: var(--space-lg); border-radius: var(--radius-md); border: 1px solid var(--outline-variant); width: 100%; max-width: 600px;">
        <h5 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--outline); margin-bottom: var(--space-md); text-align: center;">Cumulative Count Array (Posisi)</h5>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
          ${cumGridHtml}
        </div>
      </div>
    `;
  } else if (step.phase === 'output') {
    const activeStudentOut = students.find(stud => stud.id === step.activeStudentId);
    const activeStudentOutHtml = activeStudentOut ? `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: var(--secondary-container); border: 2px solid var(--secondary); padding: var(--space-md) var(--space-lg); border-radius: var(--radius-md); box-shadow: var(--shadow-md); animation: stepPulse 1.5s infinite; max-width: 280px; width: 100%;">
        <span style="font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase;">Menempatkan Siswa</span>
        <strong style="font-size: 16px; color: var(--on-surface); text-align: center;">${activeStudentOut.name}</strong>
        <div style="display: flex; gap: 16px; font-size: 14px; font-weight: 600; color: var(--on-surface-variant);">
          <span>Rata-rata: ${activeStudentOut.average.toFixed(1)}</span>
          <span>Index Key: ${activeStudentOut.sortKey}</span>
        </div>
      </div>
    ` : '';

    const outputNodesHtml = sorted.slice(0, 5).map((s, i) => {
      const sortedIdx = sorted.indexOf(s);
      const activeIdx = sorted.findIndex(stud => stud.id === step.activeStudentId);
      const isPlaced = sortedIdx <= activeIdx;
      const isCurrentActive = step.activeStudentId === s.id;
      const classes = [];
      if (!isPlaced) classes.push('dimmed');
      if (isPlaced) classes.push('highlighted');
      if (isCurrentActive) classes.push('active-node');

      return `
        <div class="algo-node output ${classes.join(' ')}" style="width: 85px; height: 95px; margin: 4px;">
          <span class="index">Rank ${i + 1}</span>
          <span class="value" style="font-size:18px;">${s.average.toFixed(1)}</span>
          <span style="font-size: 10px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; margin-top: 4px;">${s.name}</span>
        </div>
      `;
    }).join('');

    canvas.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <h4 style="font-size: 18px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">Fase 4: Menyusun Peringkat Output</h4>
        <p style="font-size: 14px; color: var(--on-surface-variant);">Membaca nilai kumulatif, menempatkan siswa pada peringkat yang sesuai, dan mengurangi nilai kumulatif.</p>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); width: 100%;">
        ${activeStudentOutHtml}
        
        <span class="material-symbols-outlined" style="font-size: 32px; color: var(--secondary);">arrow_downward</span>
        
        <div style="background: var(--surface-container-low); padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--outline-variant); width: 100%; max-width: 600px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
          ${outputNodesHtml}
          ${sorted.length > 5 ? `<div style="display:flex; align-items:center; padding:10px; font-size:13px; color:var(--outline); font-weight:600;">+${sorted.length - 5} lainnya</div>` : ''}
        </div>
      </div>
    `;
  } else if (step.phase === 'done') {
    const finalNodesHtml = sorted.slice(0, 5).map((s, i) => `
      <div class="algo-node output highlighted" style="width: 85px; height: 95px; margin: 4px;">
        <span class="index">Rank ${i + 1}</span>
        <span class="value" style="font-size:18px;">${s.average.toFixed(1)}</span>
        <span style="font-size: 10px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; margin-top: 4px;">${s.name}</span>
      </div>
    `).join('');

    canvas.innerHTML = `
      <div style="text-align: center; margin-bottom: var(--space-md);">
        <h4 style="font-size: 18px; font-weight: 700; color: var(--secondary); margin-bottom: 8px;">Fase 5: Counting Sort Selesai!</h4>
        <p style="font-size: 14px; color: var(--on-surface-variant);">Seluruh siswa telah diurutkan dengan sukses berdasarkan nilai rata-rata rapor.</p>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-lg); width: 100%;">
        <div style="background: rgba(0, 109, 48, 0.05); border: 2px dashed var(--secondary); padding: var(--space-lg); border-radius: var(--radius-lg); display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; width: 100%; max-width: 600px;">
          ${finalNodesHtml}
          ${sorted.length > 5 ? `<div style="display:flex; align-items:center; padding:10px; font-size:13px; color:var(--secondary); font-weight:600;">+${sorted.length - 5} lainnya</div>` : ''}
        </div>
      </div>
    `;
  }

  // Enable/Disable buttons
  document.getElementById('btn-control-prev').disabled = stepIdx === 0;
  document.getElementById('btn-control-play').disabled = false;
  document.getElementById('btn-control-next').disabled = stepIdx === store.steps.length - 1;
}

// ─── Play / Pause Autoplay ───────────────────────────────────
function toggleAlgoAutoplay() {
  if (algoIntervalId) {
    stopAlgoAutoplay();
  } else {
    startAlgoAutoplay();
  }
}

function startAlgoAutoplay() {
  const speed = parseInt(document.getElementById('algo-speed').value);
  const playIcon = document.getElementById('control-play-icon');

  if (algoCurrentStep >= store.steps.length - 1) {
    algoCurrentStep = 0; // Loop back to start if finished
  }

  playIcon.textContent = 'pause';
  document.getElementById('btn-control-play').classList.remove('btn-primary');
  document.getElementById('btn-control-play').classList.add('secondary');

  algoIntervalId = setInterval(() => {
    if (algoCurrentStep < store.steps.length - 1) {
      renderAlgoStep(algoCurrentStep + 1);
    } else {
      stopAlgoAutoplay();
    }
  }, speed);
}

function stopAlgoAutoplay() {
  if (algoIntervalId) {
    clearInterval(algoIntervalId);
    algoIntervalId = null;
  }
  const playIcon = document.getElementById('control-play-icon');
  if (playIcon) {
    playIcon.textContent = 'play_arrow';
  }
  const btn = document.getElementById('btn-control-play');
  if (btn) {
    btn.classList.add('btn-primary');
    btn.classList.remove('secondary');
  }
}

// Bind UI controls
document.getElementById('btn-control-prev').addEventListener('click', () => {
  stopAlgoAutoplay();
  renderAlgoStep(algoCurrentStep - 1);
});

document.getElementById('btn-control-next').addEventListener('click', () => {
  stopAlgoAutoplay();
  renderAlgoStep(algoCurrentStep + 1);
});

document.getElementById('btn-control-play').addEventListener('click', () => {
  toggleAlgoAutoplay();
});

document.getElementById('algo-progress-slider').addEventListener('input', (e) => {
  stopAlgoAutoplay();
  renderAlgoStep(parseInt(e.target.value));
});

document.getElementById('algo-speed').addEventListener('change', () => {
  if (algoIntervalId) {
    stopAlgoAutoplay();
    startAlgoAutoplay();
  }
});

// Keyboard navigation for algo page
document.addEventListener('keydown', e => {
  if (!document.getElementById('page-algorithm').classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    stopAlgoAutoplay();
    renderAlgoStep(algoCurrentStep + 1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    stopAlgoAutoplay();
    renderAlgoStep(algoCurrentStep - 1);
  }
});

// ─── Results Page ─────────────────────────────────────────────
let resultFilter = 'all';
let resultSearch = '';

function renderResultsPage() {
  const isSorted = store.sorted.length > 0;
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  const displayList = isSorted ? store.sorted : activeStudents;
  const n = displayList.length;

  document.getElementById('result-entry-count').textContent = n;

  // Stats
  if (n === 0) {
    document.getElementById('res-avg').textContent = '—';
    document.getElementById('res-pass-rate').textContent = '—';
    document.getElementById('res-pass-count').textContent = '';
    document.getElementById('res-top').textContent = '—';
    document.getElementById('res-top-name').textContent = '';
    document.getElementById('res-mini-chart').innerHTML = '';
    renderResultTable([], '', false);
    return;
  }

  const avgs = displayList.map(s => s.average);
  const mean = (avgs.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const passCount = displayList.filter(s => isPass(s.average)).length;
  const passRate = ((passCount / n) * 100).toFixed(1);

  document.getElementById('res-avg').textContent = mean;
  document.getElementById('res-pass-rate').textContent = isSorted ? passRate + '%' : '—';
  document.getElementById('res-pass-count').textContent = isSorted ? `${passCount} Siswa Lulus` : 'Belum di-sort';
  document.getElementById('res-top').textContent = isSorted ? store.sorted[0].average.toFixed(1) : '—';
  document.getElementById('res-top-name').textContent = isSorted ? `${store.sorted[0].name} (Rank 1)` : 'Belum di-sort';

  // Mini chart
  renderMiniChart(displayList);

  // Table
  renderResultTable(displayList, resultSearch, isSorted);
}

function renderMiniChart(sorted) {
  const container = document.getElementById('res-mini-chart');
  const buckets = [
    { min: 0, max: 59 },
    { min: 60, max: 69 },
    { min: 70, max: 79 },
    { min: 80, max: 89 },
    { min: 90, max: 100 },
  ];
  const counts = buckets.map(b => sorted.filter(s => s.average >= b.min && s.average <= b.max).length);
  const maxC = Math.max(...counts, 1);

  container.innerHTML = counts.map((c, i) => {
    const h = Math.max((c / maxC) * 40, 4);
    const isTallest = c === maxC;
    return `<div class="mini-chart-bar${isTallest ? ' tallest' : ''}" style="height:${h}px;"></div>`;
  }).join('');
}

function renderResultTable(students, search, isSorted = false) {
  const thead = document.getElementById('result-thead');
  const tbody = document.getElementById('result-tbody');
  const footer = document.getElementById('result-table-footer');
  const n = students.length;

  // Build thead with subject columns
  thead.innerHTML = `<tr>
    <th style="width:80px;">Rank</th>
    <th>Nama Siswa</th>
    <th>ID Internal</th>
    <th style="width:80px;">Kelas</th>
    ${store.subjects.map(s => `<th style="text-align:center;">${escHtml(abbrevSubject(s))}</th>`).join('')}
    <th style="text-align:center;">Rata-rata</th>
    <th>Status</th>
    <th style="text-align:right;width:100px;">Aksi</th>
  </tr>`;

  if (n === 0) {
    const colSpan = 6 + store.subjects.length;
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--on-surface-variant);padding:40px;">
      Belum ada data untuk kelas ini. Masukkan nilai siswa dan jalankan Counting Sort.
    </td></tr>`;
    footer.innerHTML = '<span>Menampilkan 0 entri</span>';
    return;
  }

  const q = search.toLowerCase();
  const filtered = students.filter(s => {
    const matchSearch = !q || s.name.toLowerCase().includes(q);
    let matchGrade = true;
    if (resultFilter !== 'all') {
      matchGrade = gradeOf(s.average) === resultFilter;
    }
    return matchSearch && matchGrade;
  });

  tbody.innerHTML = filtered.map(s => {
    const rank = isSorted ? (store.sorted.indexOf(s) + 1) : null;
    const rankText = isSorted ? String(rank).padStart(2, '0') : '—';
    const initials = getInitials(s.name);
    const passed = isPass(s.average);

    let medalHtml = '';
    let rankClass = 'normal';
    let avatarClass = 'neutral';

    if (isSorted) {
      if (rank === 1) {
        medalHtml = '<span class="material-symbols-outlined medal-icon medal-gold filled" style="font-variation-settings:\'FILL\' 1;">workspace_premium</span>';
        rankClass = 'primary';
        avatarClass = 'primary';
      } else if (rank === 2) {
        medalHtml = '<span class="material-symbols-outlined medal-icon medal-silver filled" style="font-variation-settings:\'FILL\' 1;">workspace_premium</span>';
        avatarClass = 'neutral';
      } else if (rank === 3) {
        medalHtml = '<span class="material-symbols-outlined medal-icon medal-bronze filled" style="font-variation-settings:\'FILL\' 1;">workspace_premium</span>';
        avatarClass = 'neutral';
      }
    }

    if (isSorted && !passed) {
      rankClass = 'error';
      avatarClass = 'error';
    }

    // Subject cells
    const subjCells = store.subjects.map(subj => {
      const val = s.subjects[subj];
      const hasVal = val !== undefined && val !== null && val !== '';
      return `<td style="text-align:center;font-family:monospace;font-size:14px;font-weight:${hasVal ? '600' : '400'};color:${hasVal ? 'var(--on-surface)' : 'var(--outline)'};">${hasVal ? val : '—'}</td>`;
    }).join('');

    const scoreClass = (isSorted && rank <= 3) ? 'top' : (!passed ? 'fail' : 'normal');

    return `<tr class="${(isSorted && !passed) ? 'fail-row' : ''}">
      <td>
        <div class="rank-display">
          ${medalHtml || `<span style="width:28px;text-align:center;font-weight:700;font-size:18px;color:${(isSorted && !passed) ? 'var(--error)' : 'var(--on-surface-variant)'};">${rankText}</span>`}
          ${(isSorted && rank <= 3) ? `<span class="rank-number ${rankClass}">${rankText}</span>` : ''}
        </div>
      </td>
      <td>
        <div class="student-info">
          <div class="student-avatar ${avatarClass}">${initials}</div>
          <div>
            <p class="student-name">${escHtml(s.name)}</p>
          </div>
        </div>
      </td>
      <td style="font-size:14px;color:var(--on-surface-variant);font-family:monospace;">${formatStudentId(s.id)}</td>
      <td style="font-weight:600;color:var(--on-surface-variant);"><span class="status-chip neutral" style="font-size:12px;background:var(--surface-container-high);color:var(--on-surface-variant);">${escHtml(s.class_name)}</span></td>
      ${subjCells}
      <td style="text-align:center;">
        <span class="score-badge ${scoreClass}">${s.average.toFixed(1)}</span>
      </td>
      <td>
        <span class="status-chip ${passed ? 'pass' : 'fail'}">${passed ? 'Lulus' : 'Remedi'}</span>
      </td>
      <td style="text-align:right;">
        <button class="btn-icon primary btn-print-report" data-student-id="${s.id}" title="Cetak Rapor">
          <span class="material-symbols-outlined" style="font-size:20px;">print</span>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Bind print report card button clicks
  tbody.querySelectorAll('.btn-print-report').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.studentId);
      const student = store.students.find(s => s.id === id);
      if (student) {
        showPrintModal(student);
      }
    });
  });

  footer.innerHTML = `<span>Menampilkan ${filtered.length} dari ${n} entri</span>`;
}

function showPrintModal(s) {
  const modal = document.getElementById('print-modal');
  const body = document.getElementById('print-modal-body');
  if (!modal || !body) return;

  const rank = store.sorted.indexOf(s) !== -1 ? (store.sorted.indexOf(s) + 1) : '—';
  const totalRanked = store.sorted.length;

  const subjectRows = store.subjects.map((subj, idx) => {
    const val = s.subjects[subj];
    const displayVal = (val !== undefined && val !== null && val !== '') ? val : '—';
    const desc = val !== undefined && val >= 55 ? 'Tuntas' : (val !== undefined ? 'Belum Tuntas' : '—');
    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>${escHtml(subj)}</td>
        <td class="center" style="font-family:monospace; font-weight:bold;">${displayVal}</td>
        <td class="center">${desc}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <div class="report-card-print">
      <div class="report-header">
        <h3>DINAS PENDIDIKAN DAN KEBUDAYAAN</h3>
        <h3 style="font-size: 18px; margin-top:4px;">SMA NEGERI EDURANKER</h3>
        <p>Jl. Algoritma No. 101, Kota Cerdas • Telp: (021) 555-0199 • Website: sman-eduranker.sch.id</p>
      </div>
      <div class="report-title-doc">KARTU HASIL STUDI (RAPOR) SISWA</div>
      
      <div class="report-info-grid">
        <div>
          <div class="report-info-row">
            <span class="report-info-label">Nama Siswa</span>
            <span class="report-info-colon">:</span>
            <span class="report-info-val" style="font-weight:bold;">${escHtml(s.name)}</span>
          </div>
          <div class="report-info-row">
            <span class="report-info-label">Nomor Induk (ID)</span>
            <span class="report-info-colon">:</span>
            <span class="report-info-val" style="font-family:monospace;">${formatStudentId(s.id)}</span>
          </div>
        </div>
        <div>
          <div class="report-info-row">
            <span class="report-info-label">Kelas</span>
            <span class="report-info-colon">:</span>
            <span class="report-info-val">${escHtml(s.class_name)}</span>
          </div>
          <div class="report-info-row">
            <span class="report-info-label">Tahun Ajaran</span>
            <span class="report-info-colon">:</span>
            <span class="report-info-val">2025/2026 (Genap)</span>
          </div>
        </div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 50px;">No</th>
            <th>Mata Pelajaran</th>
            <th style="width: 100px; text-align: center;">Nilai</th>
            <th style="width: 150px; text-align: center;">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
        </tbody>
      </table>

      <div class="report-summary-box">
        <div>
          <div class="report-summary-title">Ringkasan Performa</div>
          <div style="margin-bottom:6px;">Rata-rata Nilai: <strong>${s.average.toFixed(1)}</strong></div>
          <div>Status Kelulusan: <span class="status-chip ${isPass(s.average) ? 'pass' : 'fail'}">${isPass(s.average) ? 'Lulus' : 'Remedi'}</span></div>
        </div>
        <div>
          <div class="report-summary-title">Hasil Perangkingan</div>
          <div style="margin-bottom:4px;">Peringkat Kelas: <strong style="font-size:16px; color:var(--primary);">${rank}</strong> dari <strong>${totalRanked}</strong> siswa</div>
          <div style="font-size:11px; font-style:italic; color:var(--on-surface-variant);">Diurutkan menggunakan algoritma Counting Sort</div>
        </div>
      </div>

      <div class="report-signatures">
        <div class="signature-col">
          <div>Mengetahui,</div>
          <div>Orang Tua / Wali Siswa</div>
          <div class="signature-space"></div>
          <div>...................................</div>
        </div>
        <div class="signature-col">
          <div>Kota Cerdas, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</div>
          <div>Wali Kelas</div>
          <div class="signature-space"></div>
          <div class="signature-name">Wali Kelas ${escHtml(s.class_name)}</div>
          <div>NIP. .............................</div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('show');
}

// Search
document.getElementById('result-search').addEventListener('input', e => {
  resultSearch = e.target.value;
  renderResultTable(store.sorted, resultSearch);
});

// Grade filter
document.getElementById('result-grade-filter').addEventListener('change', e => {
  resultFilter = e.target.value;
  renderResultTable(store.sorted, resultSearch);
});

// ─── Export Dropdown Toggle ──────────────────────────────────
document.getElementById('btn-download-report-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('export-dropdown-menu').classList.toggle('show');
});

document.addEventListener('click', () => {
  const menu = document.getElementById('export-dropdown-menu');
  if (menu && menu.classList.contains('show')) {
    menu.classList.remove('show');
  }
});

// ─── Export CSV ───────────────────────────────────────────────
document.getElementById('btn-export-csv').addEventListener('click', () => {
  if (!store.sorted.length) {
    showToast('Tidak ada data untuk diekspor.', 'error');
    return;
  }

  const headers = ['Ranking', 'Nama', 'ID', ...store.subjects, 'Rata-rata', 'Grade', 'Status'];
  const n = store.sorted.length;
  const rows = [headers];

  store.sorted.forEach((s, i) => {
    const rank = i + 1;
    const grade = gradeOf(s.average);
    const subjVals = store.subjects.map(subj => {
      const v = s.subjects[subj];
      return (v !== undefined && v !== null && v !== '') ? v : '';
    });
    rows.push([rank, s.name, formatStudentId(s.id), ...subjVals, s.average.toFixed(1), grade, isPass(s.average) ? 'Lulus' : 'Remedi']);
  });

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranking_rapor_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  addLog('Laporan Diunduh', 'CSV berhasil digenerate', 'green');
  showToast('✓ CSV berhasil diunduh', 'success');
});

// ─── Export PDF (Print Ranking Table) ──────────────────────────
document.getElementById('btn-export-pdf').addEventListener('click', () => {
  if (!store.sorted.length) {
    showToast('Tidak ada data untuk diekspor.', 'error');
    return;
  }

  const modal = document.getElementById('print-modal');
  const body = document.getElementById('print-modal-body');
  
  const headers = ['Rank', 'Nama Siswa', 'ID', ...store.subjects, 'Rata-rata', 'Grade', 'Status'];
  
  const tbodyHtml = store.sorted.map((s, i) => {
    const passed = isPass(s.average);
    const subjVals = store.subjects.map(subj => {
      const val = s.subjects[subj];
      return `<td class="center">${val !== undefined && val !== null && val !== '' ? val : '-'}</td>`;
    }).join('');
    
    return `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escHtml(s.name)}</td>
        <td style="font-family:monospace;font-size:12px;">${formatStudentId(s.id)}</td>
        ${subjVals}
        <td class="center" style="font-weight:bold;">${s.average.toFixed(1)}</td>
        <td class="center">${gradeOf(s.average)}</td>
        <td class="center">${passed ? 'Lulus' : 'Remedi'}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <div class="report-card-print">
      <div class="report-header">
        <h3>DINAS PENDIDIKAN DAN KEBUDAYAAN</h3>
        <h3 style="font-size: 18px; margin-top:4px;">SMA NEGERI EDURANKER</h3>
        <p>Jl. Algoritma No. 101, Kota Cerdas • Telp: (021) 555-0199 • Website: sman-eduranker.sch.id</p>
      </div>
      <div class="report-title-doc">LAPORAN HASIL PERANGKINGAN SISWA</div>
      
      <div style="margin-bottom: 20px; font-size: 14px;">
        <p><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
        <p><strong>Total Siswa:</strong> ${store.sorted.length}</p>
      </div>

      <table class="report-table" style="font-size: 12px;">
        <thead>
          <tr>
            <th style="width: 40px;">Rank</th>
            <th>Nama Siswa</th>
            <th>ID</th>
            ${store.subjects.map(subj => `<th class="center">${escHtml(abbrevSubject(subj))}</th>`).join('')}
            <th class="center">Avg</th>
            <th class="center">Grade</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyHtml}
        </tbody>
      </table>
    </div>
  `;
  
  modal.classList.add('show');
  
  // Wait a tiny bit for the modal to render before printing automatically
  setTimeout(() => {
    window.print();
  }, 100);
});

// ─── Explore Reports (Direct to Analytics Page) ───────────────
const exploreBtn = document.getElementById('btn-explore-reports');
if (exploreBtn) {
  exploreBtn.addEventListener('click', () => {
    showPage('analytics');
  });
}

// ─── Import CSV ──────────────────────────────────────────────
const importCsvModal = document.getElementById('import-csv-modal');
const csvFileInput = document.getElementById('csv-file-input');
const importDropzone = document.getElementById('import-dropzone');

// State for CSV import
const csvImportState = {
  rawText: '',
  fileName: '',
  fileSize: 0,
  headers: [],
  rows: [],         // array of arrays
  nameColIndex: 0,
  classColIndex: -1,
  selectedSubjectCols: [],  // indices
  delimiter: ',',
};

// ── CSV Parser ────────────────────────────────────────────────
function parseCSV(text, delimiter = ',') {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line, delim) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delim) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0], delimiter);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i], delimiter);
    if (row.length > 0 && row.some(cell => cell !== '')) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

// ── Auto-detect column mapping ────────────────────────────────
function autoDetectColumns(headers) {
  // Find name column: look for headers containing "nama", "name", "siswa", "student"
  const nameKeywords = ['nama', 'name', 'siswa', 'student', 'nama lengkap', 'nama siswa'];
  let nameIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (nameKeywords.some(kw => h.includes(kw))) {
      nameIdx = i;
      break;
    }
  }
  if (nameIdx === -1) nameIdx = 0; // default to first column

  // Find class column: look for headers containing "kelas", "class"
  const classKeywords = ['kelas', 'class'];
  let classIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (classKeywords.some(kw => h === kw || h.includes(kw))) {
      classIdx = i;
      break;
    }
  }

  // Find subject columns: exclude the name column and class column
  const subjectCols = [];
  const knownSubjectKeywords = [
    'matematika', 'mtk', 'math',
    'b. indonesia', 'b.ind', 'bahasa indonesia', 'indo',
    'b. inggris', 'b.ing', 'bahasa inggris', 'english', 'inggris',
    'ipa', 'sains', 'science',
    'ips', 'sosial', 'social',
    'pkn', 'ppkn', 'agama', 'seni', 'pjok', 'prakarya',
    'fisika', 'kimia', 'biologi', 'geografi', 'ekonomi', 'sejarah',
    'informatika', 'tik',
  ];

  for (let i = 0; i < headers.length; i++) {
    if (i === nameIdx || i === classIdx) continue;
    const h = headers[i].toLowerCase().trim();
    // Skip common non-subject columns
    if (['id', 'no', 'nomor', 'rank', 'ranking', 'status', 'grade', 'kelas', 'class', 'avg', 'average', 'rata-rata', 'rata rata'].some(kw => h === kw)) continue;
    // Auto-select if it matches a known subject keyword
    if (knownSubjectKeywords.some(kw => h.includes(kw))) {
      subjectCols.push(i);
    }
  }

  // If no subjects found via keywords, select all non-name, non-class, non-id columns
  if (subjectCols.length === 0) {
    for (let i = 0; i < headers.length; i++) {
      if (i === nameIdx || i === classIdx) continue;
      const h = headers[i].toLowerCase().trim();
      if (['id', 'no', 'nomor', 'rank', 'ranking', 'status', 'grade'].some(kw => h === kw)) continue;
      subjectCols.push(i);
    }
  }

  return { nameIdx, classIdx, subjectCols };
}

// ── Process file ──────────────────────────────────────────────
function processCSVFile(file) {
  if (!file) return;

  // Validate file type
  const validTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
  const validExts = ['.csv', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
    showToast('File tidak valid. Gunakan file .csv atau .txt', 'error');
    return;
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    showToast('File terlalu besar. Maksimal 5MB.', 'error');
    return;
  }

  csvImportState.fileName = file.name;
  csvImportState.fileSize = file.size;

  const reader = new FileReader();
  reader.onload = function (e) {
    csvImportState.rawText = e.target.result;
    parseAndShowPreview();
  };
  reader.onerror = function () {
    showToast('Gagal membaca file CSV.', 'error');
  };
  reader.readAsText(file, 'UTF-8');
}

function parseAndShowPreview() {
  const delim = csvImportState.delimiter;
  const actualDelim = delim === '\\t' ? '\t' : delim;
  const { headers, rows } = parseCSV(csvImportState.rawText, actualDelim);

  if (headers.length === 0 || rows.length === 0) {
    showToast('File CSV kosong atau format tidak valid.', 'error');
    return;
  }

  csvImportState.headers = headers;
  csvImportState.rows = rows;

  // Auto detect columns
  const { nameIdx, classIdx, subjectCols } = autoDetectColumns(headers);
  csvImportState.nameColIndex = nameIdx;
  csvImportState.classColIndex = classIdx;
  csvImportState.selectedSubjectCols = subjectCols;

  // Switch to preview step
  document.getElementById('import-step-select').style.display = 'none';
  document.getElementById('import-step-preview').style.display = 'block';

  // Update file info
  document.getElementById('import-filename').textContent = csvImportState.fileName;
  const sizeKb = (csvImportState.fileSize / 1024).toFixed(1);
  document.getElementById('import-filedetails').textContent =
    `${rows.length} baris • ${headers.length} kolom • ${sizeKb} KB`;

  // Populate name column selector
  const nameSelect = document.getElementById('import-col-name');
  nameSelect.innerHTML = headers.map((h, i) =>
    `<option value="${i}" ${i === nameIdx ? 'selected' : ''}>${escHtml(h)}</option>`
  ).join('');

  // Populate class column selector
  const classSelect = document.getElementById('import-col-class');
  classSelect.innerHTML = '<option value="-1">— (Tanpa Kolom Kelas) —</option>' + headers.map((h, i) =>
    `<option value="${i}" ${i === classIdx ? 'selected' : ''}>${escHtml(h)}</option>`
  ).join('');

  // Populate subject checkboxes
  renderSubjectCheckboxes();

  // Render preview table
  renderImportPreview();
}

function renderSubjectCheckboxes() {
  const container = document.getElementById('import-col-subjects');
  const headers = csvImportState.headers;
  const nameIdx = csvImportState.nameColIndex;
  const classIdx = csvImportState.classColIndex;

  container.innerHTML = headers.map((h, i) => {
    if (i === nameIdx || i === classIdx) return '';
    const isChecked = csvImportState.selectedSubjectCols.includes(i);
    return `
      <label class="import-subject-checkbox ${isChecked ? 'checked' : ''}">
        <input type="checkbox" value="${i}" ${isChecked ? 'checked' : ''} />
        ${escHtml(h)}
      </label>
    `;
  }).join('');

  // Bind checkbox events
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const label = cb.closest('.import-subject-checkbox');
      if (cb.checked) {
        label.classList.add('checked');
      } else {
        label.classList.remove('checked');
      }
      // Update selected columns
      csvImportState.selectedSubjectCols = Array.from(
        container.querySelectorAll('input[type="checkbox"]:checked')
      ).map(el => parseInt(el.value));
      renderImportPreview();
    });
  });
}

function renderImportPreview() {
  const thead = document.getElementById('import-preview-thead');
  const tbody = document.getElementById('import-preview-tbody');
  const headers = csvImportState.headers;
  const rows = csvImportState.rows;
  const nameIdx = csvImportState.nameColIndex;
  const classIdx = csvImportState.classColIndex;
  const subjCols = csvImportState.selectedSubjectCols;

  // Show name, class (if selected), and subjects in preview
  const previewCols = [nameIdx];
  if (classIdx !== -1) {
    previewCols.push(classIdx);
  }
  previewCols.push(...subjCols);

  thead.innerHTML = `<tr>
    ${previewCols.map(i => `<th>${escHtml(headers[i] || `Col ${i}`)}</th>`).join('')}
    <th style="text-align:center;">Avg</th>
  </tr>`;

  const previewRows = rows.slice(0, 5);
  tbody.innerHTML = previewRows.map(row => {
    const scores = subjCols.map(i => {
      const val = row[i] !== undefined ? row[i].trim() : '';
      const num = parseFloat(val);
      return (!isNaN(num) && num >= 0 && num <= 100) ? num : null;
    });
    const validScores = scores.filter(s => s !== null);
    const avg = validScores.length > 0
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
      : '—';

    return `<tr>
      ${previewCols.map(i => {
        const val = row[i] !== undefined ? row[i].trim() : '—';
        return `<td>${escHtml(val)}</td>`;
      }).join('')}
      <td style="text-align:center;font-weight:700;color:var(--primary);">${avg}</td>
    </tr>`;
  }).join('');

  if (rows.length > 5) {
    const colSpan = previewCols.length + 1;
    tbody.innerHTML += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--on-surface-variant);font-size:13px;font-style:italic;">
      ... dan ${rows.length - 5} baris lainnya
    </td></tr>`;
  }
}

// ── Open Import Modal ────────────────────────────────────────
function openImportModal() {
  // Reset to step 1
  document.getElementById('import-step-select').style.display = 'block';
  document.getElementById('import-step-preview').style.display = 'none';
  document.getElementById('import-opt-replace').checked = false;
  csvFileInput.value = '';

  // Reset state
  csvImportState.rawText = '';
  csvImportState.headers = [];
  csvImportState.rows = [];
  csvImportState.selectedSubjectCols = [];

  importCsvModal.classList.add('show');
}

function closeImportModal() {
  importCsvModal.classList.remove('show');
}

// ── Button: Open Modal ──────────────────────────────────────
document.getElementById('btn-import-csv').addEventListener('click', openImportModal);

// ── Close Modal ─────────────────────────────────────────────
document.getElementById('btn-close-import-modal').addEventListener('click', closeImportModal);
document.getElementById('btn-cancel-import').addEventListener('click', closeImportModal);
importCsvModal.addEventListener('click', (e) => {
  if (e.target === importCsvModal) closeImportModal();
});

// ── Browse File Button ──────────────────────────────────────
document.getElementById('btn-browse-csv').addEventListener('click', (e) => {
  e.stopPropagation();
  csvFileInput.click();
});

// ── Dropzone Click ──────────────────────────────────────────
importDropzone.addEventListener('click', () => {
  csvFileInput.click();
});

// ── File Input Change ───────────────────────────────────────
csvFileInput.addEventListener('change', () => {
  if (csvFileInput.files.length > 0) {
    processCSVFile(csvFileInput.files[0]);
  }
});

// ── Drag & Drop ─────────────────────────────────────────────
importDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  importDropzone.classList.add('drag-over');
});

importDropzone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  importDropzone.classList.remove('drag-over');
});

importDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  importDropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    processCSVFile(e.dataTransfer.files[0]);
  }
});

// ── Reselect File ───────────────────────────────────────────
document.getElementById('btn-reselect-csv').addEventListener('click', () => {
  document.getElementById('import-step-select').style.display = 'block';
  document.getElementById('import-step-preview').style.display = 'none';
  csvFileInput.value = '';
});

// ── Name Column Change ──────────────────────────────────────
document.getElementById('import-col-name').addEventListener('change', (e) => {
  csvImportState.nameColIndex = parseInt(e.target.value);
  // Re-render checkboxes (exclude the new name column)
  renderSubjectCheckboxes();
  renderImportPreview();
});

// ── Class Column Change ─────────────────────────────────────
document.getElementById('import-col-class').addEventListener('change', (e) => {
  csvImportState.classColIndex = parseInt(e.target.value);
  // Re-render checkboxes (exclude the class column)
  renderSubjectCheckboxes();
  renderImportPreview();
});

// ── Delimiter Change ────────────────────────────────────────
document.getElementById('import-delimiter').addEventListener('change', (e) => {
  csvImportState.delimiter = e.target.value;
  if (csvImportState.rawText) {
    parseAndShowPreview();
  }
});

// ── Confirm Import ──────────────────────────────────────────
document.getElementById('btn-confirm-import').addEventListener('click', async () => {
  const headers = csvImportState.headers;
  const rows = csvImportState.rows;
  const nameIdx = csvImportState.nameColIndex;
  const classIdx = csvImportState.classColIndex;
  const subjCols = csvImportState.selectedSubjectCols;

  if (rows.length === 0) {
    showToast('Tidak ada data untuk diimport.', 'error');
    return;
  }

  if (subjCols.length === 0) {
    showToast('Pilih minimal satu kolom mata pelajaran.', 'error');
    return;
  }

  const replaceAll = document.getElementById('import-opt-replace').checked;

  // Determine subject names from headers
  const subjectNames = subjCols.map(i => headers[i].trim());

  // Update store.subjects if CSV has different subjects
  // Merge with existing subjects
  const newSubjects = new Set(store.subjects);
  subjectNames.forEach(s => newSubjects.add(s));
  store.subjects = Array.from(newSubjects);

  const studentsToImport = [];
  let imported = 0;
  let skipped = 0;

  rows.forEach(row => {
    const name = (row[nameIdx] || '').trim();
    if (!name) {
      skipped++;
      return;
    }

    const className = (classIdx !== -1 && row[classIdx]) ? row[classIdx].trim() : '10-A';

    const subjectScores = {};
    subjCols.forEach((colIdx, j) => {
      const rawVal = row[colIdx] !== undefined ? row[colIdx].trim() : '';
      if (rawVal !== '') {
        const num = parseInt(rawVal, 10);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          subjectScores[subjectNames[j]] = num;
        }
      }
    });

    studentsToImport.push({ name, class_name: className, subjects: subjectScores });
    imported++;
  });

  try {
    const res = await fetch('/api/students/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: studentsToImport, replaceAll })
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Gagal mengimport data.');
    }

    await loadStudents();
    closeImportModal();
    renderInputTable();
    renderDashboard();

    addLog('CSV Diimport', `${imported} siswa dari ${csvImportState.fileName}`, 'green');
    showToast(`✓ ${imported} siswa berhasil diimport${skipped > 0 ? ` (${skipped} baris dilewati)` : ''}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ─── Global Search ───────────────────────────────────────────
document.getElementById('global-search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;

  // Find matching student
  const found = store.students.find(s => s.name.toLowerCase().includes(q));
  if (found) {
    // Auto navigate to results and filter
    resultSearch = q;
    document.getElementById('result-search').value = q;
    showPage('results');
  }
});

// ─── Initialize ──────────────────────────────────────────────
async function init() {
  await checkAuth();
  await loadStudents();

  // Bind logout buttons
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', openLogoutModal);
  const topbarLogoutBtn = document.getElementById('btn-topbar-logout');
  if (topbarLogoutBtn) topbarLogoutBtn.addEventListener('click', openLogoutModal);

  // Bind logout modal buttons
  const btnCloseLogout = document.getElementById('btn-close-logout-modal');
  if (btnCloseLogout) btnCloseLogout.addEventListener('click', closeLogoutModal);
  const btnCancelLogout = document.getElementById('btn-cancel-logout');
  if (btnCancelLogout) btnCancelLogout.addEventListener('click', closeLogoutModal);
  const btnConfirmLogout = document.getElementById('btn-confirm-logout');
  if (btnConfirmLogout) btnConfirmLogout.addEventListener('click', executeLogout);

  if (logoutConfirmModal) {
    logoutConfirmModal.addEventListener('click', (e) => {
      if (e.target === logoutConfirmModal) closeLogoutModal();
    });
  }

  // Bind class filter select changes
  document.querySelectorAll('.filter-class-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const selectedClass = e.target.value;
      store.currentClassFilter = selectedClass;
      
      // Sync all class selects
      document.querySelectorAll('.filter-class-select').forEach(sel => {
        sel.value = selectedClass;
      });

      // Recalculate sort for selected class
      runSort();

      // Refresh current active page
      const activePageLink = document.querySelector('.sidebar-nav a.active');
      if (activePageLink) {
        showPage(activePageLink.dataset.page);
      }
    });
  });

  // Bind print modal controls
  const printModal = document.getElementById('print-modal');
  if (printModal) {
    document.getElementById('btn-close-print-modal').addEventListener('click', () => {
      printModal.classList.remove('show');
    });
    document.getElementById('btn-cancel-print').addEventListener('click', () => {
      printModal.classList.remove('show');
    });
    document.getElementById('btn-do-print').addEventListener('click', () => {
      window.print();
    });
    printModal.addEventListener('click', (e) => {
      if (e.target === printModal) {
        printModal.classList.remove('show');
      }
    });
  }

  addLog('Sistem Aktif', 'EduRanker berhasil dimuat', 'green');

  showPage('dashboard');
}

// ─── Modal Details Helper ────────────────────────────────────
function showStudentDetailsModal(student) {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('modal-body-content');
  const title = document.getElementById('modal-title');

  title.textContent = `Detail Nilai: ${student.name}`;

  const passed = isPass(student.average);
  const statusClass = passed ? 'pass' : 'fail';
  const statusText = passed ? 'Lulus' : 'Remedi';

  const subjectRows = store.subjects.map(subj => {
    const val = student.subjects[subj];
    const displayVal = (val !== undefined && val !== null && val !== '') ? val : '—';
    return `
      <div class="modal-detail-row">
        <span class="modal-detail-label">${subj}</span>
        <span class="modal-detail-value">${displayVal}</span>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div class="modal-detail-row">
        <span class="modal-detail-label">ID Siswa</span>
        <span class="modal-detail-value" style="font-family: monospace;">${formatStudentId(student.id)}</span>
      </div>
      <div class="modal-detail-row">
        <span class="modal-detail-label">Rata-rata Rapor</span>
        <span class="modal-detail-value" style="color: var(--primary); font-size: 16px; font-weight:700;">${student.average.toFixed(1)}</span>
      </div>
      <div class="modal-detail-row">
        <span class="modal-detail-label">Status Kelulusan</span>
        <span class="modal-detail-value">
          <span class="status-chip ${statusClass}">${statusText}</span>
        </span>
      </div>
    </div>
    
    <h5 style="font-size: 14px; font-weight: 600; margin: 16px 0 8px 0; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 0.05em;">Nilai Pelajaran</h5>
    <div style="background: var(--surface-container-low); padding: 12px; border-radius: var(--radius);">
      ${subjectRows}
    </div>
  `;

  modal.classList.add('show');
}

// Bind modal close buttons
const detailModal = document.getElementById('detail-modal');
if (detailModal) {
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    detailModal.classList.remove('show');
  });
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.classList.remove('show');
    }
  });
}

// Close any open dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.action-dropdown-container')) {
    document.querySelectorAll('.action-dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

// ─── Edit Student Dialog (Modal) ──────────────────────────────
const editStudentModal = document.getElementById('edit-student-modal');
const editStudentForm = document.getElementById('edit-student-form');
const editStudentSubjectsContainer = document.getElementById('edit-student-subjects');

function openEditStudentModal(student) {
  document.getElementById('edit-student-id').value = student.id;
  document.getElementById('edit-student-name').value = student.name;
  document.getElementById('edit-student-class').value = student.class_name || '10-A';

  editStudentSubjectsContainer.innerHTML = store.subjects.map(subj => {
    const val = student.subjects[subj];
    const displayVal = (val !== undefined && val !== null && val !== '') ? val : '';
    return `
      <div>
        <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--on-surface-variant);">${subj}</label>
        <input type="number" class="form-input edit-score-input" min="0" max="100" data-subject="${subj}" value="${displayVal}" placeholder="0-100" style="width:100%;" />
      </div>
    `;
  }).join('');

  editStudentModal.classList.add('show');
}

function closeEditStudentModal() {
  editStudentModal.classList.remove('show');
}

document.getElementById('btn-close-edit-modal').addEventListener('click', closeEditStudentModal);
document.getElementById('btn-cancel-edit').addEventListener('click', closeEditStudentModal);
editStudentModal.addEventListener('click', (e) => {
  if (e.target === editStudentModal) closeEditStudentModal();
});

editStudentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = parseInt(document.getElementById('edit-student-id').value);
  const name = document.getElementById('edit-student-name').value.trim();
  const className = document.getElementById('edit-student-class').value;
  const student = store.students.find(s => s.id === id);

  if (student && name) {
    // Read scores
    const subjectScores = {};
    editStudentForm.querySelectorAll('.edit-score-input').forEach(input => {
      const val = input.value.trim();
      const subj = input.dataset.subject;
      if (val !== '') {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          subjectScores[subj] = num;
        }
      }
    });

    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, class_name: className, subjects: subjectScores })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal memperbarui data siswa.');
      }

      await loadStudents();
      renderInputTable();
      closeEditStudentModal();
      addLog('Siswa Diupdate', `${name} berhasil diperbarui`, 'blue');
      showToast(`✓ Data ${name} diperbarui`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ─── Analytics Page Rendering ─────────────────────────────────
function renderAnalyticsPage() {
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);
  const n = activeStudents.length;

  // 1. Populate Subject Select Dropdown
  const select = document.getElementById('analytics-subject-select');
  if (select) {
    const prevVal = select.value;
    select.innerHTML = store.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    if (prevVal && store.subjects.includes(prevVal)) {
      select.value = prevVal;
    } else if (store.subjects.length > 0) {
      select.value = store.subjects[0];
    }
  }

  if (n === 0) {
    document.getElementById('analytics-subjects-bars').innerHTML = '<p style="text-align:center;color:var(--outline);padding:20px;">Belum ada data siswa untuk kelas ini.</p>';
    document.getElementById('analytics-grade-distribution').innerHTML = '<p style="text-align:center;color:var(--outline);padding:20px;">Belum ada data siswa untuk kelas ini.</p>';
    document.getElementById('analytics-insight-text').textContent = 'Masukkan data siswa terlebih dahulu.';
    document.getElementById('analytics-subject-tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--outline);">Tidak ada data</td></tr>';
    document.getElementById('analytics-remedial-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--outline);">Tidak ada data</td></tr>';
    return;
  }

  // 2. Calculate average score for each subject
  const subjectAverages = {};
  store.subjects.forEach(subj => {
    let sum = 0;
    let count = 0;
    activeStudents.forEach(s => {
      const val = s.subjects[subj];
      if (val !== undefined && val !== null && val !== '') {
        sum += val;
        count++;
      }
    });
    subjectAverages[subj] = count > 0 ? sum / count : 0;
  });

  // Render subject performance bars
  const barsContainer = document.getElementById('analytics-subjects-bars');
  barsContainer.innerHTML = store.subjects.map((subj, idx) => {
    const avg = subjectAverages[subj];
    const pct = avg; // since max score is 100
    // Dynamic color from cyan to primary blue
    const color = `hsl(${200 + (idx * 15)}, 85%, 45%)`;
    return `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
          <span>${subj}</span>
          <span style="color:${color}; font-weight:700;">${avg.toFixed(1)}</span>
        </div>
        <div style="height:10px; background:var(--surface-container); border-radius:5px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; border-radius:5px; transition:width 800ms ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  // 3. Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  activeStudents.forEach(s => {
    const g = gradeOf(s.average);
    if (grades[g] !== undefined) grades[g]++;
  });

  const distContainer = document.getElementById('analytics-grade-distribution');
  distContainer.innerHTML = Object.entries(grades).map(([g, count]) => {
    const pct = n > 0 ? (count / n) * 100 : 0;
    let color = 'var(--primary)';
    if (g === 'A') color = '#008b8b';
    if (g === 'B') color = 'var(--secondary)';
    if (g === 'C') color = 'var(--tertiary)';
    if (g === 'D') color = 'var(--error)';
    return `
      <div>
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:2px;">
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${color};"></span>
            Grade ${g}
          </span>
          <span>${count} siswa (${pct.toFixed(0)}%)</span>
        </div>
        <div style="height:6px; background:var(--surface-container); border-radius:3px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; border-radius:3px; transition:width 600ms ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  // 4. Generate dynamic insight
  let highestSubj = '';
  let highestAvg = -1;
  let lowestSubj = '';
  let lowestAvg = 101;

  Object.entries(subjectAverages).forEach(([subj, avg]) => {
    if (avg > highestAvg) {
      highestAvg = avg;
      highestSubj = subj;
    }
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestSubj = subj;
    }
  });

  const passCount = activeStudents.filter(s => isPass(s.average)).length;
  const passRate = (passCount / n) * 100;

  let insightText = `Secara keseluruhan kelas Anda memiliki persentase kelulusan sebesar **${passRate.toFixed(0)}%**. `;
  if (highestSubj) {
    insightText += `Pelajaran dengan nilai rata-rata tertinggi adalah **${highestSubj}** (${highestAvg.toFixed(1)}), `;
  }
  if (lowestSubj) {
    insightText += `sedangkan pelajaran yang paling memerlukan perhatian khusus adalah **${lowestSubj}** (${lowestAvg.toFixed(1)}).`;
  }
  document.getElementById('analytics-insight-text').innerHTML = insightText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 5. Remedial students (Average < 55)
  const remedialBody = document.getElementById('analytics-remedial-tbody');
  const remedialStudents = activeStudents.filter(s => s.average < 55);

  if (remedialStudents.length === 0) {
    remedialBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--secondary);font-weight:600;padding:20px;">
      ✓ Seluruh siswa lulus KKM (Rata-rata &ge; 55)
    </td></tr>`;
  } else {
    remedialBody.innerHTML = remedialStudents.map(s => {
      const remediSubjects = Object.entries(s.subjects)
        .filter(([subj, score]) => score < 55)
        .map(([subj]) => abbrevSubject(subj));
      const remediDisplay = remediSubjects.length > 0 ? remediSubjects.join(', ') : 'Rata-rata Rendah';
      return `
        <tr>
          <td style="font-weight:500;">${escHtml(s.name)}</td>
          <td style="text-align:center;font-weight:700;color:var(--error);">${s.average.toFixed(1)}</td>
          <td style="text-align:center;"><span class="status-chip fail" style="font-size:11px;">${escHtml(remediDisplay)}</span></td>
        </tr>
      `;
    }).join('');
  }

  // 6. Handle Subject-Specific Ranking table
  renderSubjectRankingTable();
}

function renderSubjectRankingTable() {
  const select = document.getElementById('analytics-subject-select');
  if (!select) return;
  const subj = select.value;
  if (!subj) return;

  const tbody = document.getElementById('analytics-subject-tbody');
  const activeStudents = store.currentClassFilter === 'all' ? store.students : store.students.filter(s => s.class_name === store.currentClassFilter);

  const scoredStudents = activeStudents
    .filter(s => s.subjects[subj] !== undefined && s.subjects[subj] !== null && s.subjects[subj] !== '')
    .map(s => ({
      name: s.name,
      score: s.subjects[subj]
    }));

  scoredStudents.sort((a, b) => b.score - a.score);

  if (scoredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--outline);padding:20px;">Tidak ada data nilai pelajaran ini.</td></tr>';
    return;
  }

  tbody.innerHTML = scoredStudents.map((s, i) => {
    const rank = String(i + 1).padStart(2, '0');
    const passed = s.score >= 55;
    return `
      <tr>
        <td style="font-weight:600;color:var(--primary);">${rank}</td>
        <td style="font-weight:500;">${escHtml(s.name)}</td>
        <td style="text-align:center;font-weight:700;font-family:monospace;font-size:14px;">${s.score}</td>
        <td style="text-align:right;"><span class="status-chip ${passed ? 'pass' : 'fail'}">${passed ? 'Lulus' : 'Remedi'}</span></td>
      </tr>
    `;
  }).join('');
}

// Bind analytics subject dropdown change
const subSelect = document.getElementById('analytics-subject-select');
if (subSelect) {
  subSelect.addEventListener('change', renderSubjectRankingTable);
}

// ─── Delete Confirmation Modal ──────────────────────────────
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmMessage = document.getElementById('delete-confirm-message');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
let deleteConfirmCallback = null;

function showDeleteConfirm(message, onConfirm) {
  if (!deleteConfirmModal) return;
  deleteConfirmMessage.innerHTML = message;
  deleteConfirmCallback = onConfirm;
  deleteConfirmModal.classList.add('show');
}

function closeDeleteConfirmModal() {
  if (!deleteConfirmModal) return;
  deleteConfirmModal.classList.remove('show');
  deleteConfirmCallback = null;
}

if (document.getElementById('btn-close-delete-modal')) {
  document.getElementById('btn-close-delete-modal').addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteConfirmModal);
  btnConfirmDelete.addEventListener('click', () => {
    if (deleteConfirmCallback) deleteConfirmCallback();
    closeDeleteConfirmModal();
  });
  deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
  });
}

init();
