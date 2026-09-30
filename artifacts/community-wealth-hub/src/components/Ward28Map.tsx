import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ward 28 approximate boundary coordinates for Elsies River area
const ward28Coordinates: [number, number][] = [
  [-33.9250, 18.5900], // Northwest corner
  [-33.9250, 18.6200], // Northeast corner
  [-33.9500, 18.6200], // Northeast edge
  [-33.9600, 18.6100], // East edge
  [-33.9700, 18.5950], // Southeast corner
  [-33.9700, 18.5800], // South edge
  [-33.9550, 18.5700], // Southwest corner
  [-33.9400, 18.5750], // West edge
  [-33.9250, 18.5900], // Back to start
];

// Key locations in Ward 28
const locations = [
  { name: 'Virtual Hub', lat: -33.9450, lng: 18.5950, type: 'hub' },
  { name: 'Virtual Warehouse', lat: -33.9500, lng: 18.6050, type: 'warehouse' },
  { name: 'Elsies River Primary', lat: -33.9420, lng: 18.5880, type: 'school' },
  { name: 'Evershight School', lat: -33.9480, lng: 18.5920, type: 'school' },
];

export default function Ward28Map() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map centered on Ward 28
    const map = L.map(mapContainerRef.current).setView([-33.9450, 18.5950], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Draw Ward 28 boundary polygon
    const wardPolygon = L.polygon(ward28Coordinates, {
      color: '#9333ea', // Purple color matching the image
      fillColor: '#9333ea',
      fillOpacity: 0.2,
      weight: 3,
    }).addTo(map);

    // Add markers for key locations
    locations.forEach((location) => {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background: ${location.type === 'hub' ? '#22c55e' : location.type === 'warehouse' ? '#3b82f6' : '#f59e0b'};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
        ">${location.type === 'hub' ? '🏢' : location.type === 'warehouse' ? '📦' : '🏫'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([location.lat, location.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${location.name}</b><br>${location.type === 'hub' ? 'Community Hub' : location.type === 'warehouse' ? 'Warehouse' : 'School'}`);
    });

    // Fit map to show the entire ward
    map.fitBounds(wardPolygon.getBounds(), { padding: [20, 20] });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
