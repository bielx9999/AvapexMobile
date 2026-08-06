import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Navigation, Route as RouteIcon, Truck } from 'lucide-react';
import { ensureGoogleMaps, googleMapsMapId } from '../../../core/googleMaps/googleMapsLoader';
import type { Delivery, GeoLocation, RoutePlan, Trip } from '../../shared/domain/models';

type OperationalMapProps = {
  deliveries: Delivery[];
  routes: RoutePlan[];
  trips: Trip[];
};

type Coordinates = google.maps.LatLngLiteral;

type VehicleMarkerData = {
  id: string;
  driverName: string;
  online: boolean;
  position: Coordinates;
  routeCode: string;
  updatedAt: Date | null;
  vehiclePlate: string;
};

type GoogleMapsLibraries = {
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  InfoWindow: typeof google.maps.InfoWindow;
  LatLngBounds: typeof google.maps.LatLngBounds;
  Map: typeof google.maps.Map;
  Polyline: typeof google.maps.Polyline;
};

const defaultCenter: Coordinates = { lat: -23.5505, lng: -46.6333 };
const onlineWindowMs = 3 * 60 * 1000;
let googleMapsLibrariesPromise: Promise<GoogleMapsLibraries> | null = null;

export function OperationalMap({ deliveries, routes, trips }: OperationalMapProps) {
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0];
  const selectedDeliveries = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }
    return deliveries
      .filter((delivery) => delivery.routeId === selectedRoute.id)
      .sort((a, b) => a.sequence - b.sequence);
  }, [deliveries, selectedRoute]);

  const deliveryCountByRoute = useMemo(() => {
    const counts = new Map<string, number>();
    for (const delivery of deliveries) {
      counts.set(delivery.routeId, (counts.get(delivery.routeId) ?? 0) + 1);
    }
    return counts;
  }, [deliveries]);

  const vehicleMarkers = useMemo(
    () => buildVehicleMarkers(routes, trips, now),
    [now, routes, trips],
  );

  const routePath = useMemo(() => {
    if (!selectedRoute) {
      return [];
    }
    return [
      coordinate(selectedRoute.startAddress.latitude, selectedRoute.startAddress.longitude),
      ...selectedDeliveries.map((delivery) => coordinate(delivery.address.latitude, delivery.address.longitude)),
      coordinate(selectedRoute.endAddress.latitude, selectedRoute.endAddress.longitude),
    ].filter((point): point is Coordinates => point !== null);
  }, [selectedDeliveries, selectedRoute]);

  const mapPoints = useMemo(() => {
    const selectedVehicle = selectedRoute
      ? vehicleMarkers.find((marker) => marker.id === `route-${selectedRoute.id}`)
      : undefined;
    const points = selectedRoute ? [...routePath] : vehicleMarkers.map((marker) => marker.position);
    if (selectedVehicle && !points.some((point) => sameCoordinate(point, selectedVehicle.position))) {
      points.push(selectedVehicle.position);
    }
    return points.length > 0 ? points : [defaultCenter];
  }, [routePath, selectedRoute, vehicleMarkers]);

  const visibleDeliveries = useMemo(() => {
    if (selectedRoute) {
      return selectedDeliveries;
    }
    const routeIds = new Set(routes.map((route) => route.id));
    return deliveries.filter((delivery) => routeIds.has(delivery.routeId)).slice(0, 150);
  }, [deliveries, routes, selectedDeliveries, selectedRoute]);

  const onlineCount = vehicleMarkers.filter((marker) => marker.online).length;

  return (
    <section className="ui-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <MapPin size={18} />
          </span>
          <div>
            <h2 className="font-semibold">Mapa operacional</h2>
            <p className="text-xs text-zinc-500">Posicoes recebidas do aplicativo do motorista</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600">
          <LegendDot color="bg-emerald-500" label={`${onlineCount} online`} />
          <LegendDot color="bg-zinc-400" label={`${vehicleMarkers.length - onlineCount} offline`} />
          <LegendDot color="bg-avapex-yellow ring-1 ring-zinc-800" label="Entrega" />
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <GoogleOperationalMap
          deliveries={visibleDeliveries}
          points={mapPoints}
          route={selectedRoute}
          routePath={routePath}
          vehicleMarkers={vehicleMarkers}
        />

        <aside className="flex max-h-[360px] flex-col border-t border-zinc-200 bg-white md:max-h-[480px] xl:border-l xl:border-t-0">
          <div className="border-b border-zinc-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-zinc-500">Rotas monitoradas</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{routes.length} no periodo selecionado</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {routes.map((route) => {
              const marker = vehicleMarkers.find((item) => item.id === `route-${route.id}`);
              const selected = route.id === selectedRoute?.id;
              return (
                <button
                  className={`flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors ${selected ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 hover:bg-zinc-50'}`}
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  type="button"
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${marker?.online ? 'bg-emerald-500' : selected ? 'bg-zinc-500' : 'bg-zinc-300'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{route.code || route.id}</span>
                    <span className={`mt-1 block truncate text-xs ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {route.driverName || 'Motorista nao atribuido'}
                    </span>
                    <span className={`mt-1 flex items-center gap-3 text-xs ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      <span className="flex items-center gap-1"><Truck size={12} />{route.vehiclePlate || '-'}</span>
                      <span className="flex items-center gap-1"><RouteIcon size={12} />{deliveryCountByRoute.get(route.id) ?? 0} entregas</span>
                    </span>
                  </span>
                  <Navigation className={selected ? 'text-avapex-yellow' : 'text-zinc-400'} size={16} />
                </button>
              );
            })}
            {routes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Nenhuma rota estruturada encontrada. Posicoes legadas continuam visiveis no mapa.
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function GoogleOperationalMap({
  deliveries,
  points,
  route,
  routePath,
  vehicleMarkers,
}: {
  deliveries: Delivery[];
  points: Coordinates[];
  route: RoutePlan | undefined;
  routePath: Coordinates[];
  vehicleMarkers: VehicleMarkerData[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [libraries, setLibraries] = useState<GoogleMapsLibraries | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let disposed = false;
    loadGoogleMaps()
      .then((loadedLibraries) => {
        if (disposed || !containerRef.current) {
          return;
        }
        mapRef.current = new loadedLibraries.Map(containerRef.current, {
          center: defaultCenter,
          clickableIcons: false,
          fullscreenControl: true,
          gestureHandling: 'cooperative',
          mapId: googleMapsMapId,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 6,
        });
        setLibraries(loadedLibraries);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : 'Nao foi possivel carregar o Google Maps.');
        }
      });
    return () => {
      disposed = true;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!libraries || !map) {
      return;
    }

    const cleanups: Array<() => void> = [];
    const infoWindow = new libraries.InfoWindow();
    cleanups.push(() => infoWindow.close());

    if (route && routePath.length > 1) {
      const routeOutline = new libraries.Polyline({
        map,
        path: routePath,
        strokeColor: '#18181b',
        strokeOpacity: 0.82,
        strokeWeight: 7,
      });
      const routeLine = new libraries.Polyline({
        map,
        path: routePath,
        strokeColor: '#facc15',
        strokeOpacity: 1,
        strokeWeight: 4,
      });
      cleanups.push(() => routeOutline.setMap(null), () => routeLine.setMap(null));
    }

    if (route) {
      addEndpointMarker(
        map,
        libraries,
        infoWindow,
        coordinate(route.startAddress.latitude, route.startAddress.longitude),
        'Origem',
        route.startAddress.formattedAddress,
        'origin',
        cleanups,
      );
      addEndpointMarker(
        map,
        libraries,
        infoWindow,
        coordinate(route.endAddress.latitude, route.endAddress.longitude),
        'Destino',
        route.endAddress.formattedAddress,
        'destination',
        cleanups,
      );
    }

    for (const delivery of deliveries) {
      const position = coordinate(delivery.address.latitude, delivery.address.longitude);
      if (!position) {
        continue;
      }
      const marker = new libraries.AdvancedMarkerElement({
        content: createDeliveryMarker(delivery),
        map,
        position,
        title: `${delivery.sequence || '-'} - ${delivery.clientName || delivery.orderNumber}`,
        zIndex: 20,
      });
      const listener = marker.addListener('click', () => {
        infoWindow.setContent(createDeliveryInfo(delivery, position));
        infoWindow.open({ anchor: marker, map });
      });
      cleanups.push(() => listener.remove(), () => { marker.map = null; });
    }

    for (const vehicle of vehicleMarkers) {
      const marker = new libraries.AdvancedMarkerElement({
        content: createVehicleMarker(vehicle.online),
        map,
        position: vehicle.position,
        title: vehicle.vehiclePlate || vehicle.driverName || 'Veiculo',
        zIndex: 100,
      });
      const listener = marker.addListener('click', () => {
        infoWindow.setContent(createVehicleInfo(vehicle));
        infoWindow.open({ anchor: marker, map });
      });
      cleanups.push(() => listener.remove(), () => { marker.map = null; });
    }

    updateViewport(map, libraries.LatLngBounds, points);
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [deliveries, libraries, points, route, routePath, vehicleMarkers]);

  return (
    <div className="relative h-[360px] min-w-0 bg-zinc-100 md:h-[480px]">
      <div className="operational-map h-full w-full" ref={containerRef} />
      {!libraries && !loadError ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-100 text-sm font-medium text-zinc-600">
          Carregando mapa...
        </div>
      ) : null}
      {loadError ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-100 p-6 text-center">
          <div className="max-w-md">
            <MapPin className="mx-auto mb-3 text-zinc-400" size={28} />
            <p className="font-semibold text-zinc-900">Mapa indisponivel</p>
            <p className="mt-1 text-sm text-zinc-600">{loadError}</p>
          </div>
        </div>
      ) : null}
      {libraries && vehicleMarkers.length === 0 && routePath.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 border border-zinc-200 bg-white/95 px-4 py-3 text-sm text-zinc-600 shadow-sm backdrop-blur">
          Nenhuma coordenada recebida no periodo. O mapa sera atualizado quando o motorista enviar o GPS.
        </div>
      ) : null}
    </div>
  );
}

