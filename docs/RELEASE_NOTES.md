# Quacker Release Notes

## 1.0.5

Quinta actualización correctiva posterior a `1.0.0`.

### Motivo de 1.0.5

Durante la verificación post-release de `1.0.4` se detectó que la búsqueda de libros en Explorar podía no devolver resultados de Open Library cuando coincidían latencia elevada, desconexiones transitorias o varias peticiones simultáneas.

La corrección:

- amplía de 2 a 5 segundos el margen de la búsqueda interactiva de Open Library;

- reintenta una vez los errores transitorios `ECONNRESET`, manteniendo un único presupuesto de timeout;

- propaga la cancelación del navegador desde `/api/explore` hasta Open Library para detener peticiones abandonadas;

- aumenta el debounce de Explorar de 250 ms a 600 ms para reducir consultas parciales mientras se escribe;

- cancela también la carga de destacados semanales cuando comienza una nueva búsqueda, evitando que compita con la consulta interactiva;

- mantiene intacto el filtro de portadas de los libros destacados semanales;

- no modifica ni migra `db.json`;

- no modifica la CSP;

- no añade ni reactiva proveedores externos.

### Validación

- Tests específicos de búsqueda y cancelación: 14/14.

- Tests de portadas semanales de Open Library: 2/2.

- Suite completa: 354/354 tests.

- `npm audit`: 0 vulnerabilidades.

- `git diff --check`: limpio.

- Versión: `1.0.5`.

Los tags `v1.0.0`, `v1.0.1`, `v1.0.2`, `v1.0.3` y `v1.0.4` permanecen intactos como snapshots inmutables de sus respectivas releases.


## 1.0.4

Cuarta actualización correctiva posterior a `1.0.0`.

### Motivo de 1.0.4

Durante la verificación post-release de `1.0.3` se comprobó que las portadas legacy de Library ya se mostraban correctamente en Biblioteca, pero podían seguir apareciendo vacías en Inicio / Backlog.

La causa estaba en el normalizador de portadas de Inicio: solo aceptaba URLs HTTPS absolutas y rechazaba la ruta same-origin segura utilizada por el proxy legacy existente.

La corrección:

- permite únicamente la ruta exacta `/api/library/:id/legacy-cover` en la normalización de portadas de Inicio;

- mantiene intacto el soporte existente para URLs HTTPS;

- continúa rechazando rutas relativas arbitrarias;

- no modifica ni migra `db.json`;

- no modifica la CSP;

- no modifica proveedores;

- no modifica el comportamiento ni las restricciones de seguridad del proxy legacy.

### Validación

- Regresión específica: 3/3 tests.

- Suite completa: 349/349 tests.

- `npm audit`: 0 vulnerabilidades.

- `git diff --check`: limpio.

- Versión: `1.0.4`.

Los tags `v1.0.0`, `v1.0.1`, `v1.0.2` y `v1.0.3` permanecen intactos como snapshots inmutables de sus respectivas releases.

## 1.0.3

Tercera actualización correctiva posterior a `1.0.0`.

### Motivo de 1.0.3

Durante la verificación post-release de Semana 7 se detectó que algunos libros mostrados en “Destacados esta semana” dentro de Explorar podían aparecer sin portada.

La causa estaba en el filtro de resultados semanales de Open Library: un elemento podía considerarse elegible aunque no tuviera portada, siempre que dispusiera de otros metadatos como fecha, resumen o autor.

La corrección:

- exige `externalId`, `title` y `cover` para que un libro de Open Library pueda aparecer como destacado semanal;

- mantiene intacta la deduplicación existente;

- no modifica Library;

- no modifica ni migra `db.json`;

- no modifica la CSP;

- no añade nuevos proveedores de contenido.

### Validación

- Regresión específica: 2/2 tests.

- Suite completa: 346/346 tests.

- `npm audit`: 0 vulnerabilidades.

- `git diff --check`: limpio.

- Validación real con 15 candidatos semanales: 15 con portada y 0 sin portada.

- Versión: `1.0.3`.

Los tags `v1.0.0`, `v1.0.1` y `v1.0.2` permanecen intactos como snapshots inmutables de sus respectivas releases.

## 1.0.2

Segunda actualización correctiva posterior a `1.0.0`.

### Motivo de 1.0.2

Durante la verificación post-release de `1.0.1` se comprobó que la reconstrucción de portadas mediante OLID resolvía algunos registros legacy, pero Open Library no dispone de portada para todas las ediciones históricas afectadas.

Esta corrección completa la compatibilidad conservando la política de seguridad y el retiro de Google Books como proveedor de contenido.

La corrección:

- mantiene Google Books retirado como proveedor de contenido;

- mantiene `books.google.com` fuera de la CSP;

- no modifica ni migra `db.json`;

- convierte únicamente portadas legacy persistidas en una ruta same-origin de Quacker;

- exige autenticación y vincula la portada al elemento existente en la Library del usuario;

- no acepta URLs arbitrarias proporcionadas por el cliente;

- restringe la descarga a HTTPS, host exacto `books.google.com` y ruta `/books/content`;

- rechaza redirecciones, puertos y credenciales;

- aplica timeout, validación de tipo de imagen y límite máximo de 2 MB;

- aplica la compatibilidad tanto al listado de Library como al detalle individual.

### Validación

- Suite completa: 344/344 tests.

- `npm audit`: 0 vulnerabilidades.

- `git diff --check`: limpio.

- Compatibilidad validada para las cuatro portadas legacy detectadas.

- Versión: `1.0.2`.

Los tags `v1.0.0` y `v1.0.1` permanecen intactos como snapshots inmutables de sus respectivas releases.

## 1.0.1

Primera actualización correctiva posterior a `1.0.0`.

### Motivo de 1.0.1

