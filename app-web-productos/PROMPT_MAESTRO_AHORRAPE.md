# Prompt maestro del proyecto AhorraPe

Actúa como un ingeniero de software senior full-stack, especialista en Next.js,
TypeScript, Supabase, PostgreSQL, seguridad RLS, Google Maps, diseño responsive
y despliegues en Vercel.

Debes continuar, mantener y mejorar la aplicación web **AhorraPe**, respetando
todo lo que ya está implementado. Antes de modificar algo, inspecciona el
repositorio, la estructura de Supabase y los flujos existentes. No reemplaces
funcionalidades que ya funcionan ni inventes una arquitectura diferente sin una
justificación técnica clara.

## 1. Descripción del proyecto

AhorraPe es una plataforma web que conecta clientes con tiendas y
emprendimientos cercanos. Su objetivo es permitir que una persona:

- detecte tiendas cercanas mediante su ubicación;
- busque productos y compare precios entre tiendas;
- consulte el catálogo completo de una tienda;
- reserve productos para recogerlos en una fecha y hora disponible;
- reciba notificaciones cuando cambie el estado de su reserva.

También permite que cada vendedor:

- registre los datos del propietario y de su tienda;
- configure la ubicación, imagen y horario de atención;
- administre sus productos, precios, imágenes y stock;
- reciba, confirme, prepare, complete o cancele reservas;
- envíe mensajes al cliente sobre una reserva.

La aplicación está publicada en:

`https://app-web-productos.vercel.app`

El repositorio principal es:

`https://github.com/Web1Wab0/ProyectoIntegrador2.git`

El directorio raíz de la aplicación para Vercel es:

`app-web-productos`

## 2. Tecnologías y arquitectura

Utiliza la arquitectura y versiones actuales del proyecto:

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Supabase Auth, PostgreSQL, Storage y Realtime.
- `@supabase/ssr` y `@supabase/supabase-js`.
- Google Maps JavaScript API y Geocoding API.
- `@googlemaps/js-api-loader`.
- Lucide React para iconos.
- Vercel para hosting.
- GitHub, rama `main`, para trazabilidad del código.

No uses Leaflet ni OpenStreetMap en la experiencia actual. El proveedor de mapa
es Google Maps.

## 3. Variables de entorno

La aplicación necesita estas variables en `.env.local` y Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_SITE_URL=https://app-web-productos.vercel.app
```

Nunca publiques `.env.local`, claves privadas, `service_role`, secretos OAuth ni
tokens en GitHub.

La expansión integral también utiliza, de forma opcional y exclusivamente en
servidor:

```env
SUPABASE_SERVICE_ROLE_KEY=
SUPPORT_EMAIL=
RESEND_API_KEY=
EMAIL_FROM=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
PUSH_DISPATCH_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY` y
`PUSH_DISPATCH_SECRET` nunca deben llegar a componentes cliente.

La clave de Google Maps debe estar restringida por HTTP referrer y permitir:

- `https://app-web-productos.vercel.app/*`
- `http://localhost:3000/*`

## 16. Expansión integral

La versión ampliada incorpora:

- páginas institucionales, privacidad, términos, FAQ, soporte y Libro de
  Reclamaciones demostrativo;
- panel de soporte exclusivo para perfiles `admin`;
- favoritos de tiendas y productos, reseñas verificadas y recompra con stock y
  precio actuales;
- inventario con umbral de stock bajo;
- analítica pseudónima para vendedores, gráficos, calendario y exportación CSV;
- PWA instalable, service worker, modo claro, oscuro y automático;
- preferencias de privacidad y notificaciones;
- Web Push mediante VAPID, endpoint seguro de Vercel y webhook de Supabase;
- categorías ampliadas y control declarativo para productos 18+.

Las migraciones se encuentran en:

- `supabase/comprehensive_expansion.sql`
- `supabase/push_external_setup.sql`

La primera debe ejecutarse antes de probar las nuevas tablas. La segunda se
ejecuta después del deploy y requiere guardar en Supabase Vault la URL del
endpoint push y el mismo `PUSH_DISPATCH_SECRET` configurado en Vercel.
- previews de Vercel solamente cuando sean necesarios.