function loadGoogleMaps() {
  if (!googleMapsLibrariesPromise) {
    googleMapsLibrariesPromise = ensureGoogleMaps(['maps', 'marker']).then(() => ({
      AdvancedMarkerElement: google.maps.marker.AdvancedMarkerElement,
      InfoWindow: google.maps.InfoWindow,
      LatLngBounds: google.maps.LatLngBounds,
      Map: google.maps.Map,
      Polyline: google.maps.Polyline,
    }));
  }
  return googleMapsLibrariesPromise;
}

function addEndpointMarker(
  map: google.maps.Map,
  libraries: GoogleMapsLibraries,
  infoWindow: google.maps.InfoWindow,
  position: Coordinates | null,
  label: string,
  address: string,
  tone: 'origin' | 'destination',
  cleanups: Array<() => void>,
) {
  if (!position) {
    return;
  }
  const marker = new libraries.AdvancedMarkerElement({
    content: createEndpointMarker(label, tone),
    map,
    position,
    title: label,
    zIndex: 30,
  });
  const listener = marker.addListener('click', () => {
    infoWindow.setContent(createEndpointInfo(label, address, position));
    infoWindow.open({ anchor: marker, map });
  });
  cleanups.push(() => listener.remove(), () => { marker.map = null; });
}

function updateViewport(
  map: google.maps.Map,
  LatLngBounds: typeof google.maps.LatLngBounds,
  points: Coordinates[],
) {
  if (points.length === 1) {
    map.setCenter(points[0]);
    map.setZoom(sameCoordinate(points[0], defaultCenter) ? 6 : 14);
    return;
  }
  const bounds = new LatLngBounds();
  for (const point of points) {
    bounds.extend(point);
  }
  map.fitBounds(bounds, 40);
}

