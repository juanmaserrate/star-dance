'use strict';

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Iniciá sesión para continuar.');
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'Iniciá sesión para continuar.');
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', { title: 'Acceso denegado', code: 403, msg: 'No tenés permiso para ver esta sección.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
