/**
 * Nén ảnh check-in bằng Canvas về JPEG 100KB–300KB — bucket attendance_images
 * giới hạn 300KB ở server, nén ở client để upload nhanh trên 4G yếu.
 *
 * Chiến lược: thu cạnh dài về MAX_EDGE, rồi hạ quality dần; vẫn quá to thì thu
 * nhỏ kích thước thêm. Ảnh gốc dưới MIN_BYTES thì không ép thêm để giữ nét.
 */
const MAX_BYTES = 300 * 1024;
const MIN_BYTES = 100 * 1024;
const MAX_EDGE = 1280;
const MIN_EDGE = 480;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh vừa chụp, thử chụp lại nhé."));
    };
    img.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh, thử lại nhé."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(file: Blob): Promise<Blob> {
  if (file.type === "image/jpeg" && file.size >= MIN_BYTES && file.size <= MAX_BYTES) return file;

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ nén ảnh.");

  let edge = Math.min(MAX_EDGE, Math.max(img.naturalWidth, img.naturalHeight));
  // Ảnh gốc đã nhỏ: chỉ đổi sang JPEG chất lượng cao, không ép thêm.
  const startQuality = file.size < MIN_BYTES ? 0.92 : 0.85;

  while (true) {
    const scale = edge / Math.max(img.naturalWidth, img.naturalHeight);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (let q = startQuality; q >= 0.4; q -= 0.1) {
      const blob = await toJpeg(canvas, q);
      if (blob.size <= MAX_BYTES) return blob;
    }

    if (edge <= MIN_EDGE) throw new Error("Ảnh quá lớn, không nén được xuống 300KB.");
    edge = Math.max(MIN_EDGE, Math.round(edge * 0.75));
  }
}