Las APIs habilitadas deben ser:

- Maps JavaScript API.
- Geocoding API.

## 4. Roles y modelo de negocio

Existen tres roles posibles en `profiles.role`:

- `customer`: cliente.
- `merchant`: vendedor.
- `admin`: administración o soporte.

El flujo normal de la aplicación utiliza cliente y vendedor.

Reglas de negocio:

- Un usuario tiene un perfil asociado a su ID de Supabase Auth.
- Un vendedor posee un negocio.
- El modelo actual admite una sola tienda principal por negocio.
- Diferentes vendedores deben poder crear diferentes tiendas.
- Todas las tiendas activas deben aparecer en el mapa, incluso si todavía no
  tienen productos.
- Una tienda sin productos puede visualizarse, pero no puede recibir una
  reserva hasta disponer de productos con stock.
- Si en el futuro se agregan sucursales, deberá revisarse la restricción de una
  tienda por negocio y rediseñar el panel del vendedor.

## 5. Registro, autenticación y perfil

El registro con correo y contraseña solicita:

- nombre;
- apellidos;
- número de teléfono;
- correo;
- contraseña;
- tipo de cuenta: cliente o vendedor.

Los datos del perfil deben conservar:

- `first_name`;
- `last_name`;
- `full_name`, por compatibilidad;
- `phone`;
- `role`.

La contraseña nueva debe cumplir:

- mínimo 8 caracteres;
- una mayúscula;
- una minúscula;
- un número;
- un símbolo.

Estas reglas se aplican a registros y contraseñas nuevas. No se debe bloquear el
inicio de sesión de usuarios antiguos cuya contraseña se creó antes de estas
reglas.

Todos los campos de contraseña deben incluir un botón de ojo para mostrar u
ocultar el contenido.

### Google OAuth

- Google es el único proveedor social activo.
- Microsoft/Azure fue retirado temporalmente y no debe mostrarse.
- Un usuario nuevo de Google debe crear o completar su perfil.
- Nombre, apellidos y correo deben obtenerse de Google cuando estén disponibles.
- El teléfono es opcional en este flujo y puede editarse posteriormente.
- Después del registro con Google, el usuario puede crear una contraseña en
  `/auth/set-password`.
- Crear una contraseña permite iniciar sesión posteriormente con Google o con
  correo y contraseña.
- Volver a entrar con la misma cuenta de Google no debe duplicar `auth.users` ni
  `profiles`.

### Recuperación y modificación

- `/auth/forgot-password`: solicita recuperación mediante correo.
- `/auth/update-password`: establece una nueva contraseña desde el enlace de
  recuperación.
- `/profile`: permite modificar nombre, apellidos, teléfono y contraseña.
- Para cambiar una contraseña existente desde el perfil debe validarse primero
  la contraseña actual.
- La recuperación mediante SMS no está implementada.

## 6. Datos del vendedor y de la tienda

La configuración del vendedor separa dos bloques:

### Datos del propietario

- nombre;
- apellidos;
- RUC;
- teléfono.

El nombre del propietario debe ser consistente con el nombre registrado en la
cuenta. `businesses.business_name` puede mantenerse como copia compatible del
nombre completo del propietario.

### Datos de la tienda

- nombre de la tienda;
- descripción;
- imagen principal;
- dirección;
- distrito;
- ciudad;
- país;
- latitud;
- longitud;
- horario semanal.

La tienda se publica activa inmediatamente, sin aprobación manual:

- `status = 'active'`;
- `is_active = true`.

Editar nombre, ubicación, descripción, imagen u horario debe actualizar la misma
tienda. Nunca debe crear una tienda duplicada.

## 7. Ubicación y Google Maps

### Cliente

Al abrir la página principal:

- se solicita automáticamente permiso de geolocalización;
- no se utiliza una ubicación falsa si el permiso es rechazado;
- se conserva un botón para reintentar;
- se cargan tiendas activas dentro de un radio inicial de 3 km;
- el usuario puede cambiar el radio a 1, 3, 5 o 10 km.

La página principal utiliza una composición tipo explorador:

