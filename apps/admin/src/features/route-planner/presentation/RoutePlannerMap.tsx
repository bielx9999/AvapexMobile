import { useEffect, useRef, useState } from 'react';
import { ensureGoogleMaps, googleMapsMapId } from '../../../core/googleMaps/googleMapsLoader';
import type { RouteTemplatePoint } from '../../shared/domain/models';

type RoutePlannerMapProps = {
  addingVia: boolean;
  onMapClick: (latitude: number, longitude: number) => void;
  path: Array<{ latitude: number; longitude: number }>;
  points: RouteTemplatePoint[];
};

const brazilCenter = { lat: -15.78, lng: -47.93 };

export function RoutePlannerMap({ addingVia, onMapClick, path, points }: RoutePlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const [error, setError] = useState('');

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await ensureGoogleMaps(['maps', 'marker']);
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
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : 'Erro ao carregar o mapa.');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      markersRef.current.forEach((marker) => { marker.map = null; });
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
    if (path.length > 1) {
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
  }, [path, points]);

  if (error) {
    return <div className="flex h-full min-h-[520px] items-center justify-center bg-zinc-100 p-6 text-center text-sm font-medium text-red-700">{error}</div>;
  }
  return (
    <div className={`relative h-full min-h-[520px] overflow-hidden bg-zinc-100 ${addingVia ? 'cursor-crosshair' : ''}`}>
      <div className="h-full min-h-[520px] w-full" ref={containerRef} />
      {addingVia ? <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-lg">Clique no mapa para adicionar o ponto VIA</div> : null}
    </div>
  );
}
