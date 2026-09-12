# Comunicación de Quacker

Esta guía define la voz y los criterios visuales de Quacker para comunicaciones futuras.

Su objetivo durante Semana 9 es preparar la infraestructura editorial y visual. No autoriza todavía promoción pública del producto.

## Gate de lanzamiento

Quacker no debe iniciar promoción pública, campañas de captación ni publicaciones orientadas a atraer usuarios reales hasta completar la fase pre-lanzamiento correspondiente.

Antes de esa apertura debe ejecutarse, como mínimo:

1. backup completo y validado;
2. limpieza controlada de usuarios beta/test;
3. comprobación de datos asociados y sesiones;
4. validación posterior de producción.

La preparación de textos, plantillas y capturas puede realizarse antes. Su publicación pública no.

## Tono de voz

Quacker debe sonar:

- cercano;
- claro;
- útil;
- ligeramente juguetón;
- seguro de sí mismo sin parecer corporativo;
- con humor absurdo ocasional relacionado con el pato o con situaciones del producto.

La información importante siempre va antes que el chiste.

En botones, errores, confirmaciones, privacidad, seguridad o acciones destructivas se prioriza la claridad. El humor no debe dificultar entender qué ha ocurrido o qué tiene que hacer el usuario.

## Humor

El humor es una capa de personalidad, no el contenido principal.

Puede utilizarse especialmente en:

- notas de actualización;
- estados vacíos;
- páginas especiales como 404;
- publicaciones sociales;
- pequeños mensajes de celebración;
- campañas futuras.

Debe evitarse cuando pueda restar claridad a:

- errores críticos;
- pérdida de datos;
- autenticación;
- privacidad;
- pagos;
- eliminación de contenido;
- instrucciones operativas.

Ejemplos del tono permitido:

> Hemos arreglado cosas. Algunas incluso las habíamos roto nosotros. 🦆

> Quacker se ha puesto el casco.

> Este pato se ha salido de la ruta.

No es necesario incluir un chiste, un pato o un emoji en cada comunicación.

## Notas de versión

`docs/RELEASE_NOTES.md` es el registro técnico de cada release.

Debe incluir:

- motivo de la versión;
- cambios relevantes;
- restricciones o decisiones de seguridad;
- validación realizada;
- versión publicada;
- conservación de tags anteriores cuando corresponda.

Las notas técnicas no deben transformarse en copy de marketing.

## “Qué hay de nuevo”

“Qué hay de nuevo” es la versión resumida y orientada al usuario de una release.

Cada versión debe contener:

- un título breve con personalidad;
- entre 2 y 4 cambios comprensibles para una persona no técnica;
- lenguaje centrado en el beneficio;
- ningún dato interno sensible;
- ninguna referencia innecesaria a infraestructura, secretos, rutas, servidores o implementación.

Ejemplo de estructura:

**Título**

Una frase corta reconocible como Quacker.

**Cambios**

- qué mejora para el usuario;
- qué resulta ahora más cómodo o fiable;
- algún pequeño detalle de personalidad si encaja.

La versión mostrada debe corresponder siempre con la versión real activa de la aplicación.

## Capturas

Las capturas maestras actuales del repositorio utilizan:

- formato PNG;
- resolución 2940 × 1912 px;
- interfaz real de Quacker;
- encuadre consistente entre secciones.

Mientras no exista una razón de producto para cambiarlo, las nuevas capturas maestras deben mantener ese formato.

### Criterios visuales

Las capturas deben:

- mostrar una sola idea principal;
- utilizar estados representativos del producto;
- evitar modales, toasts o elementos accidentales que no formen parte de la historia que se quiere enseñar;
- mantener una escala y encuadre coherentes;
- cuidar que la navegación y el contenido relevante sean legibles;
- utilizar modo claro u oscuro según la pieza, sin modificar artificialmente la interfaz;
- conservar una copia maestra sin textos promocionales superpuestos.

Para publicaciones futuras podrán generarse derivados recortados o adaptados a cada formato social a partir de la captura maestra.

### Privacidad

Nunca deben aparecer en capturas públicas:

- correos reales;
- identificadores de usuarios;
- tokens;
- credenciales;
- datos personales;
- información de sesiones;
- rutas internas sensibles;
- información privada de usuarios beta/test.

Cuando sea necesario mostrar datos de uso, deben emplearse cuentas y contenido preparados específicamente para demostración.

## Estructura de publicaciones futuras

Quacker podrá utilizar distintas piezas, pero deberían compartir una estructura sencilla:

### Actualización de producto

1. frase de apertura;
2. qué ha cambiado;
3. por qué le importa al usuario;
4. captura o demostración;
5. remate breve de personalidad;
6. CTA solo cuando exista una acción real que tenga sentido.

Ejemplo de esquema:

> Hemos arreglado cosas. Algunas incluso las habíamos roto nosotros. 🦆
>
> [Resumen de la mejora]
>
> [Qué cambia para quien usa Quacker]
>
> [Captura]
>
> [CTA, si procede]

### Presentación de una función

1. problema o situación reconocible;
2. función de Quacker que lo resuelve;
3. demostración visual;
4. ejemplo concreto de uso;
5. CTA.

### Lanzamiento

El lanzamiento público deberá explicar primero qué es Quacker:

> Un lugar para organizar lo que ves, lees y juegas.

Después:

1. propuesta de valor;
2. principales tipos de contenido;
3. funciones más importantes;
4. capturas;
5. acceso al producto;
6. personalidad de Quacker sin convertir el anuncio en un meme.

### Comunicación de incidencias

Las incidencias no utilizan humor si pueden afectar a datos o acceso.

La estructura será:

1. qué ocurre;
2. a quién puede afectar;
3. qué estamos haciendo;
4. estado actual;
5. confirmación cuando quede resuelto.

## Idioma

La interfaz y las comunicaciones pueden existir en español e inglés.

El contenido no debe traducirse palabra por palabra cuando el resultado pierda naturalidad. Se conserva intención, claridad y personalidad.

La documentación técnica y de proyecto se mantiene en español salvo que exista una razón concreta para utilizar otro idioma.

## Principio general

Quacker puede tener personalidad sin dejar de ser útil.

Primero debe entenderse el mensaje.

Después puede entrar el pato.
