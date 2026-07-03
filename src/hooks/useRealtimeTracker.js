import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const STALE_AFTER_MS = 25000;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/";
const userColors = ["#39ff88", "#ff6b35", "#f8cf34", "#43d8ff", "#ff4fad", "#9d7cff"];

function makeDisplayName(id, isSelf, name) {
  if (isSelf) return name || "You";
  return name || `User ${id.slice(0, 4).toUpperCase()}`;
}

function distanceInMeters(from, to) {
  if (!from || !to) return null;

  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const startLat = toRadians(from.latitude);
  const endLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useRealtimeTracker(profileName) {
  const socketRef = useRef(null);
  const watchRef = useRef(null);
  const lastLocationRef = useRef(null);
  const profileNameRef = useRef(profileName);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [locationStatus, setLocationStatus] = useState("locating");
  const [permissionError, setPermissionError] = useState("");
  const [selfId, setSelfId] = useState("");
  const [users, setUsers] = useState({});

  const upsertUser = useCallback((payload, isSelf = false) => {
    if (!payload?.id || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      return;
    }

    setUsers((current) => {
      const existing = current[payload.id];
      const index = Object.keys(current).indexOf(payload.id);
      const color = existing?.color ?? userColors[Math.max(index, 0) % userColors.length];

      return {
        ...current,
        [payload.id]: {
          id: payload.id,
          name: makeDisplayName(payload.id, isSelf, payload.name ?? existing?.name),
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy: payload.accuracy,
          heading: payload.heading,
          speed: payload.speed,
          lastUpdate: Date.now(),
          online: true,
          isSelf: existing?.isSelf || isSelf,
          color,
        },
      };
    });
  }, []);

  useEffect(() => {
    profileNameRef.current = profileName;

    const socket = socketRef.current;
    if (socket?.connected && lastLocationRef.current) {
      const update = { ...lastLocationRef.current, name: profileName };
      socket.emit("send-location", update);
      upsertUser({ id: socket.id, ...update }, true);
    }
  }, [profileName, upsertUser]);

  const startLocationWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setPermissionError("This browser does not support live location.");
      return;
    }

    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
    }

    setLocationStatus("locating");
    setPermissionError("");

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          name: profileNameRef.current,
        };

        lastLocationRef.current = location;
        setLocationStatus("active");

        const socket = socketRef.current;
        if (socket?.connected) {
          socket.emit("send-location", location);
          upsertUser({ id: socket.id, ...location }, true);
        }
      },
      (error) => {
        setLocationStatus("error");
        setPermissionError(error.message || "Location permission is required for live tracking.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1500,
      }
    );
  }, [upsertUser]);

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setSocketStatus("connecting");
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3500,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      setSelfId(socket.id);
      if (lastLocationRef.current) {
        const update = { ...lastLocationRef.current, name: profileNameRef.current };
        socket.emit("send-location", update);
        upsertUser({ id: socket.id, ...update }, true);
      }
    });

    socket.on("disconnect", () => {
      setSocketStatus("offline");
    });

    socket.io.on("reconnect_attempt", () => setSocketStatus("reconnecting"));
    socket.io.on("reconnect", () => setSocketStatus("connected"));
    socket.io.on("error", () => setSocketStatus("offline"));

    socket.on("receive-location", (data) => {
      upsertUser(data, data.id === socket.id);
    });

    socket.on("user-disconnected", (id) => {
      setUsers((current) => {
        if (!current[id]) return current;
        return {
          ...current,
          [id]: {
            ...current[id],
            online: false,
            lastUpdate: Date.now(),
          },
        };
      });
    });
  }, [upsertUser]);

  useEffect(() => {
    connect();
    startLocationWatch();

    const staleTimer = window.setInterval(() => {
      setUsers((current) => {
        const now = Date.now();
        return Object.fromEntries(
          Object.entries(current).map(([id, user]) => [
            id,
            {
              ...user,
              online: user.online && now - user.lastUpdate < STALE_AFTER_MS,
            },
          ])
        );
      });
    }, 5000);

    return () => {
      window.clearInterval(staleTimer);
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      socketRef.current?.disconnect();
    };
  }, [connect, startLocationWatch]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const activeUsers = useMemo(() => {
    const values = Object.values(users);
    const self = values.find((user) => user.id === selfId || user.isSelf);

    return values
      .map((user) => ({
        ...user,
        distanceFromMe:
          user.id === self?.id ? 0 : distanceInMeters(self, user),
      }))
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
  }, [selfId, users]);

  return {
    activeUsers,
    locationStatus,
    permissionError,
    reconnect,
    selfId,
    socketStatus,
  };
}
