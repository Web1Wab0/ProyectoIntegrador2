"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import type { StoreOpeningHours } from "../lib/store-hours";

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
  opening_hours?: StoreOpeningHours;
};

type StoreCategory = {
  category_id: string | null;
  category_name: string;
  product_count: number;
};

type NearbyStore = {
  store_id: string;
  store_name: string;
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
  onSelectStore?: (store: NearbyStore) => void | Promise<void>;
};

export default function SearchMap({
  userLat,
  userLng,
  results,
  stores = [],
  selectedStoreId = null,
  onSelectStore,
}: Props) {
  return (
    <div className="h-[320px] w-full overflow-hidden rounded-2xl sm:h-[420px]">
      <MapContainer
        center={[userLat, userLng]}
        zoom={15}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <CircleMarker
          center={[userLat, userLng]}
          radius={10}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#60a5fa",
            fillOpacity: 0.75,
            weight: 2,
          }}
        >
          <Popup>Tu ubicacion</Popup>
        </CircleMarker>

        {stores.map((store) => {
          const selected = store.store_id === selectedStoreId;

          return (
            <CircleMarker
              key={store.store_id}
              center={[store.latitude, store.longitude]}
              radius={selected ? 12 : 9}
              pathOptions={{
                color: selected ? "#f97316" : "#059669",
                fillColor: selected ? "#fb923c" : "#10b981",
                fillOpacity: selected ? 0.85 : 0.65,
                weight: selected ? 3 : 2,
              }}
            >
              <Popup>
                <div className="space-y-2">
                  <strong>{store.store_name}</strong>
                  <div>{store.address_text}</div>
                  <div>{Math.round(store.distance_meters)} m</div>
                  <div>{store.product_count} productos disponibles</div>

                  {onSelectStore && (
                    <button
                      type="button"
                      onClick={() => onSelectStore(store)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Ver productos
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {results.map((item) => (
          <CircleMarker
            key={item.store_product_id}
            center={[item.latitude, item.longitude]}
            radius={7}
            pathOptions={{
              color: "#7c3aed",
              fillColor: "#8b5cf6",
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-1">
                <strong>{item.product_name}</strong>
                <div>{item.store_name}</div>
                <div>S/ {Number(item.price).toFixed(2)}</div>
                <div>{Math.round(item.distance_meters)} m</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
