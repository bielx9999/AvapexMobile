import { Activity, Eye, Layers, Maximize } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
type MapStyle = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
type SelectedLocation = { latitude: number; longitude: number };

export function RoutePlannerMap({ addingVia, canEdit, onMapClick, onRouteDrag, path, points }: RoutePlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const directionsListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onRouteDragRef = useRef(onRouteDrag);
  const addingViaRef = useRef(addingVia);
  const suppressDirectionsChangeRef = useRef(false);
  const skipNextRouteRequestRef = useRef(false);
  const skipNextFitRef = useRef(false);
  const routeRequestKeyRef = useRef('');
  const fitKeyRef = useRef('');
  const dragSyncTimeoutRef = useRef<number | null>(null);
  const routeRequestTimeoutRef = useRef<number | null>(null);
  const routeRequestIdRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('roadmap');
  const [trafficVisible, setTrafficVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [error, setError] = useState('');
  const pointKey = useMemo(() => points.map((point) => `${point.id}:${point.type}:${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`).join('|'), [points]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onRouteDragRef.current = onRouteDrag;
  }, [onRouteDrag]);

  useEffect(() => {
    addingViaRef.current = addingVia;
  }, [addingVia]);

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
          fullscreenControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
          streetViewControl: true,
          streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          zoomControl: true,
          scaleControl: true,
          clickableIcons: false,
          keyboardShortcuts: true,
          gestureHandling: 'greedy',
        });
        infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 300 });
        trafficLayerRef.current = new google.maps.TrafficLayer();
        clickListenerRef.current = mapRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          const latitude = event.latLng.lat();
          const longitude = event.latLng.lng();
          onMapClickRef.current(latitude, longitude);
          if (addingViaRef.current) return;
          setSelectedLocation({ latitude, longitude });
          const content = createLocationInfo({ latitude, longitude });
          infoWindowRef.current?.setContent(content);
          infoWindowRef.current?.setPosition(event.latLng);
          infoWindowRef.current?.open({ map: mapRef.current });
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
            if (dragSyncTimeoutRef.current !== null) window.clearTimeout(dragSyncTimeoutRef.current);
            dragSyncTimeoutRef.current = window.setTimeout(() => {
              skipNextRouteRequestRef.current = true;
              skipNextFitRef.current = true;
              onRouteDragRef.current(viaPoints);
              dragSyncTimeoutRef.current = null;
            }, 180);
          }
        });
        setMapReady(true);
      } catch (mapError) {
        setError(mapError instanceof Error ? mapError.message : 'Erro ao carregar o mapa.');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      directionsListenerRef.current?.remove();
      if (dragSyncTimeoutRef.current !== null) window.clearTimeout(dragSyncTimeoutRef.current);
      if (routeRequestTimeoutRef.current !== null) window.clearTimeout(routeRequestTimeoutRef.current);
      routeRequestIdRef.current += 1;
      markersRef.current.forEach((marker) => { marker.map = null; });
      directionsRendererRef.current?.setMap(null);
      infoWindowRef.current?.close();
      trafficLayerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || typeof google === 'undefined') return;

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
        gmpClickable: true,
      });
      marker.append(pin);
      marker.addEventListener('gmp-click', () => {
        setSelectedLocation({ latitude: point.latitude, longitude: point.longitude });
        infoWindowRef.current?.setContent(createLocationInfo(point));
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      return marker;
    });

  }, [mapReady, points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.setMapTypeId(mapStyle);
  }, [mapReady, mapStyle]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !trafficLayerRef.current) return;
    trafficLayerRef.current.setMap(trafficVisible ? mapRef.current : null);
  }, [mapReady, trafficVisible]);

  function openStreetView() {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;
    const panorama = map.getStreetView();
    panorama.setPosition({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
    panorama.setPov({ heading: 0, pitch: 0 });
    panorama.setVisible(true);
  }

  function fitRoute() {
    const map = mapRef.current;
    if (!map) return;
    const locations = path.length ? path : points;
    if (locations.length === 1) {
      map.setCenter({ lat: locations[0].latitude, lng: locations[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    locations.forEach((location) => bounds.extend({ lat: location.latitude, lng: location.longitude }));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || typeof google === 'undefined') return;
    const origin = points.find((point) => point.type === 'origin');
    const destination = points.find((point) => point.type === 'destination');
    const routeKey = `${canEdit ? 'edit' : 'view'}:${pointKey}`;
    if (routeKey === routeRequestKeyRef.current) return;
    routeRequestKeyRef.current = routeKey;

    if (origin && destination && canEdit && directionsServiceRef.current && directionsRendererRef.current) {
      if (skipNextRouteRequestRef.current) {
        skipNextRouteRequestRef.current = false;
        skipNextFitRef.current = false;
        routeRequestIdRef.current += 1;
        if (routeRequestTimeoutRef.current !== null) window.clearTimeout(routeRequestTimeoutRef.current);
        routeRequestTimeoutRef.current = null;
        suppressDirectionsChangeRef.current = false;
        return;
      }
      suppressDirectionsChangeRef.current = true;
      directionsRendererRef.current.setOptions({ draggable: canEdit, preserveViewport: true, suppressMarkers: true });
      if (routeRequestTimeoutRef.current !== null) window.clearTimeout(routeRequestTimeoutRef.current);
      const requestId = ++routeRequestIdRef.current;
      const request = {
        destination: coordinate(destination),
        origin: coordinate(origin),
        travelMode: google.maps.TravelMode.DRIVING,
        waypoints: points
          .filter((point) => point.type === 'stop' || point.type === 'via')
          .map((point) => ({ location: coordinate(point), stopover: point.type !== 'via' })),
      };
      routeRequestTimeoutRef.current = window.setTimeout(() => {
        directionsServiceRef.current?.route(request, (result, status) => {
          if (requestId !== routeRequestIdRef.current) return;
          routeRequestTimeoutRef.current = null;
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);
            window.setTimeout(() => { suppressDirectionsChangeRef.current = false; }, 0);
            return;
          }
          suppressDirectionsChangeRef.current = false;
          setError('O Google Maps nao conseguiu desenhar o percurso editavel.');
        });
      }, 250);
    } else {
      routeRequestIdRef.current += 1;
      if (routeRequestTimeoutRef.current !== null) window.clearTimeout(routeRequestTimeoutRef.current);
      routeRequestTimeoutRef.current = null;
      suppressDirectionsChangeRef.current = false;
      directionsRendererRef.current?.set('directions', null);
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      if (path.length > 1) {
        polylineRef.current = new google.maps.Polyline({
          map,
          path: path.map((point) => ({ lat: point.latitude, lng: point.longitude })),
          strokeColor: '#18181b',
          strokeOpacity: 0.92,
          strokeWeight: 5,
        });
      }
    }

    if (skipNextFitRef.current) {
      skipNextFitRef.current = false;
      return;
    }
    if (routeKey === fitKeyRef.current) return;
    fitKeyRef.current = routeKey;
    const bounds = new google.maps.LatLngBounds();
    (path.length ? path : points).forEach((point) => {
      bounds.extend({
        lat: 'latitude' in point ? point.latitude : 0,
        lng: 'longitude' in point ? point.longitude : 0,
      });
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  }, [canEdit, mapReady, path, points, pointKey]);

  if (error) {
    return <div className="flex h-full min-h-[520px] items-center justify-center bg-zinc-100 p-6 text-center text-sm font-medium text-red-700">{error}</div>;
  }
  return (
    <div className={`relative h-full min-h-[520px] overflow-hidden bg-zinc-100 ${addingVia ? 'cursor-crosshair' : ''}`}>
      <div className="h-full min-h-[520px] w-full" ref={containerRef} />
      <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-1.5 rounded-lg border border-zinc-200 bg-white/95 p-1.5 shadow-md sm:right-4 sm:top-4">
        <label className="sr-only" htmlFor="route-map-style">Estilo do mapa</label>
        <span className="flex items-center px-1 text-zinc-500"><Layers aria-hidden="true" size={16} /></span>
        <select className="ui-input h-9 min-w-28 border-0 bg-transparent px-2 text-xs font-medium text-zinc-800 focus:ring-0" id="route-map-style" onChange={(event) => setMapStyle(event.target.value as MapStyle)} title="Estilo do mapa" value={mapStyle}>
          <option value="roadmap">Mapa</option>
          <option value="satellite">Satélite</option>
          <option value="hybrid">Híbrido</option>
          <option value="terrain">Terreno</option>
        </select>
        <button aria-pressed={trafficVisible} className={`ui-icon-button h-9 w-9 ${trafficVisible ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`} onClick={() => setTrafficVisible((visible) => !visible)} title={trafficVisible ? 'Ocultar trânsito' : 'Mostrar trânsito'} type="button"><Activity size={16} /></button>
        <button aria-label="Enquadrar rota" className="ui-icon-button h-9 w-9 border-zinc-200 bg-white text-zinc-700" onClick={fitRoute} title="Enquadrar rota" type="button"><Maximize size={16} /></button>
        <button className="ui-button h-9 gap-1.5 border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selectedLocation} onClick={openStreetView} title="Abrir Street View na localização selecionada" type="button"><Eye size={15} /><span>Street View</span></button>
      </div>
      {canEdit && points.length > 1 ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-zinc-700 shadow-lg ring-1 ring-zinc-200">
          Puxe o tracado da rota para criar desvios no percurso.
        </div>
      ) : null}
    </div>
  );
}

function createLocationInfo(point: RouteTemplatePoint | SelectedLocation) {
  const content = document.createElement('div');
  content.style.cssText = 'max-width:260px;padding:3px 2px;color:#18181b;font:13px/1.45 Arial,sans-serif';
  const title = document.createElement('strong');
  title.textContent = 'reference' in point ? point.reference : 'Localização do mapa';
  title.style.cssText = 'display:block;margin-bottom:4px;font-size:14px';
  content.append(title);
  if ('reference' in point) {
    const place = document.createElement('div');
    place.textContent = [point.city, point.uf].filter(Boolean).join(' / ');
    place.style.cssText = 'margin-bottom:3px;color:#52525b';
    content.append(place);
    const address = document.createElement('div');
    address.textContent = point.address;
    address.style.cssText = 'margin-bottom:5px;color:#52525b';
    content.append(address);
  }
  const coordinates = document.createElement('div');
  coordinates.textContent = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  coordinates.style.cssText = 'color:#71717a;font-size:11px';
  content.append(coordinates);
  return content;
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
