import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import L from "leaflet";

const DEFAULT_CENTER = [19.076, 72.8777];
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function makeIcon(color) {
  return L.divIcon({
    className: "tracker-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div class="tracker-marker-shell" style="--marker:${color};--marker-soft:${color}44">
        <span class="tracker-marker-pulse"></span>
        <span class="tracker-marker-dot"></span>
      </div>
    `,
  });
}

function animateMarker(marker, nextLatLng) {
  if (marker.animationFrame) {
    cancelAnimationFrame(marker.animationFrame);
  }

  const start = marker.getLatLng();
  const end = L.latLng(nextLatLng);
  const startedAt = performance.now();
  const duration = 850;

  function frame(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const lat = start.lat + (end.lat - start.lat) * eased;
    const lng = start.lng + (end.lng - start.lng) * eased;
    marker.setLatLng([lat, lng]);

    if (progress < 1) {
      marker.animationFrame = requestAnimationFrame(frame);
    }
  }

  marker.animationFrame = requestAnimationFrame(frame);
}

export const TrackingMap = forwardRef(function TrackingMap({ users }, ref) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const hasFitRef = useRef(false);

  const fitAll = (options = {}) => {
    const map = mapRef.current;
    if (!map || users.length === 0) return;

    const bounds = L.latLngBounds(users.map((user) => [user.latitude, user.longitude]));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.35), {
        animate: true,
        duration: 0.8,
        maxZoom: users.length === 1 ? 17 : 16,
        paddingTopLeft: [24, 100],
        paddingBottomRight: [24, 250],
        ...options,
      });
    }
  };

  useImperativeHandle(ref, () => ({
    focusAll: () => fitAll(),
    focusSelf: () => {
      const self = users.find((user) => user.isSelf);
      if (!self || !mapRef.current) return;
      mapRef.current.flyTo([self.latitude, self.longitude], 17, { duration: 0.9 });
    },
  }));

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;

    const map = L.map(nodeRef.current, {
      zoomControl: false,
      preferCanvas: true,
      center: DEFAULT_CENTER,
      zoom: 13,
      minZoom: 3,
      maxZoom: 19,
      worldCopyJump: true,
    });

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      detectRetina: true,
      crossOrigin: true,
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(users.map((user) => user.id));

    users.forEach((user) => {
      const latLng = [user.latitude, user.longitude];
      const existing = markersRef.current.get(user.id);

      if (existing) {
        existing.setIcon(makeIcon(user.online ? user.color : "#7d8595"));
        animateMarker(existing, latLng);
        return;
      }

      const marker = L.marker(latLng, {
        icon: makeIcon(user.online ? user.color : "#7d8595"),
        keyboard: false,
        title: user.name,
      }).addTo(map);
      markersRef.current.set(user.id, marker);
    });

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    if (users.length > 0 && !hasFitRef.current) {
      hasFitRef.current = true;
      window.setTimeout(() => fitAll({ animate: false }), 150);
    }
  }, [users]);

  return <div ref={nodeRef} className="absolute inset-0" aria-label="Live tracking map" />;
});