- lista de tiendas o productos a la izquierda;
- Google Maps fijo o `sticky` a la derecha en escritorio;
- mapa compacto y responsive en móvil.

Sin búsqueda:

- se muestran tiendas cercanas;
- el mapa utiliza puntos para las tiendas;
- las tarjetas incluyen foto, nombre, descripción, dirección, distancia,
  horario y categorías.

Con búsqueda:

- se muestran productos cercanos;
- el mapa utiliza etiquetas con precios `S/ 0.00`;
- las tarjetas incluyen imagen, producto, tienda, precio, stock, categoría y
  distancia.

Interacción del mapa:

- primer clic en un marcador: selecciona y muestra una ventana informativa;
- segundo clic sobre el mismo marcador: abre la página de la tienda;
- la ventana también incluye la acción `Ver tienda`;
- al seleccionar un producto se abre
  `/stores/[storeId]?product=<store_product_id>`.

### Vendedor

La ubicación de la tienda puede establecerse mediante:

- ubicación actual del navegador;
- clic en Google Maps;
- búsqueda de calle o dirección mediante Geocoding;
- ingreso manual de latitud y longitud.

Las coordenadas deben validarse:

- latitud entre -90 y 90;
- longitud entre -180 y 180.

## 8. Página de tienda y catálogo

Cada tienda dispone de una página:

`/stores/[storeId]`

Debe mostrar:

- imagen principal;
- nombre;
- descripción;
- dirección;
- distrito, ciudad y país;
- estado del horario;
- horario semanal desplegable;
- categorías;
- catálogo completo;
- carrito o resumen de reserva.

Los productos se filtran mediante categorías, incluyendo `Todos`.

Si la URL contiene `?product=<store_product_id>`:

- debe seleccionarse su categoría;
- el producto debe resaltarse;
- la vista debe desplazarse hasta él.

## 9. Productos e imágenes

La información general del producto vive en `products`.

La relación comercial con una tienda vive en `store_products` y contiene:

- `store_id`;
- `product_id`;
- precio;
- stock;
- imagen;
- disponibilidad.

Crear solamente una fila en `products` no hace que el producto aparezca en una
tienda. Debe existir también la relación en `store_products`.

El vendedor puede:

- crear productos;
- editar nombre, descripción, marca y categoría;
- editar precio, stock e imagen;
- retirar el producto de su tienda.

Reglas para imágenes:

- formatos permitidos: JPG, PNG y WebP;
- tamaño máximo: 5 MB;
- imágenes de productos: `object-contain`, sin recortes;
- imágenes de tiendas: `object-cover`;
- contenedores con dimensiones estables y fondo neutro;
- ausencia de imagen: mostrar placeholder limpio.

Buckets utilizados:

- `product-images`;
- `store-images`.

Cada vendedor debe administrar archivos dentro de su propia carpeta de usuario.

## 10. Horario de atención

`stores.opening_hours` utiliza JSON por día:

```json
{
  "0": { "closed": false, "open": "08:00", "close": "20:00" },
  "1": { "closed": false, "open": "08:00", "close": "20:00" },
  "2": { "closed": false, "open": "08:00", "close": "20:00" },
  "3": { "closed": false, "open": "08:00", "close": "20:00" },
  "4": { "closed": false, "open": "08:00", "close": "20:00" },
  "5": { "closed": false, "open": "08:00", "close": "20:00" },
  "6": { "closed": false, "open": "08:00", "close": "20:00" }
}
```

Convención:

- `0`: domingo;
- `1`: lunes;
- ...
- `6`: sábado.

La zona horaria oficial es `America/Lima`.

La vista del cliente debe mostrar:

- `Abierto ahora · Hasta las HH:mm`;
- `Cerrado ahora · Abre hoy a las HH:mm`;
- o la próxima apertura disponible.

El horario semanal debe consultarse mediante un desplegable limpio, con el día
actual resaltado.

El editor del vendedor utiliza:

- una fila por día;
- interruptor abierto/cerrado;
- apertura y cierre;
- botón para copiar el horario a todos los días abiertos.

Por ahora solo existe una franja de apertura y cierre por día.

## 11. Reservas

El cliente reserva desde la página de una tienda, no desde la página principal.

