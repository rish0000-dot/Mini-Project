import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const markerHtml = (fill, stroke, inner) => `
  <div style="
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: ${fill};
    border: 2px solid ${stroke};
    box-shadow: 0 0 0 6px rgba(0, 212, 170, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <div style="
      width: 14px;
      height: 14px;
      border-radius: 50%;
      transform: rotate(45deg);
      background: ${inner};
      border: 2px solid white;
      box-sizing: border-box;
    "></div>
  </div>
`;

// Custom hospital marker icon
const hospitalIcon = L.divIcon({
  className: 'hospital-marker-enhanced',
  html: markerHtml('#00d4aa', '#00b894', '#0b1f2d'),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// User location marker
const userIcon = L.divIcon({
  className: 'user-marker-enhanced',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #2dd4bf;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 8px rgba(45, 212, 191, 0.22), 0 0 24px rgba(45, 212, 191, 0.45);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function MapView({ center, zoom, bounds }) {
  const map = useMap();
  const previousCenterRef = useRef(null);

  const toRadians = (value) => (value * Math.PI) / 180;
  const getDistanceMeters = (from, to) => {
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(to[0] - from[0]);
    const dLng = toRadians(to[1] - from[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(from[0])) *
        Math.cos(toRadians(to[0])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (bounds && bounds.length === 2) {
      map.stop();
      map.fitBounds(bounds, {
        animate: true,
        duration: 1.15,
        easeLinearity: 0.25,
        padding: [48, 48],
      });
      return;
    }

    if (!center) return;
    const previousCenter = previousCenterRef.current;
    previousCenterRef.current = center;

    if (previousCenter && getDistanceMeters(previousCenter, center) < 25) {
      return;
    }

    map.stop();
    map.flyTo(center, zoom, {
      animate: true,
      duration: 1.15,
      easeLinearity: 0.25,
    });
  }, [bounds, center, zoom, map]);

  return null;
}

export function Map({ children, center = [28.9124, 77.5855], zoom = 13, bounds = null, ...props }) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      zoomAnimation={true}
      fadeAnimation={true}
      markerZoomAnimation={true}
      zoomSnap={0.25}
      zoomDelta={0.25}
      wheelDebounceTime={20}
      wheelPxPerZoomLevel={120}
      doubleClickZoom={true}
      touchZoom={true}
      style={{ height: '100%', width: '100%' }}
      {...props}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="topright" />
      <MapView center={center} zoom={zoom} bounds={bounds} />
      {children}
    </MapContainer>
  );
}

export function MapControls() {
  // ZoomControl is already included in the Map component
  return null;
}

export function Marker({ position, title, icon = userIcon, children, ...props }) {
  return (
    <LeafletMarker position={position} icon={icon} title={title} {...props}>
      {children && <Popup>{children}</Popup>}
    </LeafletMarker>
  );
}

export { hospitalIcon, userIcon };
export { Popup } from 'react-leaflet';
