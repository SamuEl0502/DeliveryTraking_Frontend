// Arco de círculo máximo entre dos puntos (slerp sobre la esfera), para dibujar rutas en el mapa

const RAD = Math.PI / 180;

/** `n + 1` puntos [lat, lng] de a a b. Las longitudes no saltan en ±180: Leaflet dibuja la línea seguida */
export function greatCircle(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  n = 64,
): [number, number][] {
  const toVec = (p: { lat: number; lng: number }) => [
    Math.cos(p.lat * RAD) * Math.cos(p.lng * RAD),
    Math.cos(p.lat * RAD) * Math.sin(p.lng * RAD),
    Math.sin(p.lat * RAD),
  ];
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.min(1, Math.max(-1, va[0]! * vb[0]! + va[1]! * vb[1]! + va[2]! * vb[2]!));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return [[a.lat, a.lng], [b.lat, b.lng]];

  const out: [number, number][] = [];
  let prevLng = a.lng;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ka = Math.sin((1 - t) * omega) / Math.sin(omega);
    const kb = Math.sin(t * omega) / Math.sin(omega);
    const [x, y, z] = [0, 1, 2].map((k) => ka * va[k]! + kb * vb[k]!) as [number, number, number];
    let lng = Math.atan2(y, x) / RAD;
    // Antimeridiano: se desenrolla la longitud para que no haya saltos de 360°
    lng += Math.round((prevLng - lng) / 360) * 360;
    prevLng = lng;
    out.push([Math.atan2(z, Math.hypot(x, y)) / RAD, lng]);
  }
  return out;
}
