import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

type GoogleMapsLibrary = 'geocoding' | 'geometry' | 'maps' | 'marker' | 'routes';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
export const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';
let configured = false;

export async function ensureGoogleMaps(libraries: GoogleMapsLibrary[]) {
  if (!apiKey) {
    throw new Error('Configure VITE_GOOGLE_MAPS_API_KEY para utilizar os mapas.');
  }
  if (!configured) {
    setOptions({
      key: apiKey,
      language: 'pt-BR',
      region: 'BR',
      v: 'weekly',
    });
    configured = true;
  }
  await Promise.all(libraries.map((library) => importLibrary(library)));
}
