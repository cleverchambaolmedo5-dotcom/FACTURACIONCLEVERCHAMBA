# CleverChamba — Sistema de Ventas, Pagos y Comprobantes

Sistema interno para el control de ventas, cuotas, pagos y comprobantes de una
academia en Ecuador.

> Estado actual: **base del proyecto + modelo de datos + autenticación +
> layout/navegación + módulos de Clientes, Ventas, Pagos y Comprobantes**.
> Cuotas (como pantalla propia), Productos, Cuentas bancarias, Usuarios y
> Configuración siguen siendo pantallas temporales sin lógica ni consultas
> reales.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma ORM](https://www.prisma.io) 7 sobre PostgreSQL
- PostgreSQL local vía [Docker Compose](https://docs.docker.com/compose/) para desarrollo (`docker-compose.yml`); en producción puede apuntar a cualquier Postgres administrado (p. ej. [Supabase](https://supabase.com))

## Primeros pasos

1. Copia `.env.example` a `.env` (los valores por defecto ya sirven para el Postgres local de Docker).
2. Levanta la base de datos local:

   ```bash
   docker compose up -d
   ```

3. Instala las dependencias:

   ```bash
   npm install
   ```

4. Aplica el esquema a la base de datos:

   ```bash
   npx prisma migrate dev --name init
   ```

5. Define `SEED_DEFAULT_PASSWORD` en tu `.env` y carga los datos iniciales:

   ```bash
   npm run db:seed
   ```

6. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

7. Abre [http://localhost:3000](http://localhost:3000).

## Base de datos local (Docker)

`docker-compose.yml` define un servicio `postgres` (contenedor
`facturacion-postgres`) con la base `facturacion_cleverchamba`, usuario y
contraseña `postgres`, expuesto en el puerto `5433` del host (el 5432 ya
estaba ocupado por otro servicio; internamente el contenedor sigue usando
5432) y con un volumen
(`postgres_data`) para persistir los datos entre reinicios.

```bash
docker compose up -d      # iniciar la base de datos en segundo plano
docker compose ps         # ver el estado del contenedor
docker compose down       # detenerlo (los datos persisten en el volumen)
docker compose down -v    # detenerlo y borrar también los datos
```

## Prisma

El esquema vive en `prisma/schema.prisma` y la conexión se configura en
`prisma.config.ts`. `DATABASE_URL` es la que usa la app en runtime (a través
del driver adapter en `src/lib/prisma.ts`) y `DIRECT_URL` es la que usan los
comandos del CLI (`migrate`, `db pull`, `studio`). En local, con Docker
Compose, ambas apuntan a la misma instancia; en producción, detrás de un
pooler de conexiones, `DIRECT_URL` sería la conexión directa (sin pooler).
El cliente generado se emite en `src/generated/prisma` (ignorado por git) y
se importa desde `@/lib/prisma`.

```bash
npx prisma generate   # regenerar el cliente tras editar el schema
npx prisma migrate dev --name <nombre>   # crear y aplicar una migración
```

El modelo de datos ya está implementado: `User`, `Customer`, `Product`,
`BankAccount`, `Sale`, `Installment`, `Payment`, `PaymentReceipt` y
`Notification`, con sus enums correspondientes (`UserRole`, `UserStatus`,
`ProductType`, `SaleStatus`, `InstallmentStatus`, `PaymentValidationStatus`,
`PaymentMethod`, `NotificationType`). `Product.name` tiene una restricción
`UNIQUE` (cada producto del catálogo debe tener un nombre distinto).
`Customer.assignedSellerId` (obligatorio, con índice) referencia al `User`
(rol `SELLER`) responsable de ese cliente. Módulos como Cuentas bancarias y
Alertas todavía no tienen pantallas, solo su modelo de datos.

## Datos iniciales (seed)

`prisma/seed.ts` carga los 6 productos y 4 usuarios de desarrollo (uno por
rol, más un vendedor extra) definidos en la etapa de datos iniciales. Es
idempotente: puede ejecutarse varias veces sin duplicar productos ni
usuarios — los productos existentes se actualizan (precio, tipo, activo) y
los usuarios existentes se conservan tal cual, sin tocar su `passwordHash`.

Requiere `SEED_DEFAULT_PASSWORD` en `.env` (contraseña de desarrollo para
los usuarios nuevos, hasheada con bcrypt antes de guardarse; nunca se
imprime en consola ni se guarda en texto plano). Si falta, el seed se
detiene con un error explicativo.

```bash
npm run db:seed   # equivalente a: npx tsx prisma/seed.ts
```

## Autenticación

Login con email/contraseña, sesiones persistidas en PostgreSQL (modelo
`Session`) y cookie `HttpOnly` (`cc_session`, 7 días, `SameSite=Lax`,
`secure` solo en producción). El token original vive únicamente en la
cookie; en la base de datos solo se guarda su hash SHA-256
(`Session.tokenHash`, único).

- `src/lib/auth/config.ts` — nombre de cookie, duración y opciones, centralizados.
- `src/lib/auth/session.ts` — generación/verificación de sesión (`getCurrentUser()`).
- `src/lib/auth/password.ts` — verificación de contraseña con bcrypt.
- `src/lib/auth/rbac.ts` — tabla de permisos por módulo y rol (`MODULE_ACCESS`) + etiquetas de rol (`ROLE_LABELS`), preparada para el filtrado de datos de SELLER que se implementará junto con los módulos de ventas/clientes/pagos.
- `src/lib/auth/guards.ts` — helpers `requireUser()` / `requireModuleAccess()` para proteger páginas del lado del servidor.
- `src/lib/auth/actions.ts` — Server Actions `login` y `logout`.
- `src/proxy.ts` — protege toda la app excepto `/login` (política de denegar por defecto, no una lista de rutas a mantener) y redirige `/login` → `/dashboard` cuando ya hay sesión (en Next.js 16 este archivo reemplaza a `middleware.ts`).
- `/login` — página pública, sin layout administrativo.

## Layout y navegación

Toda la app autenticada vive bajo el route group `src/app/(app)/`, que
comparte un layout con Sidebar + Header (`src/components/layout/`). El
menú se genera desde una única fuente centralizada
(`src/config/navigation.ts`: id, nombre, ruta e icono por módulo) filtrada
por el RBAC existente — un módulo sin permiso simplemente no aparece en el
menú, pero cada página además verifica el permiso en el servidor
(`requireModuleAccess()`), y accesos directos por URL a un módulo no
permitido redirigen a `/acceso-denegado`.

Identidad visual centralizada como tokens CSS en `src/app/globals.css`
(vía `@theme` de Tailwind 4): azul eléctrico (`primary`) para acciones,
azul oscuro/marino (`sidebar`) para la barra lateral, fondo claro
(`background`), tarjetas blancas (`surface`) y colores semánticos
(`success`/`warning`/`error`) para futuros estados financieros
(`StatusBadge` en `src/components/ui/`).

## Módulo de Clientes

Primer módulo de negocio implementado por completo (`/clientes`,
`/clientes/nuevo`, `/clientes/[id]/editar`). Cada cliente tiene un
`assignedSeller` (vendedor responsable) obligatorio. Un SELLER solo ve,
busca y edita sus propios clientes (filtrado en el servidor, nunca solo
visual) y nunca puede elegir ni cambiar el vendedor responsable —
un ADMIN/ACCOUNTANT sí, entre los usuarios `SELLER` con `status=ACTIVE`.

Arquitectura: `src/app/(app)/clientes/` (páginas + `actions.ts`) →
`src/server/services/customer-service.ts` (permisos + validación) →
`src/server/repositories/customer-repository.ts` (consultas Prisma).
Componentes visuales en `src/components/customers/`. Validación de
formularios con funciones simples reutilizables (`src/lib/validation.ts`),
sin dependencias nuevas.

## Módulo de Ventas

`/ventas`, `/ventas/nueva`, `/ventas/[id]`. Una venta fija el precio del
producto al momento de la venta (`Sale.originalPrice`/`discount`/
`finalPrice`, snapshot que nunca cambia aunque después cambie
`Product.officialPrice`) y se reparte en 1 a 3 cuotas (`Installment`), cada
una con su propio monto y fecha de vencimiento definidos en el formulario
de creación. Un SELLER solo ve y crea sus propias ventas (y solo para
clientes ya asignados a él); ADMIN/ACCOUNTANT ven todas y pueden elegir
cualquier vendedor. El detalle de una venta (`/ventas/[id]`) muestra sus
cuotas con el mismo cálculo de saldo/estado que el módulo de Pagos (ver
abajo).

Arquitectura: `src/app/(app)/ventas/` (páginas + `actions.ts`) →
`src/server/services/sale-service.ts` (permisos, validación de
descuento/cuotas) → `src/server/repositories/sale-repository.ts`
(consultas Prisma). Componentes en `src/components/sales/`.

## Módulo de Pagos y Comprobantes

`/pagos` lista las cuotas (`Installment`) de todas las ventas visibles
para el usuario, con su saldo pendiente calculado en tiempo real; desde el
detalle de una cuota (`/pagos/[id]`) se registra un pago (monto, fecha,
método, referencia/observaciones opcionales y un comprobante adjunto
opcional: PDF/JPG/PNG/WEBP hasta 5 MB, guardado en
`public/uploads/payment-receipts/`). Todo pago nace en estado
`PENDING_VALIDATION` y **no** reduce el saldo de la cuota hasta que sea
aprobado — así, dos registros o dos aprobaciones concurrentes contra la
misma cuota nunca pueden sobrepasarla (la lectura del saldo y la escritura
del pago ocurren dentro de una transacción `SERIALIZABLE`, con reintento
automático ante conflicto).

`/comprobantes` (solo ADMIN/ACCOUNTANT — un SELLER no tiene acceso a este
módulo) lista los pagos pendientes de validar; desde el detalle de un pago
(`/comprobantes/[id]`) se aprueba o rechaza (el rechazo exige un motivo).
Aprobar un pago recién ahí lo suma al total pagado de la cuota y
recalcula su estado (`PENDING` → `PARTIALLY_PAID`/`PAID`, o `OVERDUE` si
ya venció); rechazarlo lo deja fuera del cálculo permanentemente, con el
motivo visible en el historial.

Arquitectura compartida (Pagos y Comprobantes usan el mismo servicio, ya
que ambos giran sobre `Installment`/`Payment`):
`src/app/(app)/pagos/` y `src/app/(app)/comprobantes/` (páginas +
`actions.ts` propios) → `src/server/services/payment-service.ts`
(permisos, cálculo de totales/saldo/estado, transiciones de validación) →
`src/server/repositories/payment-repository.ts` (consultas Prisma) +
`src/server/services/receipt-storage.ts` (validación y guardado del
archivo de comprobante en disco). Componentes en
`src/components/payments/`.

## Estructura de carpetas

```
src/
  proxy.ts        Protección de rutas (reemplaza a middleware.ts en Next 16)
  app/            Rutas de Next.js (App Router)
    login/        Página de inicio de sesión (sin layout administrativo)
    (app)/        Route group: dashboard + todos los módulos, con Sidebar/Header
      layout.tsx      Auth check + cálculo de módulos permitidos
      dashboard/
      clientes/       page.tsx, actions.ts, nuevo/, [id]/editar/
      ventas/         page.tsx, actions.ts, nueva/, [id]/
      pagos/          page.tsx, actions.ts, [id]/ (detalle de cuota + registrar pago)
      comprobantes/   page.tsx, actions.ts, [id]/ (validar pagos: aprobar/rechazar)
      cuotas/ productos/ cuentas-bancarias/ usuarios/ configuracion/
      acceso-denegado/
    api/          Route handlers de la API
  components/
    ui/           Componentes de UI genéricos (module-placeholder, status-badge)
    layout/       Sidebar, header, navegación móvil, menú de usuario
    customers/    Tabla, buscador, formulario y estado vacío de Clientes
    sales/        Formulario de venta, tabla, filtros y selector de cliente
    payments/     Registro de pago, historial, tabla/panel de validación
    shared/       Componentes compartidos específicos del dominio
  config/
    site.ts         Nombre y branding de la app
    navigation.ts    Fuente única del menú (id, nombre, ruta, icono)
  hooks/          Custom React hooks
  lib/
    prisma.ts     Cliente Prisma (singleton)
    utils.ts      Helper cn() para clases Tailwind
    validation.ts Validadores simples reutilizables (email, uuid)
    auth/         Sesión, contraseñas, permisos, guards y Server Actions de auth
  server/
    services/     Lógica de negocio y permisos (customer-service.ts, sale-service.ts,
                  payment-service.ts, receipt-storage.ts, ...)
    repositories/ Acceso a datos (consultas Prisma encapsuladas)
  types/          Tipos compartidos que no vienen de Prisma
prisma/
  schema.prisma   Esquema de la base de datos
  seed.ts         Datos iniciales (productos + usuarios de desarrollo)
  migrations/     Historial de migraciones versionadas
```

Roles: `ADMIN`, `ACCOUNTANT`, `SELLER`. Módulos implementados por completo:
Dashboard, Clientes, Ventas, Pagos, Comprobantes. Con ruta y pantalla
temporal: Cuotas, Productos, Cuentas bancarias, Usuarios, Configuración.
Alertas y Reportes siguen siendo módulos futuros sin ruta todavía.