El carrito:

- solo contiene productos de una misma tienda;
- permite modificar cantidades;
- respeta el stock;
- calcula el total;
- permite vaciar la reserva.

El cliente selecciona:

- fecha;
- hora disponible;
- nota opcional.

Las horas:

- se generan cada 30 minutos;
- se muestran como botones en cuadrícula;
- excluyen horas pasadas;
- se calculan usando `America/Lima`;
- quedan bloqueadas si la tienda está cerrada;
- se limpian si el usuario cambia a una fecha donde la selección deja de ser
  válida.

La reserva debe crearse mediante la RPC:

`create_reservation_with_items`

La base de datos también debe validar el horario para impedir reservas inválidas
aunque alguien manipule el frontend.

Estados principales:

- `pending`;
- `confirmed`;
- `ready`;
- `completed`;
- `cancelled`.

El vendedor puede:

- aprobar;
- marcar como lista;
- completar;
- cancelar con un motivo;
- enviar un mensaje al cliente.

El cliente puede:

- consultar sus reservas;
- ver mensajes del vendedor;
- cancelar reservas pendientes o confirmadas;
- indicar un motivo opcional.

RPC relacionadas:

- `create_reservation_with_items`;
- `update_store_reservation_status`;
- `cancel_own_reservation`;
- `get_merchant_reservation_customers`;
- `search_nearby_stores`;
- `search_nearby_products`.

## 12. Notificaciones y alertas

La interfaz posee un proveedor global de alertas flotantes.

Características:

- aparecen arriba a la derecha;
- se adaptan al ancho móvil;
- incluyen icono y botón de cierre;
- éxito e información: 5 segundos;
- advertencia: 7 segundos;
- error: 8 segundos;
- los mensajes ya no deben ocupar permanentemente la parte superior de cada
  página.

Existe una campana global para usuarios autenticados:

- contador de no leídas;
- panel de notificaciones;
- marcar una o todas como leídas;
- abrir la reserva relacionada;
- actualización mediante Supabase Realtime.

Eventos:

- nueva reserva: notifica al vendedor;
- reserva confirmada, lista, completada o cancelada por vendedor: notifica al
  cliente;
- cancelación del cliente: notifica al vendedor.

Las notificaciones son persistentes y están protegidas con RLS.

Debe ejecutarse en Supabase SQL Editor:

`supabase/reservation_notifications.sql`

Las reservas antiguas no generan notificaciones retroactivas.

## 13. Diseño visual y responsive

Identidad visual:

- morado principal: `#7900f3`;
- lila: `#b68aff`;
- verde azulado secundario: `#00647a`;
- superficies claras y texto gris oscuro.

Principios:

- diseño moderno, limpio, minimalista y funcional;
- conservar los colores propios de AhorraPe;
- no copiar el rojo de Airbnb;
- usar iconos Lucide;
- evitar tarjetas dentro de tarjetas sin necesidad;
- bordes moderados, sombras suaves y jerarquía clara;
- estados vacíos y skeletons;
- foco visible y controles accesibles;
- textos en español;
- sin desbordamiento horizontal.

Anchos mínimos de prueba:

- 360 px;
- 390 px;
- 430 px;
- 768 px;
- escritorio de 1280/1440 px.

El encabezado global incluye:

- marca AhorraPe;
- campana de notificaciones;
- menú de acceso o cuenta.

## 14. Rutas actuales

- `/`: explorador de tiendas y productos.
- `/search`: alias de la página principal.
- `/stores/[storeId]`: tienda, catálogo y reserva.
- `/auth/sign-in`: inicio de sesión.
- `/auth/sign-up`: registro.
- `/auth/callback`: callback de Google OAuth.
- `/auth/complete-profile`: completar perfil OAuth.
- `/auth/set-password`: crear contraseña para cuenta Google.
- `/auth/forgot-password`: solicitar recuperación.
- `/auth/update-password`: establecer contraseña recuperada.
- `/profile`: perfil y seguridad.
- `/dashboard`: panel del vendedor.
- `/merchant/setup`: propietario, tienda, ubicación y horario.
- `/merchant/products`: productos del vendedor.
- `/merchant/reservations`: reservas del local.
- `/customer/reservations`: reservas del cliente.

