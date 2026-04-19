"use client";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";

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
};

type Props = {
  userLat: number;
  userLng: number;
  results: SearchResult[];
};

export default function SearchMap({ userLat, userLng, results }: Props) {
  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl">
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

        <CircleMarker center={[userLat, userLng]} radius={10}>
          <Popup>Tu ubicación</Popup>
        </CircleMarker>

        {results.map((item) => (
          <CircleMarker
            key={item.store_product_id}
            center={[item.latitude, item.longitude]}
            radius={8}
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