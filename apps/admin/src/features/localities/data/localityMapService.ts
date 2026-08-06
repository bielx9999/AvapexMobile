import { ensureGoogleMaps } from '../../../core/googleMaps/googleMapsLoader';

export async function geocodeLocalityAddress(address: string) {
  const query = address.trim();
  if (!query) {
    throw new Error('Informe endereco, cidade e UF para buscar no mapa.');
  }
  await ensureGoogleMaps(['geocoding']);
  const geocoder = new google.maps.Geocoder();
  const response = await geocoder.geocode({ address: query, region: 'BR' });
  const result = response.results[0];
  if (!result) {
    throw new Error('Nenhuma coordenada encontrada para o endereco informado.');
  }
  return {
    latitude: result.geometry.location.lat(),
    longitude: result.geometry.location.lng(),
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}