Durante la verificación post-release de Semana 7 se detectó que algunos libros antiguos de Library no mostraban su portada.

Estos registros procedían de una integración anterior y conservaban URLs de `books.google.com`, proveedor retirado de Quacker y bloqueado intencionadamente por la Content Security Policy actual.

La corrección:

- mantiene Google Books fuera de la CSP;
- no modifica ni migra `db.json`;
- detecta únicamente portadas legacy de Google Books asociadas a elementos `open_library`;
- reconstruye la portada usando el OLID ya persistido y `covers.openlibrary.org`;
- aplica la compatibilidad tanto al listado de Library como al detalle individual;
- mantiene intactas las portadas que ya utilizan proveedores permitidos.

### Validación

- Suite completa: 343/343 tests.
- `npm audit`: 0 vulnerabilidades.
- `git diff --check`: limpio.
- Compatibilidad validada para portadas legacy, listado de Library y detalle individual.
- Versión: `1.0.1`.

El tag `v1.0.0` permanece intacto como snapshot de la primera versión estable.

## 1.0.0

Primera versión estable de Quacker.

Esta release se publica a partir del candidato validado `1.0.0-rc.3` y no introduce cambios funcionales adicionales respecto a ese RC.

### Estado de la release

La versión estable incorpora las correcciones y validaciones completadas durante la preparación de los Release Candidates y la Semana 7:

- autenticación y sesiones;
- Library y persistencia de progreso;
- transición a completado;
- reinicio de juegos a 0 % con estado `not_started`;
- Activity con timestamps correctos;
- conservación del progreso histórico en nuevas actividades;
- Lists: carga, creación, añadir, retirar y eliminar;
- seguridad, datos y operación en producción.

### Validación

- Suite completa: 340/340 tests.
- `npm audit`: 0 vulnerabilidades.
- Smoke funcional final completado.
- PM2 estable en producción, sin reinicios inestables.
- Versión: `1.0.0`.

El tag `v1.0.0-rc.3` permanece intacto como snapshot del candidato final validado.

## 1.0.0-rc.3

Release Candidate final posterior a `1.0.0-rc.2`, preparada tras completar el smoke funcional de Semana 7.

### Motivo de rc.3

Durante el smoke final de `1.0.0-rc.2` se detectaron varias regresiones acotadas en el flujo manual de progreso y en el historial de Activity.

Las correcciones incluidas:

- restablecen un juego a `not_started` cuando progreso y horas vuelven a cero;
- evitan reutilizar un `lastActivityAt` antiguo al guardar progreso manual;
- guardan el porcentaje histórico de progreso dentro del payload de nuevas actividades;
- conservan `payload.progress` durante la normalización del cliente para que Activity muestre el valor histórico real.

No se ha realizado ninguna migración de datos históricos. Las actividades antiguas que no contienen `payload.progress` permanecen intactas.

Los tags de Release Candidate anteriores permanecen intactos como snapshots inmutables.

### Validación funcional

El smoke final ha validado:

- registro, login, persistencia de sesión y logout;
- carga de Library, detalle, navegación y recarga;
- progreso manual y persistencia;
- transición a completado;
- reinicio de juego a 0 % y estado `not_started`;
- timestamps nuevos en actividades de progreso;
- conservación independiente de progresos históricos sucesivos en Activity;
- carga de Lists;
- creación y eliminación de listas;
- añadir y retirar elementos de listas.

### Calidad

- Suite completa: 340/340 tests.
- `npm audit`: 0 vulnerabilidades.
- Producción estable durante el smoke: PM2 `online`, 0 reinicios inestables.
- Versión: `1.0.0-rc.3`.

## 1.0.0-rc.2

Release Candidate corregida posterior a `1.0.0-rc.1`.

### Motivo de rc.2

Durante la regresión de flujos críticos de Semana 6 se detectó que una nueva actividad de progreso o completado podía reutilizar el `createdAt` de la actividad anterior.

La corrección:

- usa un timestamp nuevo para cada actividad normal;
- conserva `lastActivityAt` cuando se envía explícitamente para actividad histórica;
- añade cobertura de regresión específica para esta lógica.

El tag `v1.0.0-rc.1` permanece intacto como snapshot del RC anterior.

### Validación funcional

Se han validado los flujos críticos del RC:

- registro y sesión;
- Library;
- actualización de progreso;
- transición a completado;
- persistencia de actividad;
- timestamps consecutivos de actividad;
- creación de listas;
- añadir y retirar elementos de listas;
- persistencia y eliminación de listas.

### Seguridad

Validaciones realizadas:

- cookie de sesión `HttpOnly`, `Secure` y `SameSite=Lax` en producción;
- regeneración de sesión en registro y login;
- destrucción de sesión y cookie en logout;
- acceso no autenticado a APIs privadas rechazado;
- rutas sensibles no expuestas públicamente;
- CSP activa en enforcement;
- HSTS activo;
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` presentes;
- `X-Powered-By` deshabilitado.

Tests dirigidos de seguridad y sesiones: 51/51.

### Datos y operaciones

Validaciones realizadas:

- `db.json` con permisos `0600`;
- `.sessions` con permisos `0700`;
- `db.json` válido y conforme al esquema de Quacker;
- backups rotatorios configurados con límite de 5;
- restauración segura disponible mediante CLI;
- PM2, Nginx, Certbot y logrotate activos y habilitados;
- rotación diaria de logs con 14 copias;
- espacio en disco suficiente.

No había backups existentes durante la revisión porque `db.json` no había recibido ninguna escritura desde que el mecanismo de backups entró en producción.

### Calidad

- Suite completa: 333/333 tests.
- `npm audit`: 0 vulnerabilidades.
- Versión: `1.0.0-rc.2`.
