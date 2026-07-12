'use strict';
const bcrypt = require('bcryptjs');
const db = require('./db');
const { genCode } = require('./helpers');

const hash = (p) => bcrypt.hashSync(p, 10);
console.log('Sembrando datos de ejemplo...');

// Limpieza (para re-seed)
db.exec(`DELETE FROM inscriptions; DELETE FROM documents; DELETE FROM categories;
  DELETE FROM tournaments; DELETE FROM students; DELETE FROM judge_profiles;
  DELETE FROM users; DELETE FROM clubs;`);

// Clubes
const clubs = ['Star Dance San Martín', 'Club Atlético Norte', 'Roller Sur', 'Patín Club Oeste'];
const clubIds = {};
const insClub = db.prepare('INSERT INTO clubs (name, city) VALUES (?,?)');
clubs.forEach((c) => { clubIds[c] = insClub.run(c, 'Buenos Aires').lastInsertRowid; });

// Usuarios
const insUser = db.prepare('INSERT INTO users (username,password_hash,role,full_name,email,club_id) VALUES (?,?,?,?,?,?)');
const adminId = insUser.run('admin', hash('admin123'), 'admin', 'Administración Star Dance', 'liga@stardance.com.ar', null).lastInsertRowid;
const juezId = insUser.run('juez', hash('juez123'), 'juez', 'María Fernández', 'jueza@stardance.com.ar', null).lastInsertRowid;
const profe1 = insUser.run('profe.ana', hash('profe123'), 'profesor', 'Ana Gómez', 'ana@ejemplo.com', clubIds['Star Dance San Martín']).lastInsertRowid;
const profe2 = insUser.run('profe.luis', hash('profe123'), 'profesor', 'Luis Ramírez', 'luis@ejemplo.com', clubIds['Club Atlético Norte']).lastInsertRowid;

// Perfiles de jurado (públicos)
const insJudge = db.prepare('INSERT INTO judge_profiles (user_id, full_name, specialty, bio, visible) VALUES (?,?,?,?,1)');
insJudge.run(juezId, 'María Fernández', 'Jueza Nacional · Figuras', 'Más de 15 años evaluando patín artístico en la región.');
insJudge.run(null, 'Carlos Duarte', 'Juez · Libre y Danza', 'Ex patinador federado, especialista en programa libre.');
insJudge.run(null, 'Sofía Peralta', 'Jueza · Escuela e Iniciación', 'Docente y jueza dedicada a las categorías formativas.');

// Alumnos de ejemplo
const insStu = db.prepare('INSERT INTO students (owner_id,first_name,last_name,dni,birth_date,gender,club_id,level) VALUES (?,?,?,?,?,?,?,?)');
const s1 = insStu.run(profe1, 'Valentina', 'López', '55111222', '2016-04-10', 'Femenino', clubIds['Star Dance San Martín'], 'Iniciación').lastInsertRowid;
const s2 = insStu.run(profe1, 'Mateo', 'Sosa', '54222333', '2014-09-01', 'Masculino', clubIds['Star Dance San Martín'], 'Intermedio').lastInsertRowid;
const s3 = insStu.run(profe1, 'Emma', 'Díaz', '56333444', '2018-02-20', 'Femenino', clubIds['Star Dance San Martín'], 'Escuela').lastInsertRowid;
const s4 = insStu.run(profe2, 'Bruno', 'Martínez', '53444555', '2012-11-15', 'Masculino', clubIds['Club Atlético Norte'], 'Avanzado').lastInsertRowid;
const s5 = insStu.run(profe2, 'Julieta', 'Romero', '55555666', '2015-06-30', 'Femenino', clubIds['Club Atlético Norte'], 'Intermedio').lastInsertRowid;

// Torneo de ejemplo publicado + categorías
const tId = db.prepare("INSERT INTO tournaments (name,date,location,description,status) VALUES (?,?,?,?, 'publicado')")
  .run('Copa Star Dance 2026', '2026-09-20', 'Polideportivo San Martín, Buenos Aires',
    'Primer torneo de la temporada. Categorías para todas las edades y niveles. ¡Los esperamos!').lastInsertRowid;

const insCat = db.prepare('INSERT INTO categories (tournament_id,name,level,age_min,age_max,gender,schedule) VALUES (?,?,?,?,?,?,?)');
const c1 = insCat.run(tId, 'Escuela A', 'Escuela', 5, 7, null, 'Sáb 10:00').lastInsertRowid;
const c2 = insCat.run(tId, 'Iniciación B', 'Iniciación', 8, 10, null, 'Sáb 11:30').lastInsertRowid;
const c3 = insCat.run(tId, 'Intermedio', 'Intermedio', 10, 13, null, 'Sáb 15:00').lastInsertRowid;
const c4 = insCat.run(tId, 'Libre Avanzado', 'Avanzado', 12, 18, null, 'Dom 10:00').lastInsertRowid;

// Un segundo torneo en borrador (no visible al público)
db.prepare("INSERT INTO tournaments (name,date,location,status) VALUES (?,?,?, 'borrador')")
  .run('Torneo de Primavera', '2026-11-08', 'Sede a confirmar');

// Inscripciones de ejemplo
const insIns = db.prepare('INSERT INTO inscriptions (tournament_id,category_id,student_id,professor_id,paid,code) VALUES (?,?,?,?,?,?)');
insIns.run(tId, c1, s3, profe1, 1, genCode());
insIns.run(tId, c2, s1, profe1, 0, genCode());
insIns.run(tId, c3, s2, profe1, 1, genCode());
insIns.run(tId, c3, s5, profe2, 0, genCode());
insIns.run(tId, c4, s4, profe2, 1, genCode());

console.log('\n✔ Datos cargados. Usuarios de acceso:');
console.log('  ADMIN    → usuario: admin      · clave: admin123');
console.log('  JUEZ     → usuario: juez       · clave: juez123');
console.log('  PROFE 1  → usuario: profe.ana  · clave: profe123');
console.log('  PROFE 2  → usuario: profe.luis · clave: profe123\n');
