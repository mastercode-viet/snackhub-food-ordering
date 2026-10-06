import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X } from "lucide-react";

/**
 * Camera trực tiếp trong app (getUserMedia) — không đi qua hộp chọn file nên
 * KHÔNG có đường chọn ảnh từ thư viện. Từ chối quyền camera thì không chụp
 * được, không có phương án dự phòng bằng file.
 *
 * Cần HTTPS (hoặc localhost) — trình duyệt chặn getUserMedia trên http thường.
 */
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (image: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ mở camera. Hãy dùng Chrome hoặc Safari bản mới qua https.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Cần cho phép truy cập camera để chấm công. Bật lại quyền camera trong cài đặt trình duyệt."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này."
              : "Không mở được camera, thử lại nhé.",
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setShot({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chụp ảnh check-in"
      className="fixed inset-0 z-50 grid place-items-center bg-inverse-surface/70 p-4"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-sheet bg-surface-container-lowest shadow-sheet">
        <div className="relative aspect-[3/4] w-full bg-inverse-surface">
          {error ? (
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-body-md text-inverse-on-surface">
              {error}
            </p>
          ) : shot ? (
            <img src={shot.url} alt="Ảnh vừa chụp" className="size-full object-cover" />
          ) : (
            // Lật gương cho tự nhiên khi selfie — chỉ ở khung xem, ảnh lưu vẫn đúng chiều.
            <video
              ref={(el) => {
                // Video gắn lại sau "Chụp lại" — nối lại luồng camera đang mở.
                videoRef.current = el;
                if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
              }}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              className="size-full -scale-x-100 object-cover"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md font-semibold text-on-surface"
          >
            <X size={16} strokeWidth={2.2} />
            Huỷ
          </button>

          {shot ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShot(null)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md font-semibold text-on-surface"
              >
                <RotateCcw size={16} strokeWidth={2.2} />
                Chụp lại
              </button>
              <button
                type="button"
                onClick={() => onCapture(shot.blob)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface shadow-cta"
              >
                Dùng ảnh này
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!ready || !!error}
              onClick={takePhoto}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-inverse-surface px-4 text-label-md font-semibold text-inverse-on-surface shadow-cta disabled:opacity-50"
            >
              <Camera size={16} strokeWidth={2.2} />
              Chụp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
