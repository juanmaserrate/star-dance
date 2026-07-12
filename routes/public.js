'use strict';
const express = require('express');
const db = require('../db');
const { fmtDate } = require('../helpers');
const router = express.Router();

router.get('/', (req, res) => {
  const torneos = db.prepare(`SELECT * FROM tournaments WHERE status='publicado' ORDER BY date IS NULL, date ASC LIMIT 4`).all();
  const stats = {
    torneos: db.prepare(`SELECT COUNT(*) c FROM tournaments`).get().c,
    alumnos: db.prepare(`SELECT COUNT(*) c FROM students`).get().c,
    inscriptos: db.prepare(`SELECT COUNT(*) c FROM inscriptions`).get().c,
    clubes: db.prepare(`SELECT COUNT(*) c FROM clubs`).get().c,
  };
  res.render('public/home', { title: 'Inicio', nav: 'home', torneos, stats, fmtDate });
});

router.get('/torneos', (req, res) => {
  const torneos = db.prepare(`SELECT * FROM tournaments WHERE status IN ('publicado','cerrado') ORDER BY date IS NULL, date ASC`).all();
  for (const t of torneos) {
    t.categorias = db.prepare(`SELECT COUNT(*) c FROM categories WHERE tournament_id=?`).get(t.id).c;
  }
  res.render('public/torneos', { title: 'Torneos', nav: 'torneos', torneos, fmtDate });
});

router.get('/torneos/:id', (req, res) => {
  const t = db.prepare(`SELECT * FROM tournaments WHERE id=? AND status IN ('publicado','cerrado')`).get(req.params.id);
  if (!t) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Torneo no disponible.' });
  const categorias = db.prepare(`SELECT * FROM categories WHERE tournament_id=? ORDER BY age_min, name`).all(t.id);
  res.render('public/torneo', { title: t.name, nav: 'torneos', t, categorias, fmtDate });
});

router.get('/jueces', (req, res) => {
  const jueces = db.prepare(`SELECT * FROM judge_profiles WHERE visible=1 ORDER BY full_name`).all();
  res.render('public/jueces', { title: 'Jueces', nav: 'jueces', jueces });
});

// Certificado de inscripción (profesor dueño, admin o juez)
router.get('/certificado/:code', (req, res) => {
  if (!req.session.user) { req.flash('error', 'Iniciá sesión para ver el certificado.'); return res.redirect('/login'); }
  const r = db.prepare(`SELECT i.*, s.first_name, s.last_name, s.dni, s.birth_date, cl.name club_name,
      t.name tname, t.date tdate, t.location tloc, cat.name cname, cat.level clevel, cat.schedule cschedule,
      u.full_name profe FROM inscriptions i
    JOIN students s ON s.id=i.student_id LEFT JOIN clubs cl ON cl.id=s.club_id
    JOIN tournaments t ON t.id=i.tournament_id JOIN categories cat ON cat.id=i.category_id
    JOIN users u ON u.id=i.professor_id WHERE i.code=?`).get(req.params.code);
  if (!r) return res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'Certificado no encontrado.' });
  const u = req.session.user;
  if (u.role === 'profesor' && r.professor_id !== u.id) {
    return res.status(403).render('error', { title: 'Acceso denegado', code: 403, msg: 'Este certificado no es tuyo.' });
  }
  res.render('certificate', { layout: false, r, fmtDate });
});

module.exports = router;
