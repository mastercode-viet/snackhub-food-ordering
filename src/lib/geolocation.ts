/** Khoảng cách (mét) theo haversine — cùng công thức với public.distance_m() ở DB. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Toạ độ lúc check-in. Không có quyền định vị thì KHÔNG cho chấm công — ném lỗi tiếng Việt để hiển thị thẳng lên toast. */
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Trình duyệt không hỗ trợ định vị — không thể chấm công."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Cần cho phép truy cập vị trí để chấm công. Bật lại quyền định vị trong cài đặt trình duyệt."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("Lấy vị trí quá lâu — ra chỗ thoáng hơn rồi thử lại nhé."));
        } else {
          reject(new Error("Không lấy được vị trí, thử lại nhé."));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
