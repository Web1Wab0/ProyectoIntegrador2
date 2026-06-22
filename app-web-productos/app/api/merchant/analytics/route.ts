import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ReservationItemRow = {
  quantity: number;
  subtotal: number;
  store_products:
    | {
        products:
          | { product_name: string }
          | Array<{ product_name: string }>
          | null;
      }
    | Array<{
        products:
          | { product_name: string }
          | Array<{ product_name: string }>
          | null;
      }>
    | null;
};

type ReservationRow = {
  id: string;
  pickup_code: string;
  status: string;
  total_amount: number;
  reserved_at: string;
  pickup_at: string | null;
  reservation_items: ReservationItemRow[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function limaDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function limaHour(value: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value))
  );
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requestUrl = new URL(request.url);
  const fromValue = requestUrl.searchParams.get("from");
  const toValue = requestUrl.searchParams.get("to");
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;

  if (!token) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  if (
    !from ||
    !to ||
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      { error: "El rango de fechas no es válido." },
      { status: 400 }
    );
  }

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "La analítica segura no está configurada." },
      { status: 503 }
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: "La sesión no es válida o ha expirado." },
      { status: 401 }
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (businessError || !business) {
    return NextResponse.json(
      { error: "No se encontró el negocio del vendedor." },
      { status: businessError ? 500 : 404 }
    );
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeError || !store) {
    return NextResponse.json(
      { error: "No se encontró la tienda del vendedor." },
      { status: storeError ? 500 : 404 }
    );
  }

  const [eventsResponse, reservationsResponse, calendarResponse] =
    await Promise.all([
      supabase
        .from("store_events")
        .select("event_type, created_at")
        .eq("store_id", store.id)
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .limit(5000),
      supabase
        .from("reservations")
        .select(
          `
            id,
            pickup_code,
            status,
            total_amount,
            reserved_at,
            pickup_at,
            reservation_items (
              quantity,
              subtotal,
              store_products:store_product_id (
                products:product_id (product_name)
              )
            )
          `
        )
        .eq("store_id", store.id)
        .gte("reserved_at", from.toISOString())
        .lt("reserved_at", to.toISOString())
        .limit(5000),
      supabase
        .from("reservations")
        .select("id, pickup_code, status, total_amount, pickup_at")
        .eq("store_id", store.id)
        .not("pickup_at", "is", null)
        .gte("pickup_at", from.toISOString())
        .lt("pickup_at", to.toISOString())
        .order("pickup_at", { ascending: true })
        .limit(5000),
    ]);

  const queryError =
    eventsResponse.error ||
    reservationsResponse.error ||
    calendarResponse.error;

  if (queryError) {
    console.error("Merchant analytics fallback query failed.", queryError);
    return NextResponse.json(
      { error: "No se pudieron calcular las métricas." },
      { status: 500 }
    );
  }

  const events = eventsResponse.data ?? [];
  const reservations =
    ((reservationsResponse.data ?? []) as unknown as ReservationRow[]);
  const completedReservations = reservations.filter(
    (reservation) => reservation.status === "completed"
  );
  const cancelled = reservations.filter(
    (reservation) => reservation.status === "cancelled"
  ).length;
  const estimatedRevenue = completedReservations.reduce(
    (total, reservation) => total + Number(reservation.total_amount ?? 0),
    0
  );

  const dailyMap = new Map<
    string,
    { day: string; visits: number; reservations: number }
  >();
  for (
    let cursor = new Date(from);
    cursor < to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const day = limaDate(cursor);
    dailyMap.set(day, { day, visits: 0, reservations: 0 });
  }

  events.forEach((event) => {
    if (event.event_type !== "store_view") return;
    const day = limaDate(event.created_at);
    const current = dailyMap.get(day);
    if (current) current.visits += 1;
  });
  reservations.forEach((reservation) => {
    const day = limaDate(reservation.reserved_at);
    const current = dailyMap.get(day);
    if (current) current.reservations += 1;
  });

  const products = new Map<
    string,
    { product_name: string; quantity: number; amount: number }
  >();
  completedReservations.forEach((reservation) => {
    (reservation.reservation_items ?? []).forEach((item) => {
      const storeProduct = first(item.store_products);
      const product = first(storeProduct?.products);
      const name = product?.product_name ?? "Producto";
      const current = products.get(name) ?? {
        product_name: name,
        quantity: 0,
        amount: 0,
      };
      current.quantity += Number(item.quantity ?? 0);
      current.amount += Number(item.subtotal ?? 0);
      products.set(name, current);
    });
  });

  const peakHours = new Map<number, number>();
  reservations.forEach((reservation) => {
    if (!reservation.pickup_at) return;
    const hour = limaHour(reservation.pickup_at);
    peakHours.set(hour, (peakHours.get(hour) ?? 0) + 1);
  });

  return NextResponse.json({
    store_views: events.filter((event) => event.event_type === "store_view")
      .length,
    product_views: events.filter(
      (event) => event.event_type === "product_view"
    ).length,
    reservations: reservations.length,
    estimated_revenue: estimatedRevenue,
    cancelled,
    daily_series: Array.from(dailyMap.values()),
    top_products: Array.from(products.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    peak_hours: Array.from(peakHours.entries())
      .sort(([left], [right]) => left - right)
      .map(([hour, reservationCount]) => ({
        hour,
        reservations: reservationCount,
      })),
    calendar: calendarResponse.data ?? [],
  });
}
