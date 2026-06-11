"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StoreOpeningHours } from "../lib/store-hours";
import { loadGoogleMaps } from "../lib/google-maps";

type SearchResult = {
  store_product_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  brand: string | null;
  category_name: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  store_id: string;
  store_name: string;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  opening_hours: StoreOpeningHours;
};

type StoreCategory = {
  category_id: string | null;
  category_name: string;
  product_count: number;
};

type NearbyStore = {
  store_id: string;
  store_name: string;
  description: string | null;
  image_url: string | null;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  product_count: number;
  categories: StoreCategory[];
  opening_hours: StoreOpeningHours;
};

type Props = {
  userLat: number;
  userLng: number;
  results: SearchResult[];
  stores?: NearbyStore[];
  selectedStoreId?: string | null;
  selectedResultId?: string | null;
  onSelectStore?: (store: NearbyStore) => void;
  onSelectResult?: (result: SearchResult) => void;
};

function svgUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createStoreIcon(selected: boolean) {
  const fill = selected ? "#ff385c" : "#111827";
  const stroke = selected ? "#ffffff" : "#ffffff";
  const size = selected ? 36 : 30;

  return {
    url: svgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="4" fill="#ffffff"/>
      </svg>
    `),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function createUserIcon() {
  return {
    url: svgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" fill="#2563eb" stroke="#ffffff" stroke-width="4"/>
        <circle cx="17" cy="17" r="5" fill="#bfdbfe"/>
      </svg>
    `),
    scaledSize: new google.maps.Size(34, 34),
    anchor: new google.maps.Point(17, 17),
  };
}

function createPriceIcon(price: number, selected: boolean) {
  const text = `S/ ${Number(price).toFixed(2)}`;
  const width = Math.max(72, text.length * 9 + 24);
  const fill = selected ? "#111827" : "#ffffff";
  const textFill = selected ? "#ffffff" : "#111827";
  const stroke = selected ? "#111827" : "#d1d5db";

  return {
    url: svgUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="38" viewBox="0 0 ${width} 38">
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.18"/>
        </filter>
        <rect x="2" y="4" width="${width - 4}" height="28" rx="14" fill="${fill}" stroke="${stroke}" filter="url(#shadow)"/>
        <text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="${textFill}">${text}</text>
      </svg>
    `),
    scaledSize: new google.maps.Size(width, 38),
    anchor: new google.maps.Point(width / 2, 19),
  };
}

export default function SearchMap({
  userLat,
  userLng,
  results,
  stores = [],
  selectedStoreId = null,
  selectedResultId = null,
  onSelectStore,
  onSelectResult,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const visibleResults = useMemo(() => {
    if (results.length === 0) return [];

    const byStore = new Map<string, SearchResult>();

    results.forEach((result) => {
      const current = byStore.get(result.store_id);
      if (!current || Number(result.price) < Number(current.price)) {
        byStore.set(result.store_id, result);
      }
    });

    return Array.from(byStore.values());
  }, [results]);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const { Map } = await loadGoogleMaps();

        if (!mounted || !containerRef.current) return;

        mapRef.current = new Map(containerRef.current, {
          center: { lat: userLat, lng: userLng },
          zoom: 14,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }],
            },
          ],
        });
        setReady(true);
      } catch (mapError) {
        const err = mapError as Error;
        setError(err.message || "No se pudo cargar Google Maps.");
      }
    }

    void initMap();

    return () => {
      mounted = false;
    };
  }, [userLat, userLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const userPosition = { lat: userLat, lng: userLng };

    const userMarker = new google.maps.Marker({
      position: userPosition,
      map,
      title: "Tu ubicacion",
      icon: createUserIcon(),
      zIndex: 20,
    });
    markersRef.current.push(userMarker);
    bounds.extend(userPosition);

    if (visibleResults.length > 0) {
      visibleResults.forEach((result) => {
        const position = {
          lat: Number(result.latitude),
          lng: Number(result.longitude),
        };
        const selected = result.store_product_id === selectedResultId;
        const marker = new google.maps.Marker({
          position,
          map,
          title: `${result.product_name} - ${result.store_name}`,
          icon: createPriceIcon(Number(result.price), selected),
          optimized: false,
          zIndex: selected ? 40 : 30,
        });

        marker.addListener("click", () => onSelectResult?.(result));
        markersRef.current.push(marker);
        bounds.extend(position);
      });
    } else {
      stores.forEach((store) => {
        const position = {
          lat: Number(store.latitude),
          lng: Number(store.longitude),
        };
        const selected = store.store_id === selectedStoreId;
        const marker = new google.maps.Marker({
          position,
          map,
          title: store.store_name,
          icon: createStoreIcon(selected),
          optimized: false,
          zIndex: selected ? 35 : 25,
        });

        marker.addListener("click", () => onSelectStore?.(store));
        markersRef.current.push(marker);
        bounds.extend(position);
      });
    }

    if (markersRef.current.length > 1) {
      map.fitBounds(bounds, 64);
    } else {
      map.setCenter(userPosition);
      map.setZoom(14);
    }
  }, [
    onSelectResult,
    onSelectStore,
    ready,
    selectedResultId,
    selectedStoreId,
    stores,
    userLat,
    userLng,
    visibleResults,
  ]);

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-3xl bg-[#eef1f4]">
      {error ? (
        <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm text-muted">
          {error}
        </div>
      ) : (
        <>
          <div ref={containerRef} className="h-full min-h-[320px] w-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-muted">
              Cargando mapa...
            </div>
          )}
        </>
      )}
    </div>
  );
}