function createVehicleMarker(online: boolean) {
  const marker = document.createElement('span');
  marker.className = `avapex-map-vehicle ${online ? 'avapex-map-vehicle-online' : 'avapex-map-vehicle-offline'}`;
  marker.setAttribute('aria-hidden', 'true');
  marker.append(document.createElement('span'));
  return marker;
}

function createDeliveryMarker(delivery: Delivery) {
  const marker = document.createElement('span');
  marker.className = `avapex-map-delivery avapex-map-delivery-${delivery.status}`;
  marker.textContent = delivery.sequence > 0 ? String(delivery.sequence) : '';
  return marker;
}

function createEndpointMarker(label: string, tone: 'origin' | 'destination') {
  const marker = document.createElement('span');
  marker.className = `avapex-map-endpoint avapex-map-endpoint-${tone}`;
  marker.textContent = label.charAt(0);
  return marker;
}

function createDeliveryInfo(delivery: Delivery, position: Coordinates) {
  return createInfoContent(
    delivery.clientName || 'Entrega',
    [
      `Pedido ${delivery.orderNumber}`,
      delivery.address.formattedAddress,
      `Status: ${deliveryStatusLabel(delivery.status)}`,
    ],
    position,
  );
}

function createVehicleInfo(vehicle: VehicleMarkerData) {
  return createInfoContent(
    vehicle.vehiclePlate || 'Veiculo sem placa',
    [
      vehicle.driverName || 'Motorista nao informado',
      vehicle.routeCode,
      vehicle.online ? 'GPS online' : 'GPS offline',
      `Atualizado: ${formatDateTime(vehicle.updatedAt)}`,
    ],
    vehicle.position,
  );
}

