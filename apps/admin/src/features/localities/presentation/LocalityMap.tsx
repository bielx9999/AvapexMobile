import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { ensureGoogleMaps, googleMapsMapId } from '../../../core/googleMaps/googleMapsLoader';

type LocalityMapProps = {
  latitude: number | null;
  longitude: number | null;
  onPositionChange: (latitude: number, longitude: number) => void;
};

const brazilCenter = { lat: -15.7797, lng: -47.9297 };

export function LocalityMap({ latitude, longitude, onPositionChange }: LocalityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  const initialPositionRef = useRef(coordinate(latitude, longitude));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    let disposed = false;
    let mapClickListener: google.maps.MapsEventListener | null = null;
    let dragListener: google.maps.MapsEventListener | null = null;

    ensureGoogleMaps(['maps', 'marker'])
      .then(() => {
        if (disposed || !containerRef.current) {
          return;
        }
        const savedPosition = initialPositionRef.current;
        const initialPosition = savedPosition ?? brazilCenter;
        const map = new google.maps.Map(containerRef.current, {
          center: initialPosition,
          clickableIcons: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          mapId: googleMapsMapId,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: savedPosition ? 15 : 4,
        });
        const marker = new google.maps.marker.AdvancedMarkerElement({
          gmpDraggable: true,
          map: savedPosition ? map : undefined,
          position: initialPosition,
          title: 'Localidade. Arraste para ajustar.',
        });
        const pin = new google.maps.marker.PinElement({
          background: '#facc15',
          borderColor: '#18181b',
          glyphColor: '#18181b',
          glyphText: 'L',
        });
        marker.append(pin);
        mapClickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
          const point = event.latLng;
          if (point) {
            onPositionChangeRef.current(point.lat(), point.lng());
          }
        });
        dragListener = marker.addListener('dragend', () => {
          const point = marker.position;
          if (point) {
            const literal = new google.maps.LatLng(point);
            onPositionChangeRef.current(literal.lat(), literal.lng());
          }
        });
        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o mapa.');
        }
      });

    return () => {
      disposed = true;
      mapClickListener?.remove();
      dragListener?.remove();
      if (markerRef.current) {
        markerRef.current.map = null;
      }
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const position = coordinate(latitude, longitude);
    if (!ready || !mapRef.current || !markerRef.current || !position) {
      return;
    }
    markerRef.current.position = position;
    markerRef.current.map = mapRef.current;
    mapRef.current.panTo(position);
    mapRef.current.setZoom(15);
  }, [latitude, longitude, ready]);

  return (
    <div className="relative h-72 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <div className="h-full w-full" ref={containerRef} />
      {!ready && !error ? <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Carregando mapa...</div> : null}
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-zinc-100 p-5 text-center text-sm text-zinc-600">
          <span><MapPin className="mx-auto mb-2" size={24} />{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function coordinate(latitude: number | null, longitude: number | null): google.maps.LatLngLiteral | null {
  const valid = typeof latitude === 'number'
    && typeof longitude === 'number'
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
  return valid ? { lat: latitude, lng: longitude } : null;
}
