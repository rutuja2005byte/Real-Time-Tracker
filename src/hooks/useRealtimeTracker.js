import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { io } from "socket.io-client";

const STALE_AFTER_MS = 25000;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "/";
const ROUTING_URL = import.meta.env.VITE_ROUTING_URL || "https://router.project-osrm.org";
const NEEDS_BACKEND_URL =
  import.meta.env.PROD &&
  !import.meta.env.VITE_SOCKET_URL &&
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("vercel.app");
const userColors = ["#39ff88", "#ff6b35", "#f8cf34", "#43d8ff", "#ff4fad", "#9d7cff"];

function makeDisplayName(id, isSelf, name) {
  if (isSelf) return name || "You";
  return name || `User ${id.slice(0, 4).toUpperCase()}`;
}

function distanceInMeters(from, to) {
  if (!from || !to) return null;

  return (
    distance(
      point([from.longitude, from.latitude]),
      point([to.longitude, to.latitude]),
      { units: "kilometers" }
    ) * 1000
  );
}

function accuracyRadius(user) {
  if (!Number.isFinite(user?.accuracy)) return null;
  return Math.max(0, user.accuracy);
}

function combinedAccuracy(from, to) {
  const fromAccuracy = accuracyRadius(from);
  const toAccuracy = accuracyRadius(to);
  if (!Number.isFinite(fromAccuracy) || !Number.isFinite(toAccuracy)) return null;
  return fromAccuracy + toAccuracy;
}

function routeCacheKey(from, to) {
  const round = (value) => Number(value).toFixed(4);
  return [
    round(from.longitude),
    round(from.latitude),
    round(to.longitude),
    round(to.latitude),
  ].join(",");
}

async function getRoadDistanceInMeters(from, to, signal) {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response = await fetch(
    `${ROUTING_URL}/route/v1/driving/${coords}?overview=false&alternatives=false&steps=false`,
    { signal }
  );

  if (!response.ok) {
    throw new Error("Unable to load road distance");
  }

  const data = await response.json();
  const meters = data?.routes?.[0]?.distance;
  return Number.isFinite(meters) ? meters : null;
}

export function useRealtimeTracker(profileName, roomId, participantId) {
  const socketRef = useRef(null);
  const watchRef = useRef(null);
  const lastLocationRef = useRef(null);
  const profileNameRef = useRef(profileName);
  const roomIdRef = useRef(roomId);
  const participantIdRef = useRef(participantId);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [locationStatus, setLocationStatus] = useState("locating");
  const [permissionError, setPermissionError] = useState("");
  const [selfId, setSelfId] = useState("");
  const [users, setUsers] = useState({});
  const [roadDistances, setRoadDistances] = useState({});
  const routeKeysRef = useRef({});

  const upsertUser = useCallback((payload, isSelf = false) => {
    if (payload.roomId && payload.roomId !== roomIdRef.current) {
      return;
    }

    const identity = payload.participantId || payload.id;

    if (!identity || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      return;
    }

    setUsers((current) => {
      const existing = current[identity];
      const withoutSamePerson = Object.fromEntries(
        Object.entries(current).filter(([id, user]) => {
          if (id === identity) return false;
          if (user.participantId && user.participantId === identity) return false;
          return !(payload.name && user.name === payload.name && user.roomId === payload.roomId);
        })
      );
      const index = Object.keys(withoutSamePerson).length;
      const color = existing?.color ?? userColors[Math.max(index, 0) % userColors.length];

      return {
        ...withoutSamePerson,
        [identity]: {
          id: identity,
          socketId: payload.id,
          participantId: identity,
          name: makeDisplayName(identity, isSelf, payload.name ?? existing?.name),
          latitude: payload.latitude,
          longitude: payload.longitude,
          roomId: payload.roomId,
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
    roomIdRef.current = roomId;
    participantIdRef.current = participantId;

    const socket = socketRef.current;
    if (socket?.connected && lastLocationRef.current) {
      const update = { ...lastLocationRef.current, name: profileName, roomId, participantId };
      socket.emit("send-location", update);
      upsertUser({ id: socket.id, ...update }, true);
    }
  }, [profileName, roomId, participantId, upsertUser]);

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
          roomId: roomIdRef.current,
          participantId: participantIdRef.current,
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
    if (NEEDS_BACKEND_URL) {
      setSocketStatus("backend missing");
      return;
    }

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
        const update = {
          ...lastLocationRef.current,
          name: profileNameRef.current,
          roomId: roomIdRef.current,
          participantId: participantIdRef.current,
        };
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
        const entry = Object.entries(current).find(([, user]) => user.socketId === id);
        if (!entry) return current;
        const [userId, user] = entry;
        return {
          ...current,
          [userId]: {
            ...user,
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
    const self = values.find((user) => user.participantId === participantId || user.isSelf);

    return values
      .map((user) => ({
        ...user,
        distanceFromMe:
          user.participantId === self?.participantId ? 0 : distanceInMeters(self, user),
        roadDistanceFromMe:
          user.participantId === self?.participantId ? 0 : roadDistances[user.participantId],
        distanceAccuracy:
          user.participantId === self?.participantId
            ? accuracyRadius(user)
            : combinedAccuracy(self, user),
      }))
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || b.lastUpdate - a.lastUpdate);
  }, [participantId, roadDistances, users]);

  useEffect(() => {
    const values = Object.values(users);
    const self = values.find((user) => user.participantId === participantId || user.isSelf);
    if (!self) return undefined;

    const onlineUsers = values.filter((user) => !user.isSelf && user.online);

    onlineUsers.forEach((user) => {
      const cacheKey = routeCacheKey(self, user);
      if (routeKeysRef.current[user.participantId] === cacheKey) return;
      routeKeysRef.current[user.participantId] = cacheKey;

      setRoadDistances((current) => ({
        ...current,
        [user.participantId]: {
          ...current[user.participantId],
          cacheKey,
          loading: true,
        },
      }));

      getRoadDistanceInMeters(self, user)
        .then((meters) => {
          if (routeKeysRef.current[user.participantId] !== cacheKey) return;
          if (!Number.isFinite(meters)) return;
          setRoadDistances((current) => ({
            ...current,
            [user.participantId]: {
              cacheKey,
              meters,
              loading: false,
              updatedAt: Date.now(),
            },
          }));
        })
        .catch((error) => {
          if (routeKeysRef.current[user.participantId] !== cacheKey) return;
          setRoadDistances((current) => ({
            ...current,
            [user.participantId]: {
              ...current[user.participantId],
              cacheKey,
              loading: false,
              error: true,
            },
          }));
        });
    });
  }, [participantId, users]);

  return {
    activeUsers,
    locationStatus,
    permissionError,
    reconnect,
    selfId,
    socketStatus,
  };
}
