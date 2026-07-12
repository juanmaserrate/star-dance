'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Iniciar sesión', nav: 'login' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || '').trim());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    req.flash('error', 'Usuario o contraseña incorrectos.');
    return res.redirect('/login');
  }
  req.session.user = { id: u.id, username: u.username, role: u.role, full_name: u.full_name, club_id: u.club_id };
  const dest = u.role === 'admin' ? '/admin' : u.role === 'juez' ? '/juez' : '/profe';
  res.redirect(dest);
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
