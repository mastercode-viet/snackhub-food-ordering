import { useMemo, useState } from "react";
import { Check, ChevronRight, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { LabeledSwitch } from "@/components/admin/AdminForm";
import { formatVnd } from "@/lib/format";
import { normalizeSearch } from "@/lib/text";
import { toast } from "@/store/toast";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  createToppingGroup,
  createToppingItem,
  deleteToppingGroup,
  deleteToppingItem,
  fetchAdminProducts,
  fetchAssignments,
  fetchToppingGroups,
  renameToppingGroup,
  setGroupProducts,
  updateToppingItem,
  type AdminProduct,
  type ToppingGroupFull,
} from "@/lib/adminQueries";

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

export default function AdminToppingsPage() {
  const state = useAsync(
    async () => ({
      groups: await fetchToppingGroups(),
      products: await fetchAdminProducts(),
      assignments: await fetchAssignments(),
    }),
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const run: RunFn = async (action, okMessage) => {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  };

  const groups = state.data?.groups ?? [];

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return groups;
    return groups.filter((g) => normalizeSearch(g.name).includes(q));
  }, [groups, query]);

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Nhóm topping</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <h1 className="text-headline-sm text-on-surface">Quản lý nhóm topping</h1>
          <p className="mt-1 max-w-[52ch] text-body-sm text-on-surface-variant">
            Một nhóm gán được cho nhiều món. Sửa giá hay xoá topping ở đây không làm thay đổi
            các đơn khách đã đặt trước đó.
          </p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newGroup.trim();
            if (!name) return;
            setNewGroup("");
            void run(() => createToppingGroup(name), `Đã tạo nhóm "${name}".`);
          }}
        >
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="Tên nhóm mới"
            className="min-h-[44px] w-44 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90"
          >
            <Plus size={17} strokeWidth={2.4} />
            Thêm nhóm
          </button>
        </form>
      </header>

      {state.loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-label-lg text-on-surface">Danh sách nhóm</h2>
              <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-xs text-on-secondary-container">
                {groups.length} nhóm
              </span>

              <button
                type="button"
                onClick={state.reload}
                aria-label="Tải lại"
                className="ml-auto inline-flex size-11 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <RotateCw size={16} strokeWidth={2.2} />
              </button>
            </div>

            <div className="relative">
              <Search
                size={16}
                strokeWidth={2.2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên nhóm…"
                className="min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              />
            </div>

            {groups.length === 0 ? (
              <EmptyState
                icon="🧋"
                title="Chưa có nhóm topping nào"
                description="Tạo nhóm đầu tiên bằng ô ở góc trên bên phải."
              />
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-body-md text-on-surface-variant">
                Không có nhóm nào khớp “{query}”.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {filtered.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    productNames={namesOf(
                      state.data!.products,
                      state.data!.assignments[group.id] ?? [],
                    )}
                    active={group.id === selectedId}
                    onSelect={() => setSelectedId(group.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="w-full shrink-0 xl:w-[380px]">
            {selected ? (
              <EditPanel
                key={selected.id}
                group={selected}
                products={state.data!.products}
                assignedProductIds={state.data!.assignments[selected.id] ?? []}
                onClose={() => setSelectedId(null)}
                onRun={run}
              />
            ) : (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chọn một nhóm bên trái để sửa tên, thêm topping và gán vào món.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function namesOf(products: AdminProduct[], ids: string[]): string[] {
  return products.filter((p) => ids.includes(p.id)).map((p) => p.name);
}

function GroupRow({
  group,
  productNames,
  active,
  onSelect,
}: {
  group: ToppingGroupFull;
  productNames: string[];
  active: boolean;
  onSelect: () => void;
}) {
  const soldOut = group.topping_items.filter((i) => !i.is_available).length;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={`flex w-full min-h-[44px] items-center gap-3 rounded-card px-2 py-3 text-left transition-colors ${
          active ? "bg-surface-container" : "hover:bg-surface-container-low"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md text-on-surface">{group.name}</p>
          <p className="truncate text-label-sm text-on-surface-variant">
            {productNames.length > 0 ? productNames.join(" · ") : "chưa gán món nào"}
          </p>
        </div>

        <span className="shrink-0 text-label-sm text-on-surface-variant">
          {group.topping_items.length} topping
        </span>

        {soldOut > 0 && (
          <span className="shrink-0 rounded-full bg-error-container px-2.5 py-0.5 text-label-xs text-on-error-container">
            {soldOut} tạm hết
          </span>
        )}

        <ChevronRight size={16} strokeWidth={2.2} className="shrink-0 text-on-surface-variant" />
      </button>
    </li>
  );
}

function EditPanel({
  group,
  products,
  assignedProductIds,
  onClose,
  onRun,
}: {
  group: ToppingGroupFull;
  products: AdminProduct[];
  assignedProductIds: string[];
  onClose: () => void;
  onRun: RunFn;
}) {
  const [name, setName] = useState(group.name);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [picked, setPicked] = useState<string[]>(assignedProductIds);

  const assignDirty =
    picked.length !== assignedProductIds.length ||
    picked.some((id) => !assignedProductIds.includes(id));

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-label-lg text-on-surface">Chỉnh sửa nhóm</h2>
          <p className="text-label-sm text-on-surface-variant">Lưu ngay khi bấm, không cần xác nhận</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng bảng chỉnh sửa"
          className="inline-flex size-11 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-label-sm text-on-surface-variant">Tên nhóm</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (!next || next === group.name) {
              setName(group.name);
              return;
            }
            void onRun(() => renameToppingGroup(group.id, next), "Đã đổi tên nhóm.");
          }}
          className="min-h-[44px] rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-label-sm text-on-surface-variant">Topping trong nhóm</p>

        {group.topping_items.length === 0 ? (
          <p className="rounded-card bg-surface-container-low px-3 py-4 text-center text-body-sm text-on-surface-variant">
            Nhóm chưa có topping nào.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant">
            {group.topping_items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md text-on-surface">{item.name}</p>
                  <p className="text-label-sm text-primary">+{formatVnd(item.price_delta)}</p>
                </div>

                <LabeledSwitch
                  on={item.is_available}
                  onChange={() =>
                    void onRun(
                      () => updateToppingItem(item.id, { is_available: !item.is_available }),
                      item.is_available ? "Đã đánh dấu tạm hết." : "Đã bật bán lại.",
                    )
                  }
                  onLabel="Còn bán"
                  offLabel="Tạm hết"
                  tone="danger"
                />

                <button
                  type="button"
                  onClick={() => void onRun(() => deleteToppingItem(item.id), "Đã xoá topping.")}
                  aria-label={`Xoá ${item.name}`}
                  className="inline-flex size-11 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = itemName.trim();
            const price = Number(itemPrice);
            if (!n || !Number.isFinite(price) || price < 0) {
              toast.error("Nhập tên topping và giá cộng thêm hợp lệ.");
              return;
            }
            setItemName("");
            setItemPrice("");
            void onRun(
              () => createToppingItem(group.id, n, price, group.topping_items.length + 1),
              `Đã thêm "${n}".`,
            );
          }}
        >
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Tên topping"
            className="min-h-[44px] min-w-0 flex-1 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          />
          <input
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            inputMode="numeric"
            placeholder="Giá thêm"
            className="min-h-[44px] w-24 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          />
          <button
            type="submit"
            aria-label="Thêm topping"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-card border border-outline-variant text-on-surface transition-colors hover:bg-surface-container"
          >
            <Plus size={17} strokeWidth={2.4} />
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2 border-t border-outline-variant pt-space-md">
        <p className="text-label-sm text-on-surface-variant">Áp dụng cho món</p>

        <div className="grid gap-1.5">
          {products.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPicked((cur) =>
                    cur.includes(p.id) ? cur.filter((id) => id !== p.id) : [...cur, p.id],
                  )
                }
                aria-pressed={on}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-card border px-3 text-left text-body-md transition-colors ${
                  on
                    ? "border-secondary bg-secondary-container text-on-secondary-container"
                    : "border-outline-variant text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center">
                  {on && <Check size={16} strokeWidth={2.6} />}
                </span>
                <span className="min-w-0 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!assignDirty}
          onClick={() => void onRun(() => setGroupProducts(group.id, picked), "Đã cập nhật món áp dụng.")}
          className="min-h-[44px] rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Lưu danh sách món
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!confirm(`Xoá nhóm "${group.name}" và toàn bộ topping bên trong?`)) return;
          onClose();
          void onRun(() => deleteToppingGroup(group.id), "Đã xoá nhóm.");
        }}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
      >
        <Trash2 size={16} strokeWidth={2.2} />
        Xoá nhóm này
      </button>
    </section>
  );
}
