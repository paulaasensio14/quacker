# Mapa de datos de usuario

Este documento describe dónde almacena y procesa Quacker los datos relacionados con sus usuarios. Sirve como referencia para mantenimiento, privacidad y para preparar la limpieza obligatoria de usuarios beta/test previa al lanzamiento público.

> Estado verificado durante W9-004 de v1.0.6.
>
> Debe revisarse cuando cambie el modelo de datos, especialmente al introducir funciones sociales o colaborativas.

## 1. Base de datos principal

La base activa está en `server/db.json`. Su estructura superior actual contiene únicamente `users`.

En el momento de la auditoría había 16 usuarios. Cada cuenta está encapsulada en `db.users[userId]`.

Los buckets observados pueden contener:

- `profile`: `id`, `email`, `name`, `handle`, `language`, `theme`, `avatar` y `bio`.
- `auth`: `passwordSalt`, `passwordHash`, `authVersion` y, cuando existe, `passwordReset`.
- `library`: contenidos guardados, estado, progreso, metadatos y marcas temporales.
- `lists`: listas personales y referencias a elementos de la propia biblioteca.
- `activities`: actividad, minutos, objetivo, tipo y datos de progreso.
- `notifications`: notificaciones del usuario.
- `explore`: estado personal como `dismissed`.
- `ui`: filtros, orden, modos de vista y términos de búsqueda persistidos.
- `goals`: bloque opcional presente solo en algunos usuarios.

`passwordReset` puede contener `tokenHash`, `issuedAt` y `expiresAt`.

La contraseña en texto plano no se almacena en `db.json`.

## 2. Referencias entre usuarios

Durante W9-004 se recorrió recursivamente la base activa comparando sus valores de texto con los IDs de los usuarios existentes.

Resultado verificado:

- referencias al propio usuario: 16;
- referencias a otro usuario: 0;
- las 16 referencias propias corresponden exclusivamente a `profile.id`.

Con el modelo actual, eliminar `db.users[userId]` no deja referencias conocidas a esa cuenta dentro de los buckets de otros usuarios.

Esta conclusión deberá volver a comprobarse cuando existan seguidores, reseñas sociales, listas colaborativas, comentarios, menciones, propiedad compartida u otras relaciones entre cuentas.

## 3. Backups

Los datos de usuario también existen en copias históricas.

### Backups rotatorios

Ubicación: `server/db.json.backup-*`.

Quacker conserva hasta cinco copias junto a la base activa.

Durante W9-004 existían cinco backups rotatorios y todos contenían los 16 usuarios.

### Backups periódicos

Ubicación: `/var/backups/quacker/db.json.backup-*`.

Desde W9-002 se generan diariamente mediante systemd, con una retención máxima de 30 copias.

Durante W9-004 existían dos backups periódicos y ambos contenían los 16 usuarios.

Permisos esperados:

- `/var/backups/quacker`: `0700 ubuntu:ubuntu`;
- backups: `0600 ubuntu:ubuntu`.

Estas copias están separadas del directorio de la base activa, pero continúan en el mismo disco del VPS y no constituyen por sí solas recuperación ante pérdida total del servidor.

### Implicación para borrados

Eliminar una cuenta de `server/db.json` no elimina sus datos de las copias históricas.

La futura limpieza previa al lanzamiento deberá distinguir entre:

1. limpiar la base activa;
2. conservar un backup previo validado para recuperación;
3. decidir expresamente el tratamiento de backups históricos que todavía contengan usuarios beta/test.

Mientras una copia retenida siga conteniendo esos usuarios, no debe afirmarse que sus datos han sido eliminados de todos los soportes.

## 4. Sesiones

Las sesiones se almacenan mediante `session-file-store` en `server/.sessions`.

El directorio utiliza permisos `0700`.

Una sesión autenticada almacena `userId` y `authVersion`.

En cada petición protegida Quacker comprueba que:

1. exista un `userId`;
2. el usuario siga existiendo en `db.users`;
3. el `authVersion` de la sesión coincida con el de la cuenta.

Si el usuario deja de existir, la sesión deja de considerarse autenticada y Quacker intenta destruirla y limpiar la cookie.

Durante W9-004 existía un único archivo de sesión persistido y no contenía `userId`, por lo que en ese momento no había sesiones autenticadas persistidas.

La futura herramienta de limpieza deberá detectar e invalidar expresamente las sesiones asociadas a los usuarios objetivo y no depender únicamente de que el usuario vuelva a realizar una petición.

## 5. Archivos y cachés

