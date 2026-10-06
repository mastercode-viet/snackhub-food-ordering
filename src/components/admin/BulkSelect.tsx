import { useCallback, useState } from "react";
import { Check, Minus, Trash2 } from "lucide-react";
import { toast } from "@/store/toast";

/**
 * Chọn nhiều để xoá hàng loạt — dùng chung cho các danh sách admin (Thực đơn,
 * Combo, Mã giảm giá, Banner).
 *
 * Chỉ tính các dòng ĐANG HIỆN (`visibleIds`): đang lọc/tìm kiếm thì "Chọn tất
 * cả" và "Xoá" chỉ đụng tới kết quả đang thấy, không xoá nhầm dòng bị ẩn.
 */
export function useBulkSelection(visibleIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const selectedIds = visibleIds.filter((id) => picked.has(id));
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => setPicked(allSelected ? new Set() : new Set(visibleIds));
  const clear = useCallback(() => setPicked(new Set()), []);

  return { selectedIds, isSelected: (id: string) => picked.has(id), toggle, toggleAll, allSelected, clear };
}

export type BulkSelection = ReturnType<typeof useBulkSelection>;

export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      // Vùng bấm 44px cho ngón tay, ô vuông nhìn thấy 20px.
      className="grid size-11 shrink-0 place-items-center"
    >
      <span
        className={`grid size-5 place-items-center rounded-[6px] border transition-colors ${
          on ? "border-inverse-surface bg-inverse-surface text-inverse-on-surface" : "border-outline bg-surface-container-lowest"
        }`}
      >
        {indeterminate ? <Minus size={14} strokeWidth={3} /> : checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/**
 * Thanh trên đầu danh sách: ô "Chọn tất cả" + nút "Xoá đã chọn".
 * Xoá TỪNG dòng bằng đúng hàm xoá đơn lẻ của trang (giữ nguyên thông báo lỗi
 * riêng, vd. món đang nằm trong combo) — dòng nào lỗi thì bỏ qua, báo lại cuối.
 */
export function BulkDeleteBar<T extends { id: string }>({
  selection,
  items,
  noun,
  nameOf,
  deleteOne,
  onDone,
}: {
  selection: BulkSelection;
  /** Các dòng đang hiện — cùng thứ tự với visibleIds đưa vào useBulkSelection. */
  items: T[];
  /** "món", "combo", "mã", "banner" */
  noun: string;
  nameOf: (item: T) => string;
  deleteOne: (item: T) => Promise<void>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const selected = items.filter((i) => selection.isSelected(i.id));
  const count = selected.length;

  async function handleDelete() {
    const preview = selected.slice(0, 5).map((i) => `• ${nameOf(i)}`).join("\n");
    const more = count > 5 ? `\n… và ${count - 5} ${noun} khác` : "";
    if (!confirm(`Xoá ${count} ${noun} đã chọn?\n\n${preview}${more}`)) return;

    setBusy(true);
    const failed: string[] = [];
    for (const item of selected) {
      try {
        await deleteOne(item);
      } catch (e) {
        failed.push(`${nameOf(item)}: ${e instanceof Error ? e.message : "lỗi không rõ"}`);
      }
    }
    setBusy(false);
    selection.clear();
    onDone();

    const ok = count - failed.length;
    if (failed.length === 0) {
      toast.success(`Đã xoá ${ok} ${noun}.`);
    } else {
      toast.error(
        `${ok > 0 ? `Đã xoá ${ok}/${count} ${noun}. ` : ""}Không xoá được ${failed.length}:\n${failed.slice(0, 3).join("\n")}${
          failed.length > 3 ? `\n… và ${failed.length - 3} ${noun} khác` : ""
        }`,
      );
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex min-h-[44px] items-center gap-2 border-b border-outline-variant pb-2">
      <SelectCheckbox
        checked={selection.allSelected}
        indeterminate={count > 0 && !selection.allSelected}
        onChange={selection.toggleAll}
        label={selection.allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
      />
      <span className="flex-1 text-label-md text-on-surface-variant">
        {count > 0 ? `Đã chọn ${count}/${items.length}` : `Chọn tất cả (${items.length})`}
      </span>
      {count > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDelete()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-50"
        >
          <Trash2 size={16} strokeWidth={2.2} />
          {busy ? "Đang xoá…" : `Xoá ${count} ${noun}`}
        </button>
      )}
    </div>
  );
}
