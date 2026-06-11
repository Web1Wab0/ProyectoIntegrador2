"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let optionsConfigured = false;

export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

function ensureGoogleMapsOptions() {
  const key = getGoogleMapsApiKey();

  if (!key) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para cargar Google Maps."
    );
  }

  if (!optionsConfigured) {
    setOptions({
      key,
      language: "es",
      region: "PE",
    });
    optionsConfigured = true;
  }
}

export async function loadGoogleMaps() {
  ensureGoogleMapsOptions();
  const maps = (await importLibrary("maps")) as google.maps.MapsLibrary;
  await importLibrary("marker");
  return maps;
}

export async function loadGoogleGeocoding() {
  ensureGoogleMapsOptions();
  return (await importLibrary("geocoding")) as google.maps.GeocodingLibrary;
}
