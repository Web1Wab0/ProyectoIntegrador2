# Activación de la expansión integral

La interfaz se despliega sin romper los flujos existentes, pero las funciones
que guardan datos nuevos requieren aplicar la migración.

## 1. Supabase

1. Abrir el SQL Editor del proyecto.
2. Ejecutar completo `supabase/comprehensive_expansion.sql`.
3. Revisar Database > Advisors > Security y confirmar que las tablas nuevas
   tienen RLS activo.
4. Para Web Push, configurar primero en Vercel los secretos requeridos y luego
   ejecutar `supabase/push_external_setup.sql` después de reemplazar los valores
   indicados mediante Supabase Vault.
5. Si una cuenta de vendedor existente no es reconocida por la analítica,
   ejecutar `supabase/fix_merchant_analytics_access.sql`. La web dispone de un
   respaldo seguro en Vercel, pero esta migración deja el diagnóstico y la
   definición de productos entregados resueltos directamente en Supabase.

## 2. Vercel

Variables públicas:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Variables privadas:

- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_DISPATCH_SECRET`
- `SUPPORT_EMAIL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Las claves VAPID ya pueden configurarse sin dominio. Resend necesita un dominio
verificado para enviar confirmaciones a correos arbitrarios. Sin esa
configuración, los formularios se guardan en Supabase y la constancia del Libro
de Reclamaciones sigue disponible para imprimir.

## 3. Recordatorios

La migración intenta crear una tarea `pg_cron` cada cinco minutos. Si la
extensión no está disponible, la migración continúa y muestra un aviso. En ese
caso puede ejecutarse manualmente:

```sql
select public.enqueue_reservation_reminders();
```

## 4. Naturaleza académica

Las páginas legales y el Libro de Reclamaciones son demostrativos. Deben ser
revisados profesionalmente antes de utilizar AhorraPe como empresa formal.