No se detectó almacenamiento persistente adicional de usuario mediante directorios de uploads, avatares locales, archivos personales separados o cachés en disco.

`profile.avatar` forma parte de los datos almacenados dentro de `db.json`.

Open Library mantiene una caché de búsquedas en memoria durante aproximadamente cinco minutos.

Los rate limits del formulario de contacto y de autenticación también utilizan estructuras en memoria.

Estas estructuras desaparecen cuando termina o se reinicia el proceso Node.

## 6. Proveedores externos de contenido

Quacker consulta actualmente:

- TMDB;
- RAWG;
- Open Library;
- Wikipedia.

Los términos o parámetros necesarios para realizar búsquedas pueden enviarse a estos proveedores mediante sus respectivas APIs.

Esto constituye procesamiento transitorio fuera del VPS. No se detectó almacenamiento persistente local adicional dedicado a registrar esas peticiones.

Las políticas de tratamiento o retención de cada proveedor quedan fuera del control directo de Quacker y deberán considerarse en la futura documentación de privacidad.

## 7. Correo electrónico

Quacker utiliza SMTP para varios flujos.

### Formulario de contacto

Puede procesar:

- nombre;
- email;
- idioma;
- mensaje.

El correo termina en el buzón configurado mediante `CONTACT_TO`, por lo que el proveedor SMTP y el buzón receptor pueden conservar una copia.

### Bienvenida

El correo de bienvenida procesa nombre, email e idioma.

### Recuperación de contraseña

Procesa nombre, email, idioma y una URL/token temporal de recuperación.

En `db.json` se conserva el hash del token y sus tiempos asociados.

### Logs SMTP

Los fallos de envío registran actualmente metadatos técnicos como:

- `code`;
- `command`;
- `responseCode`;
- `missingConfig`.

No se detectó que estos logs impriman nombre, email, mensaje ni token de recuperación.

## 8. Logs

Durante la revisión del código no se detectó logging intencionado de datos personales en los principales flujos de autenticación, contacto o correo.

Los diagnósticos de proveedores externos añadidos durante W8 están diseñados para evitar registrar cuerpos remotos, URLs completas, secretos o mensajes sensibles.

Este punto deberá auditarse de nuevo antes del lanzamiento público.

## 9. Perímetro actual

Persistencia controlada directamente por Quacker:

- `server/db.json`;
- `server/db.json.backup-*`;
- `/var/backups/quacker/db.json.backup-*`;
- `server/.sessions`.

Sistemas externos relevantes:

- proveedor SMTP y buzones implicados;
- TMDB;
- RAWG;
- Open Library;
- Wikipedia.

Estado transitorio en memoria:

- caché de búsquedas de Open Library;
- rate limits de contacto;
- rate limits de autenticación.

## 10. Requisitos para la futura limpieza beta/test

La limpieza obligatoria previa al lanzamiento público deberá realizarse únicamente después de un backup completo y validado.

Antes de ejecutarla deberá existir un procedimiento con dry-run capaz de:

1. identificar explícitamente qué usuarios beta/test serán eliminados;
2. mostrar cuántos usuarios serían eliminados sin modificar datos;
3. mostrar de forma sanitizada qué bloques pertenecen a cada usuario;
4. comprobar si existen referencias cruzadas entre usuarios;
5. abortar si aparecen relaciones no contempladas;
6. detectar sesiones persistidas asociadas a los usuarios objetivo;
7. eliminar o invalidar esas sesiones durante la ejecución real;
8. eliminar únicamente los buckets objetivo de `db.users`;
9. validar el esquema completo después de la operación;
10. conservar una copia previa recuperable antes de modificar producción;
11. verificar el resultado mediante conteos sanitizados;
12. decidir expresamente el tratamiento de backups históricos;
13. comprobar `health` y `ready` después de la operación;
14. generar un registro operativo sin contraseñas, tokens ni otros secretos.

La eliminación real de usuarios beta/test no forma parte de W9.

W9 únicamente debe dejar preparado y probado el procedimiento seguro.

## 11. Revisión futura obligatoria

Este mapa deberá revisarse antes de ejecutar la limpieza y siempre que Quacker añada estructuras como:

- followers/following;
- ratings y reviews;
- favorites;
- listas colaborativas;
- propiedad compartida;
- comentarios;
- menciones;
- actividad social;
- archivos generados por usuarios.

Estas funciones pueden introducir referencias cruzadas o nuevos almacenes de datos y dejar obsoletas las conclusiones actuales.
