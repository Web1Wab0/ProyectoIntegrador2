import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "El diagnóstico seguro del vendedor no está configurado." },
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Merchant setup status profile query failed.", profileError);
    return NextResponse.json(
      { error: "No se pudo validar el perfil." },
      { status: 500 }
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (businessError) {
    console.error("Merchant setup status business query failed.", businessError);
    return NextResponse.json(
      { error: "No se pudo validar el negocio." },
      { status: 500 }
    );
  }

  if (!business) {
    return NextResponse.json({
      user_role: profile?.role ?? null,
      business_id: null,
      store_id: null,
      store_name: null,
      store_status: null,
      store_is_active: false,
      product_count: 0,
      reservation_count: 0,
      completed_reservation_count: 0,
      completed_units: 0,
    });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, store_name, status, is_active")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeError) {
    console.error("Merchant setup status store query failed.", storeError);
    return NextResponse.json(
      { error: "No se pudo validar la tienda." },
      { status: 500 }
    );
  }

  if (!store) {
    return NextResponse.json({
      user_role: profile?.role ?? null,
      business_id: business.id,
      store_id: null,
      store_name: null,
      store_status: null,
      store_is_active: false,
      product_count: 0,
      reservation_count: 0,
      completed_reservation_count: 0,
      completed_units: 0,
    });
  }

  const [
    productResponse,
    reservationResponse,
    completedReservationResponse,
    completedItemsResponse,
  ] = await Promise.all([
    supabase
      .from("store_products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", "completed"),
    supabase
      .from("reservation_items")
      .select(
        "quantity, reservations!inner(store_id, status)"
      )
      .eq("reservations.store_id", store.id)
      .eq("reservations.status", "completed"),
  ]);

  const countError =
    productResponse.error ||
    reservationResponse.error ||
    completedReservationResponse.error ||
    completedItemsResponse.error;

  if (countError) {
    console.error("Merchant setup status count query failed.", countError);
    return NextResponse.json(
      { error: "No se pudo calcular el progreso de la tienda." },
      { status: 500 }
    );
  }

  const completedUnits = (completedItemsResponse.data ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0),
    0
  );

  return NextResponse.json({
    user_role: profile?.role ?? null,
    business_id: business.id,
    store_id: store.id,
    store_name: store.store_name,
    store_status: store.status,
    store_is_active: store.is_active === true,
    product_count: productResponse.count ?? 0,
    reservation_count: reservationResponse.count ?? 0,
    completed_reservation_count: completedReservationResponse.count ?? 0,
    completed_units: completedUnits,
  });
}
