"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleGeocoding, loadGoogleMaps } from "../lib/google-maps";

type AddressSelection = {
  addressText?: string;
  district?: string;
  city?: string;
  country?: string;
};

type Props = {
  latitude: number | null;
  longitude: number | null;
  city: string;
  country: string;
  onLocationChange: (latitude: number, longitude: number) => void;
  onAddressSelect: (selection: AddressSelection) => void;
};

type SearchResult = {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
  selection: AddressSelection;
};

const DEFAULT_CENTER = { lat: -14.0678, lng: -75.7286 };

function componentValue(
  components: google.maps.GeocoderAddressComponent[],
  type: string
) {
  return components.find((component) => component.types.includes(type))
    ?.long_name;
}

function buildAddressSelection(
  result: google.maps.GeocoderResult
): AddressSelection {
  const components = result.address_components ?? [];
  const street = componentValue(components, "route");
  const number = componentValue(components, "street_number");
  const district =
    componentValue(components, "sublocality") ??
    componentValue(components, "administrative_area_level_3") ??
    componentValue(components, "administrative_area_level_2");
  const city =
    componentValue(components, "locality") ??
    componentValue(components, "administrative_area_level_2");
  const country = componentValue(components, "country");

  return {
    addressText: [street, number].filter(Boolean).join(" ") || result.formatted_address,
    district,
    city,
    country,
  };
}

function selectedPosition(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return DEFAULT_CENTER;
  return { lat: latitude, lng: longitude };
}

export default function StoreLocationPicker({
  latitude,
  longitude,
  city,
  country,
  onLocationChange,
  onAddressSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const center = useMemo(
    () => selectedPosition(latitude, longitude),
    [latitude, longitude]
  );

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const [{ Map }, { Geocoder }] = await Promise.all([
          loadGoogleMaps(),
          loadGoogleGeocoding(),
        ]);

        if (!mounted || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center,
          zoom: 16,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: "Ubicacion seleccionada",
        });

        marker.addListener("dragend", () => {
          const nextPosition = marker.getPosition();
          if (!nextPosition) return;
          onLocationChange(nextPosition.lat(), nextPosition.lng());
        });

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          onLocationChange(event.latLng.lat(), event.latLng.lng());
        });

        mapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = new Geocoder();
      } catch (error) {
        const err = error as Error;
        setMessage(err.message || "No se pudo cargar Google Maps.");
      }
    }

    void initMap();

    return () => {
      mounted = false;
    };
  }, [center, onLocationChange]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;

    if (!map || !marker) return;

    marker.setPosition(center);
    map.panTo(center);
  }, [center]);

  async function handleSearchAddress() {
    const searchText = query.trim();
    if (!searchText) {
      setMessage("Escribe una direccion o calle para buscar.");
      return;
    }

    setSearching(true);
    setMessage("");

    try {
      if (!geocoderRef.current) {
        const { Geocoder } = await loadGoogleGeocoding();
        geocoderRef.current = new Geocoder();
      }

      const requestAddress = `${searchText}, ${city || "Ica"}, ${
        country || "Peru"
      }`;
      const response = await geocoderRef.current.geocode({
        address: requestAddress,
        componentRestrictions: { country: "PE" },
      });

      const nextResults = response.results
        .map((result) => {
          const location = result.geometry.location;

          return {
            placeId: result.place_id,
            label: result.formatted_address,
            latitude: location.lat(),
            longitude: location.lng(),
            selection: buildAddressSelection(result),
          };
        })
        .slice(0, 5);

      setResults(nextResults);

      if (nextResults.length === 0) {
        setMessage("No se encontraron resultados para esa direccion.");
      }
    } catch (error) {
      const err = error as Error;
      setMessage(err.message || "No se pudo buscar la direccion.");
    } finally {
      setSearching(false);
    }
  }

  function handleSelectPlace(result: SearchResult) {
    onLocationChange(result.latitude, result.longitude);
    onAddressSelect(result.selection);
    setQuery(result.label);
    setResults([]);
    setMessage("Ubicacion seleccionada desde la busqueda.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_160px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSearchAddress();
            }
          }}
          placeholder="Busca una calle, avenida o referencia"
          className="app-input"
        />

        <button
          type="button"
          onClick={() => void handleSearchAddress()}
          disabled={searching}
          className="btn-secondary disabled:opacity-60"
        >
          {searching ? "Buscando..." : "Buscar calle"}
        </button>
      </div>

      {message && <div className="info-box text-sm">{message}</div>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              onClick={() => handleSelectPlace(result)}
              className="app-card-soft block w-full p-3 text-left text-sm transition hover:brightness-95"
            >
              {result.label}
            </button>
          ))}
        </div>
      )}

      <div className="h-[300px] w-full overflow-hidden rounded-2xl bg-[#eef1f4] sm:h-[360px]">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      <p className="text-sm text-muted">
        Puedes hacer clic en el mapa o arrastrar el marcador para ajustar el
        punto exacto del local.
      </p>
    </div>
  );
}
