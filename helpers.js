'use strict';

// Calcula la edad a una fecha de referencia (por defecto: hoy).
function ageAt(birthDate, refDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b)) return null;
  const ref = refDate ? new Date(refDate) : new Date();
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function genCode(prefix = 'SD') {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${t}-${r}`;
}

// Convierte un array de objetos planos en texto CSV (separador ; para Excel es-AR)
function toCSV(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(';');
  const body = rows
    .map((row) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(';'))
    .join('\n');
  return '﻿' + header + '\n' + body; // BOM para acentos en Excel
}

module.exports = { ageAt, fmtDate, genCode, toCSV };
