# Quacker Release Notes

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
