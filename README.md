# Star Dance · Plataforma de la Liga de Patín Artístico

Sitio web responsive (funciona en celular y computadora) para la liga de patinaje **Star Dance**:
promoción de torneos, jurado, inscripción de alumnos por parte de los profesores, y un panel de
administración con dashboards, control de pagos, exportables y certificados.

## Cómo iniciarlo (Windows)

**Opción fácil:** doble clic en `iniciar.bat`. La primera vez instala todo y carga datos de ejemplo.

**Opción manual** (desde una terminal en esta carpeta):

```bash
npm install     # solo la primera vez
npm run seed    # solo la primera vez (crea la base con datos de ejemplo)
npm start       # inicia el servidor
```

Después abrí en el navegador: **http://localhost:3000**

## Usuarios de prueba

| Rol            | Usuario     | Contraseña |
|----------------|-------------|------------|
| Administrador  | `admin`     | `admin123` |
| Juez           | `juez`      | `juez123`  |
| Profesor/a     | `profe.ana` | `profe123` |
| Profesor/a     | `profe.luis`| `profe123` |

> ⚠️ Cambiá estas contraseñas antes de usarlo de verdad (el admin puede hacerlo desde
> **Panel admin → Usuarios**). Estas credenciales son solo datos de ejemplo del `seed.js`.

### Producción

Antes de publicar la app en un servidor real, definí una clave de sesión propia con la variable
de entorno `SESSION_SECRET` (por ejemplo en Windows: `set SESSION_SECRET=algo-largo-y-secreto`
antes de `npm start`). Si no la definís, se usa una clave por defecto solo apta para desarrollo.

## Qué puede hacer cada rol

- **Público (sin login):** ver inicio, torneos publicados con sus categorías, y el jurado.
- **Profesor/a:** dar de alta alumnos (quedan guardados y reutilizables), cargar fichas técnicas,
  documentos y seguros de salud de cada alumno, e inscribirlos a las categorías de un torneo.
- **Administrador:** crear torneos y sus categorías (edades, niveles, horarios), ver TODAS las
  inscripciones con los datos que cargan los profes, marcar pagos, exportar a CSV/Excel,
  ver documentos, gestionar clubes, usuarios y el jurado, y ver dashboards.
- **Juez:** ver el listado de inscriptos de cada torneo agrupado por categoría, y exportarlo.

Los **certificados de inscripción** se generan solos por cada inscripción (botón "Ver certificado" /
"Cert."), y se pueden imprimir o guardar como PDF desde el navegador.

## Tecnología

Node.js + Express · SQLite (base de datos incorporada de Node, sin instalar nada aparte) ·
EJS (plantillas) · Multer (subida de archivos). Sin dependencias externas de internet: funciona offline.

## Estructura

```
server.js            arranque del servidor y rutas
db.js                esquema de la base de datos
seed.js              datos iniciales de ejemplo
helpers.js           utilidades (edad, CSV, fechas)
routes/              auth, público, profesor, admin, juez
views/               plantillas EJS (páginas)
public/              CSS, logo e imágenes
uploads/             documentos subidos (se crea solo)
middleware/          login por roles y subida de archivos
```

## Personalizar la marca

- **Logo:** reemplazá `public/img/logo.svg` por el logo real de la liga (podés dejar un `.png` o `.jpg`
  y actualizar las referencias, o guardarlo como `logo.svg`).
- **Colores:** están al principio de `public/css/style.css` (variables `--violeta`, `--dorado`, etc.).
