'use strict';
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../middleware/upload');
const { ageAt, fmtDate, toCSV } = require('../helpers');
const router = express.Router();

router.use(requireRole('admin'));

// ================= DASHBOARD =================
router.get('/', (req, res) => {
  const stats = {
    torneos: db.prepare('SELECT COUNT(*) c FROM tournaments').get().c,
    publicados: db.prepare("SELECT COUNT(*) c FROM tournaments WHERE status='publicado'").get().c,
    alumnos: db.prepare('SELECT COUNT(*) c FROM students').get().c,
    profes: db.prepare("SELECT COUNT(*) c FROM users WHERE role='profesor'").get().c,
    inscriptos: db.prepare('SELECT COUNT(*) c FROM inscriptions').get().c,
    pagados: db.prepare('SELECT COUNT(*) c FROM inscriptions WHERE paid=1').get().c,
    pendientes: db.prepare('SELECT COUNT(*) c FROM inscriptions WHERE paid=0').get().c,
  };
  const porClub = db.prepare(`SELECT COALESCE(cl.name,'Sin club') club, COUNT(DISTINCT s.id) n
    FROM students s LEFT JOIN clubs cl ON cl.id=s.club_id GROUP BY cl.name ORDER BY n DESC`).all();
  const porTorneo = db.prepare(`SELECT t.name, t.id, COUNT(i.id) n,
      SUM(CASE WHEN i.paid=1 THEN 1 ELSE 0 END) pagos
    FROM tournaments t LEFT JOIN inscriptions i ON i.tournament_id=t.id
    GROUP BY t.id ORDER BY t.date`).all();
  res.render('admin/dashboard', { title: 'Panel admin', nav: 'admin', stats, porClub, porTorneo });
});

