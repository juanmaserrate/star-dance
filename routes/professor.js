'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');
const { ageAt, fmtDate, genCode } = require('../helpers');
const router = express.Router();

router.use(requireRole('profesor'));

// ---- Dashboard ----
router.get('/', (req, res) => {
  const uid = req.session.user.id;
  const students = db.prepare(`SELECT s.*, c.name club_name FROM students s LEFT JOIN clubs c ON c.id=s.club_id
    WHERE s.owner_id=? ORDER BY s.last_name, s.first_name`).all(uid);
  const stats = {
    alumnos: students.length,
    inscriptos: db.prepare(`SELECT COUNT(*) c FROM inscriptions WHERE professor_id=?`).get(uid).c,
    pagos: db.prepare(`SELECT COUNT(*) c FROM inscriptions WHERE professor_id=? AND paid=1`).get(uid).c,
  };
  res.render('professor/dashboard', { title: 'Mis alumnos', nav: 'profe', students, stats, ageAt, fmtDate });
});

// ---- Nuevo alumno ----
router.get('/alumnos/nuevo', (req, res) => {
  const clubs = db.prepare('SELECT * FROM clubs ORDER BY name').all();
  res.render('professor/student_form', { title: 'Nuevo alumno', nav: 'profe', student: {}, clubs, action: '/profe/alumnos', method: 'POST' });
});

