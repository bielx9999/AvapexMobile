import { ensureGoogleMaps } from '../../../core/googleMaps/googleMapsLoader';
import type { RouteTemplatePoint, RouteVersionDefinition } from '../../shared/domain/models';

export async function calculateRoadRoute(points: RouteTemplatePoint[]): Promise<Omit<RouteVersionDefinition, 'version'>> {
  const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
  const origin = orderedPoints[0];
  const destination = orderedPoints.at(-1);
  if (!origin || !destination || origin.type !== 'origin' || destination.type !== 'destination') {
    throw new Error('Informe uma origem e um destino validos para calcular a rota.');
  }
  if (orderedPoints.length - 2 > 25) {
    throw new Error('A rota aceita no maximo 25 pontos intermediarios.');
  }

  await ensureGoogleMaps(['routes', 'geometry']);
  const response = await google.maps.routes.Route.computeRoutes({
    origin: coordinate(origin),
    destination: coordinate(destination),
    intermediates: orderedPoints.slice(1, -1).map((point) => ({
      location: coordinate(point),
      via: point.type === 'via',
    })),
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_UNAWARE',
    polylineQuality: 'HIGH_QUALITY',
    fields: ['distanceMeters', 'durationMillis', 'path', 'viewport'],
  });
  const route = response.routes?.[0];
  if (!route?.path?.length) {
    throw new Error('O Google Maps nao encontrou um trajeto rodoviario entre os pontos informados.');
  }

  const path = route.path.map((point) => ({ latitude: point.lat, longitude: point.lng }));
  return {
    points: orderedPoints.map((point, sequence) => ({ ...point, sequence })),
    locationIds: orderedPoints.map((point) => point.locationId).filter(Boolean),
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: Math.round((route.durationMillis ?? 0) / 1000),
    encodedPolyline: google.maps.geometry.encoding.encodePath(path.map((point) => ({ lat: point.latitude, lng: point.longitude }))),
    path,
  };
}

function coordinate(point: RouteTemplatePoint): google.maps.LatLngLiteral {
  return { lat: point.latitude, lng: point.longitude };
}
