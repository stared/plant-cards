import exifr from 'exifr';

export interface Loc {
  lat: number;
  lon: number;
  source: 'gps' | 'exif';
}

/** Current position from the browser, or null (denied / timeout / unavailable). */
export function getPosition(timeoutMs = 8000): Promise<Loc | null> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, source: 'gps' }),
      () => res(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** GPS from EXIF of the original file (works for some library picks), or null. */
export async function exifLocation(file: File): Promise<Loc | null> {
  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      return { lat: gps.latitude, lon: gps.longitude, source: 'exif' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** EXIF capture date (ms epoch) or null. */
export async function exifDate(file: File): Promise<number | null> {
  try {
    const meta = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    const d: unknown = meta?.DateTimeOriginal ?? meta?.CreateDate;
    if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
  } catch {
    /* ignore */
  }
  return null;
}