// ================= TORNEOS =================
router.get('/torneos', (req, res) => {
  const torneos = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM categories WHERE tournament_id=t.id) cats,
    (SELECT COUNT(*) FROM inscriptions WHERE tournament_id=t.id) insc FROM tournaments t ORDER BY date`).all();
  res.render('admin/tournaments', { title: 'Torneos', nav: 'admin', torneos, fmtDate });
});

router.get('/torneos/nuevo', (req, res) => {
  res.render('admin/tournament_form', { title: 'Nuevo torneo', nav: 'admin', t: {}, action: '/admin/torneos', method: 'POST' });
});

router.post('/torneos', (req, res) => {
  const { name, date, location, description, status } = req.body;
  const info = db.prepare('INSERT INTO tournaments (name,date,location,description,status) VALUES (?,?,?,?,?)')
    .run(name.trim(), date || null, location || null, description || null, status || 'borrador');
  req.flash('ok', 'Torneo creado. Ahora agregá las categorías.');
  res.redirect('/admin/torneos/' + info.lastInsertRowid);
});

router.get('/torneos/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Torneo no encontrado.' });
  const categorias = db.prepare('SELECT * FROM categories WHERE tournament_id=? ORDER BY age_min, name').all(t.id);
  for (const c of categorias) c.insc = db.prepare('SELECT COUNT(*) n FROM inscriptions WHERE category_id=?').get(c.id).n;
  res.render('admin/tournament_edit', { title: t.name, nav: 'admin', t, categorias, fmtDate });
});

router.put('/torneos/:id', (req, res) => {
  const { name, date, location, description, status } = req.body;
  db.prepare('UPDATE tournaments SET name=?,date=?,location=?,description=?,status=? WHERE id=?')
    .run(name.trim(), date || null, location || null, description || null, status || 'borrador', req.params.id);
  req.flash('ok', 'Torneo actualizado.');
  res.redirect('/admin/torneos/' + req.params.id);
});

router.delete('/torneos/:id', (req, res) => {
  db.prepare('DELETE FROM tournaments WHERE id=?').run(req.params.id);
  req.flash('ok', 'Torneo eliminado.');
  res.redirect('/admin/torneos');
});

// ---- Categorías ----
router.post('/torneos/:id/categorias', (req, res) => {
  const { name, level, age_min, age_max, gender, schedule } = req.body;
  db.prepare('INSERT INTO categories (tournament_id,name,level,age_min,age_max,gender,schedule) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, name.trim(), level || null, age_min || null, age_max || null, gender || null, schedule || null);
  req.flash('ok', 'Categoría agregada.');
  res.redirect('/admin/torneos/' + req.params.id);
});

router.delete('/categorias/:catId', (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.catId);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.catId);
  req.flash('ok', 'Categoría eliminada.');
  res.redirect('/admin/torneos/' + (c ? c.tournament_id : ''));
});

// ================= INSCRIPCIONES =================
function inscQuery(filter) {
  let sql = `SELECT i.*, s.first_name, s.last_name, s.dni, s.birth_date, cl.name club,
      t.name tname, cat.name cname, cat.level clevel, cat.schedule cschedule, u.full_name profe
    FROM inscriptions i JOIN students s ON s.id=i.student_id LEFT JOIN clubs cl ON cl.id=s.club_id
    JOIN tournaments t ON t.id=i.tournament_id JOIN categories cat ON cat.id=i.category_id
    JOIN users u ON u.id=i.professor_id`;
  const w = [], p = [];
  if (filter.torneo) { w.push('i.tournament_id=?'); p.push(filter.torneo); }
  if (filter.categoria) { w.push('i.category_id=?'); p.push(filter.categoria); }
  if (filter.pago === '1') w.push('i.paid=1');
  if (filter.pago === '0') w.push('i.paid=0');
  if (w.length) sql += ' WHERE ' + w.join(' AND ');
  sql += ' ORDER BY t.name, cat.age_min, cat.name, s.last_name';
  return db.prepare(sql).all(...p);
}

router.get('/inscripciones', (req, res) => {
  const torneos = db.prepare('SELECT * FROM tournaments ORDER BY date').all();
  const cats = req.query.torneo ? db.prepare('SELECT * FROM categories WHERE tournament_id=? ORDER BY name').all(req.query.torneo) : [];
  const rows = inscQuery(req.query);
  res.render('admin/inscriptions', { title: 'Inscripciones', nav: 'admin', torneos, cats, rows, q: req.query, ageAt, fmtDate });
});

router.post('/inscripciones/:id/pago', (req, res) => {
  const paid = req.body.paid === '1' ? 1 : 0;
  db.prepare('UPDATE inscriptions SET paid=?, payment_note=? WHERE id=?').run(paid, req.body.payment_note || null, req.params.id);
  req.flash('ok', paid ? 'Pago confirmado.' : 'Marcado como pendiente.');
  res.redirect(req.get('Referer') || '/admin/inscripciones');
});

router.get('/inscripciones/export.csv', (req, res) => {
  const rows = inscQuery(req.query);
  const csv = toCSV(rows, [
    { label: 'Apellido', value: 'last_name' }, { label: 'Nombre', value: 'first_name' },
    { label: 'DNI', value: 'dni' }, { label: 'Edad', value: r => ageAt(r.birth_date) },
    { label: 'Club', value: 'club' }, { label: 'Torneo', value: 'tname' },
    { label: 'Categoria', value: 'cname' }, { label: 'Nivel', value: 'clevel' },
    { label: 'Horario', value: 'cschedule' }, { label: 'Profesor', value: 'profe' },
    { label: 'Pago', value: r => (r.paid ? 'PAGADO' : 'PENDIENTE') }, { label: 'Codigo', value: 'code' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inscripciones.csv"');
  res.send(csv);
});

// Ver documento de cualquier alumno (admin)
router.get('/documentos/:docId/ver', (req, res) => {
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.docId);
  if (!d) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Documento no encontrado.' });
  res.sendFile(path.join(UPLOAD_DIR, d.filename));
});

router.get('/alumnos/:id', (req, res) => {
  const s = db.prepare(`SELECT s.*, cl.name club_name, u.full_name profe FROM students s
    LEFT JOIN clubs cl ON cl.id=s.club_id JOIN users u ON u.id=s.owner_id WHERE s.id=?`).get(req.params.id);
  if (!s) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Alumno no encontrado.' });
  const docs = db.prepare('SELECT * FROM documents WHERE student_id=? ORDER BY uploaded_at DESC').all(s.id);
  res.render('admin/student_view', { title: s.first_name + ' ' + s.last_name, nav: 'admin', s, docs, ageAt, fmtDate });
});

// ================= CLUBES =================
router.get('/clubes', (req, res) => {
  const clubes = db.prepare(`SELECT cl.*, (SELECT COUNT(*) FROM students WHERE club_id=cl.id) n FROM clubs cl ORDER BY name`).all();
  res.render('admin/clubs', { title: 'Clubes', nav: 'admin', clubes });
});

router.post('/clubes', (req, res) => {
  try {
    db.prepare('INSERT INTO clubs (name, city) VALUES (?,?)').run(req.body.name.trim(), req.body.city || null);
    req.flash('ok', 'Club agregado.');
  } catch (e) { req.flash('error', 'Ese club ya existe.'); }
  res.redirect('/admin/clubes');
});

router.delete('/clubes/:id', (req, res) => {
  db.prepare('UPDATE students SET club_id=NULL WHERE club_id=?').run(req.params.id);
  db.prepare('DELETE FROM clubs WHERE id=?').run(req.params.id);
  req.flash('ok', 'Club eliminado.');
  res.redirect('/admin/clubes');
});

// ================= USUARIOS =================
router.get('/usuarios', (req, res) => {
  const usuarios = db.prepare(`SELECT u.*, cl.name club_name FROM users u LEFT JOIN clubs cl ON cl.id=u.club_id ORDER BY role, full_name`).all();
  const clubs = db.prepare('SELECT * FROM clubs ORDER BY name').all();
  res.render('admin/users', { title: 'Usuarios', nav: 'admin', usuarios, clubs });
});

router.post('/usuarios', (req, res) => {
  const { username, password, role, full_name, email, phone, club_id } = req.body;
  if (!username || !password || !full_name) { req.flash('error', 'Faltan datos obligatorios.'); return res.redirect('/admin/usuarios'); }
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username,password_hash,role,full_name,email,phone,club_id) VALUES (?,?,?,?,?,?,?)')
      .run(username.trim(), hash, role, full_name.trim(), email || null, phone || null, club_id || null);
    if (role === 'juez') {
      db.prepare('INSERT INTO judge_profiles (user_id, full_name, visible) VALUES (?,?,1)').run(
        db.prepare('SELECT id FROM users WHERE username=?').get(username.trim()).id, full_name.trim());
    }
    req.flash('ok', 'Usuario creado.');
  } catch (e) { req.flash('error', 'Ese nombre de usuario ya existe.'); }
  res.redirect('/admin/usuarios');
});

router.post('/usuarios/:id/reset', (req, res) => {
  if (!req.body.password) { req.flash('error', 'Ingresá una contraseña nueva.'); return res.redirect('/admin/usuarios'); }
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(req.body.password, 10), req.params.id);
  req.flash('ok', 'Contraseña actualizada.');
  res.redirect('/admin/usuarios');
});

router.post('/usuarios/:id/toggle', (req, res) => {
  const u = db.prepare('SELECT active FROM users WHERE id=?').get(req.params.id);
  db.prepare('UPDATE users SET active=? WHERE id=?').run(u.active ? 0 : 1, req.params.id);
  req.flash('ok', 'Estado del usuario actualizado.');
  res.redirect('/admin/usuarios');
});

// ================= JUECES (perfiles públicos) =================
router.get('/jueces', (req, res) => {
  const jueces = db.prepare('SELECT * FROM judge_profiles ORDER BY full_name').all();
  res.render('admin/judges', { title: 'Jueces', nav: 'admin', jueces });
});

router.post('/jueces', (req, res) => {
  db.prepare('INSERT INTO judge_profiles (full_name, specialty, bio, photo, visible) VALUES (?,?,?,?,1)')
    .run(req.body.full_name.trim(), req.body.specialty || null, req.body.bio || null, req.body.photo || null);
  req.flash('ok', 'Juez/a agregado al jurado.');
  res.redirect('/admin/jueces');
});

router.post('/jueces/:id/toggle', (req, res) => {
  const j = db.prepare('SELECT visible FROM judge_profiles WHERE id=?').get(req.params.id);
  db.prepare('UPDATE judge_profiles SET visible=? WHERE id=?').run(j.visible ? 0 : 1, req.params.id);
  res.redirect('/admin/jueces');
});

router.delete('/jueces/:id', (req, res) => {
  db.prepare('DELETE FROM judge_profiles WHERE id=?').run(req.params.id);
  req.flash('ok', 'Juez/a eliminado.');
  res.redirect('/admin/jueces');
});

module.exports = router;
