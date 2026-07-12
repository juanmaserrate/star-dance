'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'star-dance-dev-secret-cambiar-en-produccion',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 horas
  })
);

// Variables disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.nav = '';
  res.locals.title = '';
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Helper de flash
app.use((req, res, next) => {
  req.flash = (type, msg) => {
    req.session.flash = req.session.flash || {};
    req.session.flash[type] = msg;
  };
  next();
});

// Rutas
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/public'));
app.use('/profe', require('./routes/professor'));
app.use('/admin', require('./routes/admin'));
app.use('/juez', require('./routes/judge'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'No encontrado', code: 404, msg: 'La página que buscás no existe.' });
});

// Errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Error', code: 500, msg: 'Ocurrió un error inesperado.' });
});

app.listen(PORT, () => {
  console.log(`\n★ Star Dance corriendo en http://localhost:${PORT}\n`);
});