function createEndpointInfo(label: string, address: string, position: Coordinates) {
  return createInfoContent(label, [address || 'Endereco nao informado'], position);
}

function createInfoContent(title: string, lines: string[], position: Coordinates) {
  const content = document.createElement('div');
  content.className = 'avapex-map-info';
  const heading = document.createElement('strong');
  heading.textContent = title;
  content.append(heading);
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    content.append(paragraph);
  }
  const link = document.createElement('a');
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${position.lat},${position.lng}`)}`;
  link.rel = 'noreferrer';
  link.target = '_blank';
  link.textContent = 'Abrir no Google Maps';
  content.append(link);
  return content;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

function buildVehicleMarkers(routes: RoutePlan[], trips: Trip[], now: number) {
  const routeVehicleIds = new Set(routes.filter((route) => route.currentLocation).map((route) => route.vehicleId));
  const routeMarkers = routes.flatMap<VehicleMarkerData>((route) => {
    const position = coordinateFromGeo(route.currentLocation);
    if (!position) {
      return [];
    }
    const updatedAt = route.currentLocation?.recordedAt ?? route.updatedAt;
    return [{
      id: `route-${route.id}`,
      driverName: route.driverName,
      online: isOnline(updatedAt, now),
      position,
      routeCode: route.code || route.id,
      updatedAt,
      vehiclePlate: route.vehiclePlate,
    }];
  });

  const legacyMarkers = trips.flatMap<VehicleMarkerData>((trip) => {
    if (trip.vehicleId && routeVehicleIds.has(trip.vehicleId)) {
      return [];
    }
    const position = coordinateFromRecord(trip.gpsLocation);
    if (!position) {
      return [];
    }
    return [{
      id: `trip-${trip.id}`,
      driverName: trip.driverName ?? '',
      online: isOnline(trip.lastGpsUpdateAt ?? null, now),
      position,
      routeCode: trip.customerRequestNumber || `Programacao ${trip.id}`,
      updatedAt: trip.lastGpsUpdateAt ?? null,
      vehiclePlate: trip.vehiclePlate ?? '',
    }];
  });

  return [...routeMarkers, ...legacyMarkers];
}

function coordinateFromGeo(location?: GeoLocation): Coordinates | null {
  return location ? coordinate(location.latitude, location.longitude) : null;
}

function coordinateFromRecord(location?: Record<string, unknown>): Coordinates | null {
  if (!location) {
    return null;
  }
  return coordinate(location.latitude, location.longitude);
}

function coordinate(latitude: unknown, longitude: unknown): Coordinates | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { lat: latitude, lng: longitude };
}

function sameCoordinate(left: Coordinates, right: Coordinates) {
  return left.lat === right.lat && left.lng === right.lng;
}

function isOnline(updatedAt: Date | null, now: number) {
  return Boolean(updatedAt && now - updatedAt.getTime() <= onlineWindowMs);
}

function deliveryStatusLabel(status: Delivery['status']) {
  const labels: Record<Delivery['status'], string> = {
    pending: 'Pendente',
    in_route: 'Em rota',
    arrived: 'No cliente',
    delivered: 'Entregue',
    not_delivered: 'Nao entregue',
    cancelled: 'Cancelada',
  };
  return labels[status];
}

function formatDateTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(value)
    : 'Sem atualizacao';
}
