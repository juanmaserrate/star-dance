'use strict';
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { ageAt, fmtDate, toCSV } = require('../helpers');
const router = express.Router();

router.use(requireRole('juez', 'admin'));

function loadRows(torneoId) {
  return db.prepare(`SELECT i.*, s.first_name, s.last_name, s.dni, s.birth_date, cl.name club,
      cat.name cname, cat.level clevel, cat.age_min, cat.age_max, cat.schedule cschedule, cat.id cat_id,
      u.full_name profe FROM inscriptions i
    JOIN students s ON s.id=i.student_id LEFT JOIN clubs cl ON cl.id=s.club_id
    JOIN categories cat ON cat.id=i.category_id JOIN users u ON u.id=i.professor_id
    WHERE i.tournament_id=? ORDER BY cat.age_min, cat.name, s.last_name`).all(torneoId);
}

router.get('/', (req, res) => {
  const torneos = db.prepare(`SELECT * FROM tournaments WHERE status IN ('publicado','cerrado') ORDER BY date`).all();
  const selTorneo = req.query.torneo ? Number(req.query.torneo) : (torneos[0] && torneos[0].id);
  const torneoSel = torneos.find(t => t.id === selTorneo);
  const rows = selTorneo ? loadRows(selTorneo) : [];
  // agrupar por categoría
  const grupos = {};
  for (const r of rows) {
    if (!grupos[r.cat_id]) grupos[r.cat_id] = { cat: r, items: [] };
    grupos[r.cat_id].items.push(r);
  }
  res.render('judge/dashboard', {
    title: 'Módulo jueces', nav: 'juez', torneos, selTorneo, torneoSel,
    grupos: Object.values(grupos), total: rows.length, ageAt, fmtDate,
  });
});

router.get('/export.csv', (req, res) => {
  const rows = loadRows(Number(req.query.torneo));
  const csv = toCSV(rows, [
    { label: 'Categoria', value: 'cname' }, { label: 'Nivel', value: 'clevel' },
    { label: 'Horario', value: 'cschedule' }, { label: 'Apellido', value: 'last_name' },
    { label: 'Nombre', value: 'first_name' }, { label: 'Edad', value: r => ageAt(r.birth_date) },
    { label: 'Club', value: 'club' }, { label: 'Profesor', value: 'profe' },
    { label: 'Pago', value: r => (r.paid ? 'PAGADO' : 'PENDIENTE') },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="listado_torneo.csv"');
  res.send(csv);
});

module.exports = router;