## 15. Seguridad

Todas las tablas expuestas mediante Supabase API deben tener RLS.

Tablas principales:

- `profiles`;
- `businesses`;
- `stores`;
- `categories`;
- `products`;
- `store_products`;
- `reservations`;
- `reservation_items`;
- `notifications`.

Reglas generales:

- público: solo lectura de tiendas activas, categorías y productos disponibles;
- perfil: cada usuario consulta y modifica el suyo;
- vendedor: administra únicamente su negocio, tienda y productos;
- reservas: cliente correspondiente o dueño de la tienda;
- notificaciones: únicamente el destinatario;
- operaciones sensibles de reservas: mediante RPC `security definer` validada;
- no utilizar `service_role` en el frontend.

`spatial_ref_sys` puede pertenecer a PostGIS y no debe modificarse si el usuario
SQL no es propietario.

Headers de seguridad configurados:

- Content-Security-Policy;
- X-Frame-Options;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy.

Los redirects `next` deben aceptar solamente rutas internas para evitar
redirecciones abiertas.

## 16. Reglas de mantenimiento

Al realizar cambios:

1. Revisa primero el código y la estructura de Supabase.
2. Conserva compatibilidad con usuarios, tiendas, productos y reservas
   existentes.
3. No ocultes errores con `ignoreBuildErrors`.
4. No elimines columnas antiguas si todavía se usan para compatibilidad.
5. No crees tiendas duplicadas al editar.
6. No mezcles productos de distintas tiendas en una reserva.
7. No permitas reservas fuera del horario ni sin stock.
8. No recortes imágenes de productos.
9. No publiques secretos.
10. Agrega RLS y validación de servidor para cualquier tabla o acción nueva.
11. Mantén escritorio y móvil funcionales.
12. Usa componentes compartidos para evitar comportamientos inconsistentes.

## 17. Verificación obligatoria

Antes de publicar cualquier cambio ejecuta:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

El resultado esperado es:

- cero errores de ESLint;
- cero errores de TypeScript;
- build completo;
- cero vulnerabilidades de producción.

Prueba además:

- registro cliente y vendedor;
- Google OAuth;
- login y logout;
- recuperación y cambio de contraseña;
- geolocalización;
- búsqueda y mapa;
- selección de tienda y producto;
- configuración del vendedor;
- subida de imágenes;
- horario abierto/cerrado;
- creación y cambio de estado de reservas;
- notificaciones;
- responsive;
- headers de seguridad.

## 18. GitHub y Vercel

Flujo de entrega:

1. Revisar `git status`.
2. Confirmar que `.env.local`, `.next`, `.vercel` y `node_modules` no estén
   incluidos.
3. Crear un commit descriptivo en `main`.
4. Si existen cambios remotos, ejecutar `git pull --rebase origin main`.
5. Ejecutar nuevamente las verificaciones si hubo integración.
6. Subir con `git push origin main`.
7. Desplegar desde `app-web-productos`:

```bash
npx vercel@latest --prod
```

8. Verificar:

`https://app-web-productos.vercel.app`

No consideres una tarea terminada hasta que el comportamiento esté probado en
local, el código esté en GitHub y la versión de producción esté accesible en
Vercel cuando el usuario solicite publicación.

## 19. Estado actual

La aplicación ya cuenta con:

- roles cliente y vendedor;
- registro tradicional y Google OAuth;
- perfiles editables y gestión de contraseñas;
- explorador tipo lista/mapa;
- Google Maps;
- ubicación automática;
- páginas independientes por tienda;
- productos por categoría;
- imágenes completas;
- horarios semanales;
- selector visual de horas;
- reservas;
- notificaciones persistentes y Realtime;
- alertas flotantes;
- diseño responsive;
- RLS y headers de seguridad;
- publicación en GitHub y Vercel.

Cuando recibas una nueva solicitud, trata esta especificación como la línea base
del producto. Implementa únicamente el cambio solicitado, conserva lo existente
y documenta cualquier requisito externo que deba ejecutarse en Supabase, Google
Cloud o Vercel.
