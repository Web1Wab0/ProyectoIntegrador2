"use client";

import { useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type AddressSelection = {
  addressText?: string;
  district?: string;
  city?: string;
  country?: string;
};

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
};

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

type Props = {
  latitude: number | null;
  longitude: number | null;
  city: string;
  country: string;
  onLocationChange: (latitude: number, longitude: number) => void;
  onAddressSelect: (selection: AddressSelection) => void;
};

const DEFAULT_CENTER: [number, number] = [-14.0678, -75.7286];

function buildAddressSelection(place: NominatimPlace): AddressSelection {
  const address = place.address ?? {};
  const street = address.road ?? address.pedestrian ?? address.footway;
  const addressText = [street, address.house_number].filter(Boolean).join(" ");

  return {
    addressText: addressText || place.display_name,
    district: address.suburb ?? address.city_district ?? address.district,
    city: address.city ?? address.town ?? address.village ?? address.state,
    country: address.country,
  };
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom(), { animate: true });
  return null;
}

function ClickToSelect({
  onLocationChange,
}: {
  onLocationChange: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onLocationChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function StoreLocationPicker({
  latitude,
  longitude,
  city,
  country,
  onLocationChange,
  onAddressSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const center = useMemo<[number, number]>(() => {
    if (latitude !== null && longitude !== null) return [latitude, longitude];
    return DEFAULT_CENTER;
  }, [latitude, longitude]);

  async function handleSearchAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const searchText = query.trim();
    if (!searchText) {
      setMessage("Escribe una direccion o calle para buscar.");
      return;
    }

    setSearching(true);
    setMessage("");

    const params = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: "5",
      countrycodes: "pe",
      q: `${searchText}, ${city || "Ica"}, ${country || "Peru"}`,
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("No se pudo buscar la direccion.");
      }

      const places = (await response.json()) as NominatimPlace[];
      setResults(places);

      if (places.length === 0) {
        setMessage("No se encontraron resultados para esa direccion.");
      }
    } catch (error) {
      const err = error as Error;
      setMessage(err.message || "No se pudo buscar la direccion.");
    } finally {
      setSearching(false);
    }
  }

  function handleSelectPlace(place: NominatimPlace) {
    const nextLat = Number(place.lat);
    const nextLng = Number(place.lon);

    if (Number.isNaN(nextLat) || Number.isNaN(nextLng)) {
      setMessage("El resultado no tiene coordenadas validas.");
      return;
    }

    onLocationChange(nextLat, nextLng);
    onAddressSelect(buildAddressSelection(place));
    setQuery(place.display_name);
    setResults([]);
    setMessage("Ubicacion seleccionada desde la busqueda.");
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearchAddress}
        className="grid gap-3 md:grid-cols-[1fr_160px]"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una calle, avenida o referencia"
          className="app-input"
        />

        <button
          type="submit"
          disabled={searching}
          className="btn-secondary disabled:opacity-60"
        >
          {searching ? "Buscando..." : "Buscar calle"}
        </button>
      </form>

      {message && <div className="info-box text-sm">{message}</div>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((place) => (
            <button
              key={place.place_id}
              type="button"
              onClick={() => handleSelectPlace(place)}
              className="app-card-soft block w-full p-3 text-left text-sm transition hover:brightness-95"
            >
              {place.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="h-[360px] w-full overflow-hidden rounded-2xl">
        <MapContainer
          center={center}
          zoom={16}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <RecenterMap center={center} />
          <ClickToSelect onLocationChange={onLocationChange} />

          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <CircleMarker
            center={center}
            radius={10}
            pathOptions={{
              color: "#f97316",
              fillColor: "#fb923c",
              fillOpacity: 0.85,
              weight: 3,
            }}
          >
            <Popup>Ubicacion seleccionada</Popup>
          </CircleMarker>
        </MapContainer>
      </div>

      <p className="text-sm text-muted">
        Tambien puedes hacer clic directamente en el mapa para ajustar el punto
        exacto del local.
      </p>
    </div>
  );
}
