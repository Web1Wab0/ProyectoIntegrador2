# AhorraPe

Aplicación web Next.js para buscar tiendas cercanas, comparar productos en mapa y reservar productos para recojo.

## Variables de entorno

Configura estas variables en `.env.local` y en Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

La clave de Google Maps debe tener habilitadas las APIs:

- Maps JavaScript API
- Geocoding API

En producción restringe la clave por HTTP referrer, por ejemplo:

```text
https://app-web-productos.vercel.app/*
http://localhost:3000/*
```

## Supabase

Antes de probar la versión con foto de tienda y mapa tipo Airbnb, ejecuta en Supabase SQL Editor:

```text
supabase/store_images_and_google_maps.sql
```

Ese SQL agrega `stores.image_url`, crea el bucket público `store-images`, configura políticas de Storage y actualiza `search_nearby_stores`.

## Comandos

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

## Deploy

El proyecto está preparado para Vercel con root directory `app-web-productos`.

Si usas CLI:

```bash
npx vercel login
npx vercel --prod
```
