import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { distanceMeters, getCurrentPosition } from "@/lib/geolocation";
import { fetchStoreSettings } from "@/lib/queries";
import { compressImage } from "@/lib/imageCompress";
import CameraCapture from "@/components/admin/CameraCapture";
import { formatClock, formatTimeOfDay, toIsoDate } from "@/lib/format";
import { toast } from "@/store/toast";
import {
  checkIn,
  checkOut,
  fetchOpenTimeLog,
  fetchShiftAssignmentForStaffOnDate,
  SHIFT_GRACE_MINUTES,
  type ShiftAssignmentWithShift,
  type TimeLog,
} from "@/lib/staffQueries";

/** actualIso giờ thực tế check-in/out so với "HH:MM:SS" của ca -> dương = muộn hơn mốc, âm = sớm hơn mốc. */
function minutesFromBoundary(actualIso: string, boundaryTime: string): number {
  const actual = new Date(actualIso);
  const actualMinutes = actual.getHours() * 60 + actual.getMinutes();
  const [h, m] = boundaryTime.split(":").map(Number);
  return actualMinutes - (h * 60 + m);
}

/** Cảnh báo (không chặn) nếu check-in/out lệch quá SHIFT_GRACE_MINUTES so với ca được gán hôm đó — im lặng nếu chưa được gán ca nào. */
async function warnIfOffShift(staffId: string, actualIso: string, boundary: "start_time" | "end_time") {
  try {
    const assignment = await fetchShiftAssignmentForStaffOnDate(staffId, toIsoDate(new Date(actualIso)));
    if (!assignment) return;
    const boundaryTime = assignment.shift[boundary];
    const diff = minutesFromBoundary(actualIso, boundaryTime);
    if (Math.abs(diff) <= SHIFT_GRACE_MINUTES) return;
    const action = boundary === "start_time" ? "Check-in" : "Check-out";
    const direction = diff > 0 ? "trễ" : "sớm";
    toast.info(
      `⚠️ ${action} ${direction} ${Math.abs(diff)} phút so với ca "${assignment.shift.name}" (${formatTimeOfDay(boundaryTime)}).`,
    );
  } catch {
    // Cảnh báo lệch ca không quan trọng bằng việc check-in/out đã thành công — im lặng bỏ qua lỗi tra lịch.
  }
}

type Position = { latitude: number; longitude: number };

/**
 * Nội dung chính của tab "Chấm công" (`/admin/cham-cong`) — AdminCheckInPage
 * quyết định có mount hay không (chỉ tài khoản có hồ sơ staff_profiles),
 * widget không tự kiểm tra quyền lại.
 *
 * Không tự đếm giờ/phút làm real-time — total_minutes_worked chỉ chốt khi
 * check-out (cột generated ở DB), Widget chỉ hiển thị mốc check-in và kết
 * quả sau khi check-out, không tính hộ DB.
 */
export default function CheckInOutWidget({ staffId }: { staffId: string }) {
  const [shift, setShift] = useState<TimeLog | null>(null);
  const [todayShift, setTodayShift] = useState<ShiftAssignmentWithShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Check-in: lấy vị trí trước (từ chối thì dừng), có vị trí rồi mới mở camera trong app.
  const [position, setPosition] = useState<Position | null>(null);
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOpenTimeLog(staffId)
      .then((row) => {
        if (!cancelled) setShift(row);
      })
      .catch(() => {
        // Im lặng: widget không quan trọng bằng nội dung trang, không chặn UI bằng lỗi.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Ca được gán hôm nay chỉ để HIỂN THỊ ngữ cảnh trước khi bấm Check-in —
    // không chặn hay bắt buộc gì, lỗi tra cứu thì im lặng bỏ qua.
    fetchShiftAssignmentForStaffOnDate(staffId, toIsoDate(new Date()))
      .then((row) => {
        if (!cancelled) setTodayShift(row);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  async function handleLocate() {
    setBusy(true);
    setStep("Đang lấy vị trí…");
    try {
      const [pos, settings] = await Promise.all([getCurrentPosition(), fetchStoreSettings()]);
      // Báo sớm trước khi mở camera — chặn thật vẫn là trigger enforce_checkin_location ở DB.
      if (settings.store_latitude != null && settings.store_longitude != null) {
        const d = distanceMeters(pos, { latitude: settings.store_latitude, longitude: settings.store_longitude });
        if (d > settings.checkin_radius_m) {
          toast.error(
            `Bạn đang cách quán khoảng ${Math.round(d)} m — chỉ được check-in trong bán kính ${settings.checkin_radius_m} m.`,
          );
          return;
        }
      }
      setPosition(pos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lấy được vị trí, thử lại nhé.");
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  async function handlePhoto(photo: Blob) {
    if (!position) return;
    setBusy(true);
    try {
      setStep("Đang nén ảnh…");
      const image = await compressImage(photo);
      setStep("Đang tải lên…");
      const row = await checkIn(staffId, { ...position, image });
      setShift(row);
      setPosition(null);
      toast.success(`Đã check-in lúc ${formatClock(row.check_in_at)}. Chúc ca làm việc suôn sẻ!`);
      void warnIfOffShift(staffId, row.check_in_at, "start_time");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không check-in được, thử lại nhé.");
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  async function handleCheckOut() {
    if (!shift) return;
    setBusy(true);
    try {
      const row = await checkOut(shift.id);
      setShift(null);
      const minutes = row.total_minutes_worked ?? 0;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      toast.success(`Đã check-out. Ca làm: ${h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} phút`}.`);
      if (row.check_out_at) void warnIfOffShift(staffId, row.check_out_at, "end_time");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không check-out được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      {todayShift && (
        <p className="text-label-sm text-on-surface-variant">
          Ca hôm nay: <strong className="text-on-surface">{todayShift.shift.name}</strong>{" "}
          {formatTimeOfDay(todayShift.shift.start_time)}–{formatTimeOfDay(todayShift.shift.end_time)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${
            shift ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          <Clock size={18} strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-label-xs text-on-surface-variant">
            {shift ? "Đang làm việc" : "Chưa check-in"}
          </p>
          <p className="truncate text-label-lg font-bold text-on-surface">
            {shift ? `Từ ${formatClock(shift.check_in_at)}` : "--:--"}
          </p>
        </div>

        {shift ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCheckOut()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-50"
          >
            <LogOut size={16} strokeWidth={2.2} />
            Check-out
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !!position}
            onClick={() => void handleLocate()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            <LogIn size={16} strokeWidth={2.2} />
            Check-in
          </button>
        )}
      </div>

      {step && <p className="text-label-sm text-on-surface-variant" aria-live="polite">{step}</p>}

      {!shift && position && !busy && (
        <CameraCapture onCapture={(photo) => void handlePhoto(photo)} onClose={() => setPosition(null)} />
      )}
    </section>
  );
}
