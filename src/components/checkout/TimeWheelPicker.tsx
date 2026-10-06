import { useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";

const ITEM_H = 40;
const VISIBLE = 5; // số dòng nhìn thấy — dòng giữa là giá trị đang chọn
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Bộ chọn Giờ:Phút dạng vòng xoay kiểu cài báo thức trên điện thoại.
 * Vuốt có quán tính rồi hít vào mốc gần nhất (Motion `dragTransition.modifyTarget`).
 * Desktop: lăn chuột / phím ↑↓ / bấm thẳng vào số.
 *
 * Chỉ hiện các mốc trong `slots` (trang gọi tính sẵn: sau giờ hiện tại + trong
 * giờ mở cửa — selectableSlots), nên không chọn được giờ sai. Đổi giờ mà phút
 * đang chọn không có ở giờ mới thì tự nhảy sang phút gần nhất của giờ đó.
 */
export default function TimeWheelPicker({
  value,
  onChange,
  slots,
}: {
  /** "HH:MM" */
  value: string;
  onChange: (hhmm: string) => void;
  /** giờ -> các phút chọn được. */
  slots: Map<number, number[]>;
}) {
  const [h, m] = value.split(":").map(Number);
  const hours = [...slots.keys()];
  const minutes = slots.get(h) ?? slots.get(hours[0]) ?? [];

  return (
    <div className="relative flex items-stretch justify-center gap-2 rounded-card-lg border border-outline-variant bg-surface-container-lowest px-4">
      {/* Dải chọn ở giữa */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 rounded-card bg-surface-container"
      />
      <WheelColumn
        label="Giờ"
        values={hours}
        value={h}
        onChange={(nh) => {
          const mins = slots.get(nh) ?? [];
          const nm = mins.includes(m) ? m : (mins[nearestIndex(mins, m)] ?? 0);
          onChange(`${pad2(nh)}:${pad2(nm)}`);
        }}
      />
      <span aria-hidden="true" className="relative z-10 self-center text-headline-sm font-bold text-on-surface">
        :
      </span>
      <WheelColumn
        label="Phút"
        values={minutes}
        value={m}
        onChange={(nm) => onChange(`${pad2(h)}:${pad2(nm)}`)}
      />
    </div>
  );
}

function WheelColumn({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  // Giá trị hiện tại có thể không có trong danh sách (vd. phút 07 khi bước 5) — lấy mốc gần nhất.
  const index = nearestIndex(values, value);
  const maxOffset = -(values.length - 1) * ITEM_H;
  const y = useMotionValue(-index * ITEM_H);
  const [center, setCenter] = useState(index);
  const dragging = useRef(false);

  const clampOffset = (v: number) => Math.min(0, Math.max(maxOffset, v));
  const snap = (v: number) => clampOffset(Math.round(v / ITEM_H) * ITEM_H);

  // Giá trị đổi từ bên ngoài (bấm số, phím, đổi danh sách giờ) → xoay tới đúng chỗ.
  useEffect(() => {
    if (dragging.current) return;
    const controls = animate(y, -index * ITEM_H, { type: "spring", stiffness: 400, damping: 40 });
    return () => controls.stop();
  }, [index, y]);

  // Đánh dấu dòng đang nằm giữa ngay trong lúc vuốt.
  useMotionValueEvent(y, "change", (v) => {
    setCenter(Math.min(values.length - 1, Math.max(0, Math.round(-v / ITEM_H))));
  });

  function commit(i: number) {
    const next = values[Math.min(values.length - 1, Math.max(0, i))];
    if (next !== undefined && next !== value) onChange(next);
  }

  function step(delta: number) {
    commit(index + delta);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    }
  }

  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) < 4) return;
    step(e.deltaY > 0 ? 1 : -1);
  }

  return (
    <div
      role="spinbutton"
      aria-label={label}
      aria-valuenow={values[index]}
      aria-valuetext={`${pad2(values[index] ?? 0)} ${label.toLowerCase()}`}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className="relative z-10 w-20 touch-none select-none overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-surface"
      style={{
        height: VISIBLE * ITEM_H,
        // Mờ dần hai đầu như bánh xe thật.
        maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
      }}
    >
      <motion.ul
        drag="y"
        style={{ y, paddingTop: PAD, paddingBottom: PAD }}
        dragConstraints={{ top: maxOffset, bottom: 0 }}
        dragElastic={0.15}
        dragTransition={{ power: 0.3, timeConstant: 200, modifyTarget: snap }}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragTransitionEnd={() => {
          dragging.current = false;
          commit(Math.round(-snap(y.get()) / ITEM_H));
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        {values.map((v, i) => (
          <li
            key={v}
            onClick={() => commit(i)}
            className={`flex items-center justify-center tabular-nums transition-colors ${
              i === center ? "text-headline-md text-on-surface" : "text-body-lg text-on-surface-variant"
            }`}
            style={{ height: ITEM_H }}
          >
            {pad2(v)}
          </li>
        ))}
      </motion.ul>
    </div>
  );
}

function nearestIndex(values: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  }
  return best;
}
