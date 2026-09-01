import { useEffect, useRef, useState } from 'react';
import { ensureGoogleMaps, googleMapsMapId } from '../../../core/googleMaps/googleMapsLoader';
import type { RouteTemplatePoint } from '../../shared/domain/models';

type RoutePlannerMapProps = {
  addingVia: boolean;
  canEdit: boolean;
  onMapClick: (latitude: number, longitude: number) => void;
  onRouteDrag: (viaPoints: Array<{ latitude: number; longitude: number }>) => void;
  path: Array<{ latitude: number; longitude: number }>;
  points: RouteTemplatePoint[];
};

const brazilCenter = { lat: -15.78, lng: -47.93 };

export function RoutePlannerMap({ addingVia, canEdit, onMapClick, onRouteDrag, path, points }: RoutePlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const directionsListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onRouteDragRef = useRef(onRouteDrag);
  const suppressDirectionsChangeRef = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onRouteDragRef.current = onRouteDrag;
  }, [onRouteDrag]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await ensureGoogleMaps(['maps', 'marker', 'routes']);
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: brazilCenter,
          zoom: 4,
          mapId: googleMapsMapId,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          gestureHandling: 'greedy',
        });
        clickListenerRef.current = mapRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          onMapClickRef.current(event.latLng.lat(), event.latLng.lng());
        });
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          draggable: true,
          map: mapRef.current,
          preserveViewport: true,
          suppressMarkers: true,
        });
        directionsListenerRef.current = directionsRendererRef.current.addListener('directions_changed', () => {
          if (suppressDirectionsChangeRef.current) return;
          const directions = directionsRendererRef.current?.getDirections();
          const viaPoints = extractDraggedViaPoints(directions);
          if (viaPoints.length > 0) {
            onRouteDragRef.current(viaPoints);
          }
        });
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : 'Erro ao carregar o mapa.');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      directionsListenerRef.current?.remove();
      markersRef.current.forEach((marker) => { marker.map = null; });
      directionsRendererRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === 'undefined') return;

    markersRef.current.forEach((marker) => { marker.map = null; });
    markersRef.current = points.map((point, index) => {
      const pin = new google.maps.marker.PinElement({
        background: point.type === 'via' ? '#ffffff' : point.type === 'stop' ? '#18181b' : '#ffcf24',
        borderColor: '#18181b',
        glyph: point.type === 'via' ? 'V' : `${index + 1}`,
        glyphColor: point.type === 'stop' ? '#ffffff' : '#18181b',
        scale: point.type === 'origin' || point.type === 'destination' ? 1.1 : 0.9,
      });
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: point.latitude, lng: point.longitude },
        title: `${point.reference} - ${point.city}/${point.uf}`,
      });
      marker.append(pin);
      return marker;
    });

    polylineRef.current?.setMap(null);
    const origin = points.find((point) => point.type === 'origin');
    const destination = points.find((point) => point.type === 'destination');
    if (origin && destination && directionsServiceRef.current && directionsRendererRef.current) {
      suppressDirectionsChangeRef.current = true;
      directionsRendererRef.current.setOptions({ draggable: canEdit, preserveViewport: true, suppressMarkers: true });
      directionsServiceRef.current.route(
        {
          destination: coordinate(destination),
          origin: coordinate(origin),
          travelMode: google.maps.TravelMode.DRIVING,
          waypoints: points
            .filter((point) => point.type === 'stop' || point.type === 'via')
            .map((point) => ({
              location: coordinate(point),
              stopover: point.type !== 'via',
            })),
        },
        (result, status) => {
          suppressDirectionsChangeRef.current = false;
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);
            return;
          }
          setError('O Google Maps nao conseguiu desenhar o percurso editavel.');
        },
      );
    } else {
      directionsRendererRef.current?.set('directions', null);
    }

    if ((!origin || !destination) && path.length > 1) {
      polylineRef.current = new google.maps.Polyline({
        map,
        path: path.map((point) => ({ lat: point.latitude, lng: point.longitude })),
        strokeColor: '#18181b',
        strokeOpacity: 0.92,
        strokeWeight: 5,
      });
    }

    const bounds = new google.maps.LatLngBounds();
    (path.length ? path : points).forEach((point) => {
      bounds.extend({
        lat: 'latitude' in point ? point.latitude : 0,
        lng: 'longitude' in point ? point.longitude : 0,
      });
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  }, [canEdit, path, points]);

  if (error) {
    return <div className="flex h-full min-h-[520px] items-center justify-center bg-zinc-100 p-6 text-center text-sm font-medium text-red-700">{error}</div>;
  }
  return (
    <div className={`relative h-full min-h-[520px] overflow-hidden bg-zinc-100 ${addingVia ? 'cursor-crosshair' : ''}`}>
      <div className="h-full min-h-[520px] w-full" ref={containerRef} />
      {canEdit && points.length > 1 ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-zinc-700 shadow-lg ring-1 ring-zinc-200">
          Puxe o tracado da rota para criar desvios no percurso.
        </div>
      ) : null}
      {addingVia ? <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-lg">Clique no mapa para adicionar o ponto VIA</div> : null}
    </div>
  );
}

function coordinate(point: RouteTemplatePoint): google.maps.LatLngLiteral {
  return { lat: point.latitude, lng: point.longitude };
}

function extractDraggedViaPoints(directions: google.maps.DirectionsResult | null | undefined) {
  const route = directions?.routes?.[0];
  if (!route?.legs?.length) {
    return [];
  }
  return route.legs
    .flatMap((leg) => leg.via_waypoints ?? [])
    .map((point) => ({ latitude: point.lat(), longitude: point.lng() }));
}