router.post('/alumnos', (req, res) => {
  const { first_name, last_name, dni, birth_date, gender, club_id, level, notes } = req.body;
  if (!first_name || !last_name) { req.flash('error', 'Nombre y apellido son obligatorios.'); return res.redirect('/profe/alumnos/nuevo'); }
  db.prepare(`INSERT INTO students (owner_id, first_name, last_name, dni, birth_date, gender, club_id, level, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    req.session.user.id, first_name.trim(), last_name.trim(), dni || null, birth_date || null,
    gender || null, club_id || null, level || null, notes || null
  );
  req.flash('ok', 'Alumno/a guardado. Ya podés inscribirlo cuando quieras.');
  res.redirect('/profe');
});

// ---- Detalle de alumno ----
function ownStudent(req, res) {
  const s = db.prepare(`SELECT s.*, c.name club_name FROM students s LEFT JOIN clubs c ON c.id=s.club_id
    WHERE s.id=? AND s.owner_id=?`).get(req.params.id, req.session.user.id);
  if (!s) { res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Alumno no encontrado.' }); return null; }
  return s;
}

router.get('/alumnos/:id', (req, res) => {
  const s = ownStudent(req, res); if (!s) return;
  const docs = db.prepare('SELECT * FROM documents WHERE student_id=? ORDER BY uploaded_at DESC').all(s.id);
  const inscr = db.prepare(`SELECT i.*, t.name tname, cat.name cname FROM inscriptions i
    JOIN tournaments t ON t.id=i.tournament_id JOIN categories cat ON cat.id=i.category_id
    WHERE i.student_id=? ORDER BY i.created_at DESC`).all(s.id);
  res.render('professor/student_detail', { title: s.first_name + ' ' + s.last_name, nav: 'profe', s, docs, inscr, ageAt, fmtDate });
});

router.get('/alumnos/:id/editar', (req, res) => {
  const s = ownStudent(req, res); if (!s) return;
  const clubs = db.prepare('SELECT * FROM clubs ORDER BY name').all();
  res.render('professor/student_form', { title: 'Editar alumno', nav: 'profe', student: s, clubs, action: `/profe/alumnos/${s.id}?_method=PUT`, method: 'POST' });
});

router.put('/alumnos/:id', (req, res) => {
  const s = ownStudent(req, res); if (!s) return;
  const { first_name, last_name, dni, birth_date, gender, club_id, level, notes } = req.body;
  db.prepare(`UPDATE students SET first_name=?, last_name=?, dni=?, birth_date=?, gender=?, club_id=?, level=?, notes=? WHERE id=?`)
    .run(first_name.trim(), last_name.trim(), dni || null, birth_date || null, gender || null, club_id || null, level || null, notes || null, s.id);
  req.flash('ok', 'Datos actualizados.');
  res.redirect('/profe/alumnos/' + s.id);
});

router.delete('/alumnos/:id', (req, res) => {
  const s = ownStudent(req, res); if (!s) return;
  const docs = db.prepare('SELECT filename FROM documents WHERE student_id=?').all(s.id);
  db.prepare('DELETE FROM students WHERE id=?').run(s.id);
  docs.forEach(d => { try { fs.unlinkSync(path.join(UPLOAD_DIR, d.filename)); } catch (e) {} });
  req.flash('ok', 'Alumno/a eliminado.');
  res.redirect('/profe');
});

// ---- Documentos ----
router.post('/alumnos/:id/documentos', upload.single('archivo'), (req, res) => {
  const s = ownStudent(req, res); if (!s) return;
  if (!req.file) { req.flash('error', 'Elegí un archivo válido.'); return res.redirect('/profe/alumnos/' + s.id); }
  db.prepare(`INSERT INTO documents (student_id, doc_type, label, filename, original_name, size) VALUES (?,?,?,?,?,?)`)
    .run(s.id, req.body.doc_type || 'otro', req.body.label || null, req.file.filename, req.file.originalname, req.file.size);
  req.flash('ok', 'Documento subido correctamente.');
  res.redirect('/profe/alumnos/' + s.id);
});

router.get('/documentos/:docId/ver', (req, res) => {
  const d = db.prepare(`SELECT d.* FROM documents d JOIN students s ON s.id=d.student_id
    WHERE d.id=? AND s.owner_id=?`).get(req.params.docId, req.session.user.id);
  if (!d) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Documento no encontrado.' });
  res.sendFile(path.join(UPLOAD_DIR, d.filename));
});

router.delete('/documentos/:docId', (req, res) => {
  const d = db.prepare(`SELECT d.* FROM documents d JOIN students s ON s.id=d.student_id
    WHERE d.id=? AND s.owner_id=?`).get(req.params.docId, req.session.user.id);
  if (!d) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Documento no encontrado.' });
  db.prepare('DELETE FROM documents WHERE id=?').run(d.id);
  try { fs.unlinkSync(path.join(UPLOAD_DIR, d.filename)); } catch (e) {}
  req.flash('ok', 'Documento eliminado.');
  res.redirect('/profe/alumnos/' + d.student_id);
});

// ---- Inscribir ----
router.get('/inscribir', (req, res) => {
  const torneos = db.prepare(`SELECT * FROM tournaments WHERE status='publicado' ORDER BY date`).all();
  const selTorneo = req.query.torneo ? Number(req.query.torneo) : (torneos[0] && torneos[0].id);
  const categorias = selTorneo ? db.prepare(`SELECT * FROM categories WHERE tournament_id=? ORDER BY age_min, name`).all(selTorneo) : [];
  const students = db.prepare(`SELECT * FROM students WHERE owner_id=? ORDER BY last_name, first_name`).all(req.session.user.id);
  const torneoSel = torneos.find(t => t.id === selTorneo);
  res.render('professor/enroll', { title: 'Inscribir alumnos', nav: 'inscribir', torneos, categorias, students, selTorneo, torneoSel, ageAt, fmtDate });
});

router.post('/inscribir', (req, res) => {
  const uid = req.session.user.id;
  const category_id = Number(req.body.category_id);
  let ids = req.body.student_ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  const cat = db.prepare('SELECT * FROM categories WHERE id=?').get(category_id);
  if (!cat) { req.flash('error', 'Elegí una categoría válida.'); return res.redirect('/profe/inscribir'); }
  const ins = db.prepare(`INSERT OR IGNORE INTO inscriptions (tournament_id, category_id, student_id, professor_id, code)
    VALUES (?,?,?,?,?)`);
  let ok = 0, dup = 0;
  for (const sid of ids) {
    const s = db.prepare('SELECT id FROM students WHERE id=? AND owner_id=?').get(sid, uid);
    if (!s) continue;
    const r = ins.run(cat.tournament_id, category_id, Number(sid), uid, genCode());
    if (r.changes > 0) ok++; else dup++;
  }
  req.flash('ok', `${ok} inscripción(es) registradas${dup ? ' · ' + dup + ' ya estaban inscriptas' : ''}.`);
  res.redirect('/profe/inscripciones');
});

// ---- Mis inscripciones ----
router.get('/inscripciones', (req, res) => {
  const rows = db.prepare(`SELECT i.*, s.first_name, s.last_name, t.name tname, cat.name cname
    FROM inscriptions i JOIN students s ON s.id=i.student_id
    JOIN tournaments t ON t.id=i.tournament_id JOIN categories cat ON cat.id=i.category_id
    WHERE i.professor_id=? ORDER BY i.created_at DESC`).all(req.session.user.id);
  res.render('professor/inscriptions', { title: 'Mis inscripciones', nav: 'inscribir', rows, fmtDate });
});

module.exports = router;
