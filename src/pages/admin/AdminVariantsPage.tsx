import { useMemo, useRef, useState } from "react";
import { ChevronRight, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { LabeledSwitch, MoneyInput, inputClass } from "@/components/admin/AdminForm";
import { formatVnd } from "@/lib/format";
import { normalizeSearch } from "@/lib/text";
import { toast } from "@/store/toast";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import type { Tables } from "@/types/database";
import {
  createOption,
  createOptionGroup,
  deleteOption,
  deleteOptionGroup,
  fetchAdminProducts,
  fetchOptionGroupAssignments,
  fetchProductOptionGroups,
  fetchSharedOptionGroups,
  setOptionGroupProducts,
  updateOption,
  updateOptionGroup,
  type AdminOptionGroup,
  type AdminProduct,
} from "@/lib/adminQueries";

type RunFn = (
  action: () => Promise<unknown>,
  okMessage: string,
  after?: () => void,
  /** Trả lại state cục bộ (ô nhập đang gõ dở) khi ghi lỗi. */
  onError?: () => void,
) => Promise<void>;
type GroupMode = "single" | "size" | "multi";

/**
 * Biến thể của món: mì có nhiều loại (Mì rau củ 15K, Mì trộn xúc xích 20K…),
 * đồ uống có size M/L. Mỗi nhóm "chọn một" mang GIÁ BÁN thay cho giá gốc của
 * món; nhóm "chọn nhiều" thì giá từng lựa chọn là phụ phí cộng thêm.
 *
 * Nhóm SIZE nên tạo ở tab "Nhóm dùng chung": tạo một lần rồi gán cho tất cả
 * món nước, sửa giá một chỗ là mọi món đang gán đổi theo.
 */
export default function AdminVariantsPage() {
  const [tab, setTab] = useState<"shared" | "products">("shared");
  const productsState = useAsync(() => fetchAdminProducts(), []);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMode, setNewGroupMode] = useState<GroupMode>("single");
  const [newSharedName, setNewSharedName] = useState("Size");
  const [newSharedMode, setNewSharedMode] = useState<GroupMode>("size");

  const products = productsState.data ?? [];
  const selected = products.find((p) => p.id === selectedProductId) ?? null;

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return products;
    return products.filter((p) => normalizeSearch(p.name).includes(q));
  }, [products, query]);

  const groupsState = useAsync<AdminOptionGroup[]>(
    () =>
      selectedProductId
        ? fetchProductOptionGroups(selectedProductId)
        : Promise.resolve<AdminOptionGroup[]>([]),
    [selectedProductId],
  );

  const sharedState = useAsync<AdminOptionGroup[]>(() => fetchSharedOptionGroups(), []);
  const assignState = useAsync<Record<string, string[]>>(
    () => fetchOptionGroupAssignments(),
    [],
  );

  // Sửa tại chỗ: thao tác chỉ ghi 1 request rồi cập nhật state, KHÔNG đọc lại
  // cả 3 danh sách. Đọc lại sau mỗi click làm nháy UI và mất vị trí đang thao tác.
  // Một nhóm có thể nằm ở danh sách riêng của món hoặc danh sách dùng chung.
  function updateGroups(apply: (prev: AdminOptionGroup[]) => AdminOptionGroup[]) {
    groupsState.setData((prev) => (prev ? apply(prev) : prev));
    sharedState.setData((prev) => (prev ? apply(prev) : prev));
  }

  function patchGroup(id: string, patch: Partial<AdminOptionGroup>) {
    updateGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function dropGroup(id: string) {
    updateGroups((prev) => prev.filter((g) => g.id !== id));
    assignState.setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function patchOption(optionId: string, patch: Partial<Tables<"product_options">>) {
    updateGroups((prev) =>
      prev.map((g) => ({
        ...g,
        product_options: g.product_options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
      })),
    );
  }

  function dropOption(optionId: string) {
    updateGroups((prev) =>
      prev.map((g) => ({
        ...g,
        product_options: g.product_options.filter((o) => o.id !== optionId),
      })),
    );
  }

  function patchAssignment(groupId: string, productIds: string[]) {
    assignState.setData((prev) => ({ ...(prev ?? {}), [groupId]: productIds }));
  }

  // Mỗi nhóm chỉ có tối đa 1 request gán đang chạy. Tick liên tiếp thì các lần
  // sau chỉ ghi đè giá trị chờ, và vòng lặp ghi nốt giá trị MỚI NHẤT khi request
  // trước xong — nhờ vậy hai lần delete+insert không chồng nhau ghi đè lẫn nhau.
  const pendingAssign = useRef(new Map<string, string[]>());
  const writingAssign = useRef(new Set<string>());

  async function saveAssignment(groupId: string, productIds: string[]) {
    // Hiện ngay cho phản hồi tức thì; lỗi thì đọc lại để rollback về đúng DB.
    patchAssignment(groupId, productIds);
    pendingAssign.current.set(groupId, productIds);
    if (writingAssign.current.has(groupId)) return;

    writingAssign.current.add(groupId);
    try {
      while (pendingAssign.current.has(groupId)) {
        const next = pendingAssign.current.get(groupId)!;
        pendingAssign.current.delete(groupId);
        await setOptionGroupProducts(groupId, next);
      }
      toast.success("Đã cập nhật danh sách món dùng nhóm.");
    } catch (e) {
      pendingAssign.current.delete(groupId);
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
      // Request có thể đã xoá xong mà chưa chèn lại → đọc đúng bảng gán này.
      assignState.reload();
    } finally {
      writingAssign.current.delete(groupId);
    }
  }

  const run: RunFn = async (action, okMessage, after, onError) => {
    try {
      await action();
      toast.success(okMessage);
      after?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
      onError?.();
      // Ghi có thể đã dở dang (vd xoá xong nhưng chèn lỗi) nên state local có
      // thể lệch DB — đọc lại để UI không hiển thị thứ chưa lưu được.
      groupsState.reload();
      sharedState.reload();
      assignState.reload();
    }
  };

  const groups = groupsState.data ?? [];
  const sharedGroups = sharedState.data ?? [];
  const assignments = assignState.data ?? {};

  const sharedForSelected = selected
    ? sharedGroups.filter((group) => (assignments[group.id] ?? []).includes(selected.id))
    : [];

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Biến thể món</span>
      </nav>

      <header className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <h1 className="text-headline-sm text-on-surface">Biến thể món</h1>
        <p className="mt-1 max-w-[62ch] text-body-sm text-on-surface-variant">
          Nhóm “dùng chung” được tạo một lần rồi gán cho nhiều món — size M/L của đồ uống chỉ
          cần khai báo một chỗ. Nhóm “chọn một” thay giá gốc bằng giá biến thể khách chọn; nhóm
          “size (cộng thêm)” giữ giá gốc và chỉ cộng phần chênh (M = 0đ, L = +3.000đ); nhóm
          “chọn nhiều” cộng thêm như topping. Đổi giá ở đây không làm thay đổi các đơn khách đã
          đặt trước đó.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Kiểu quản lý biến thể"
        className="flex gap-1 rounded-card-lg bg-surface-container-low p-1"
      >
        <TabButton active={tab === "shared"} onClick={() => setTab("shared")}>
          Nhóm dùng chung
        </TabButton>
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Theo từng món
        </TabButton>
      </div>

      {tab === "shared" ? (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex w-full shrink-0 flex-col gap-3 rounded-card-lg bg-surface-container-lowest p-4 shadow-card xl:w-[360px]">
            <div>
              <h2 className="text-label-lg text-on-surface">Tạo nhóm dùng chung</h2>
              <p className="mt-1 text-label-sm text-on-surface-variant">
                Vd “Size” với M = 0đ, L = chênh lệch. Nhóm chỉ xuất hiện ở những món được gán bên
                phải.
              </p>
            </div>

            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newSharedName.trim();
                if (!name) return;
                setNewSharedName("Size");
                void run(
                  () =>
                    createOptionGroup({
                      productId: null,
                      name,
                      mode: newSharedMode,
                      sortOrder: sharedGroups.length + 1,
                    }),
                  `Đã tạo nhóm dùng chung "${name}".`,
                  // Nhóm mới cần id do DB sinh ra nên phải đọc lại danh sách này.
                  sharedState.reload,
                );
              }}
            >
              <input
                value={newSharedName}
                onChange={(e) => setNewSharedName(e.target.value)}
                placeholder="Tên nhóm, vd: Size"
                className={inputClass}
              />
              <ModePicker value={newSharedMode} onChange={setNewSharedMode} />
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90"
              >
                <Plus size={17} strokeWidth={2.4} />
                Tạo nhóm dùng chung
              </button>
            </form>
          </section>

          <div className="flex min-w-0 flex-1 flex-col gap-space-md">
            {sharedState.loading || assignState.loading ? (
              <Skeleton className="h-64 w-full rounded-card" />
            ) : sharedState.error ? (
              <ErrorState onRetry={sharedState.reload} />
            ) : assignState.error ? (
              <ErrorState onRetry={assignState.reload} />
            ) : sharedGroups.length === 0 ? (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chưa có nhóm dùng chung. Tạo nhóm “Size” ở trên, thêm M/L, rồi tick các món nước
                cần dùng.
              </div>
            ) : (
              sharedGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onRun={run}
                  onPatch={(patch) => patchGroup(group.id, patch)}
                  onDrop={() => dropGroup(group.id)}
                  onPatchOption={patchOption}
                  onDropOption={dropOption}
                  reloadGroups={sharedState.reload}
                  products={products}
                  assigned={assignments[group.id] ?? []}
                  onAssign={(productIds) => void saveAssignment(group.id, productIds)}
                />
              ))
            )}
          </div>
        </div>
      ) : productsState.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : productsState.error ? (
        <ErrorState onRetry={productsState.reload} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-label-lg text-on-surface">Chọn món</h2>
              <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-xs text-on-secondary-container">
                {products.length} món
              </span>
              <button
                type="button"
                onClick={() => {
                  productsState.reload();
                  groupsState.reload();
                  sharedState.reload();
                  assignState.reload();
                }}
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
                placeholder="Tìm món…"
                className="min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              />
            </div>

            {products.length === 0 ? (
              <EmptyState
                icon="🍜"
                title="Chưa có món nào"
                description="Thêm món ở mục Thực đơn trước, rồi quay lại đây tạo biến thể."
              />
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-body-md text-on-surface-variant">
                Không có món nào khớp “{query}”.
              </p>
            ) : (
              <ul className="flex max-h-[60vh] flex-col divide-y divide-outline-variant overflow-y-auto">
                {visible.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    active={product.id === selectedProductId}
                    onSelect={() => setSelectedProductId(product.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="flex w-full flex-col gap-space-md xl:w-[520px] xl:shrink-0">
            {!selected ? (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chọn một món bên trái để thêm biến thể.
              </div>
            ) : (
              <>
                <section className="flex flex-col gap-3 rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
                  <div className="min-w-0">
                    <h2 className="truncate text-label-lg text-on-surface">{selected.name}</h2>
                    <p className="text-label-sm text-on-surface-variant">
                      Giá gốc {formatVnd(selected.base_price)}
                      {groups.length > 0 && ` · ${groups.length} nhóm biến thể riêng`}
                    </p>
                    {sharedForSelected.length > 0 && (
                      <p className="mt-1 text-label-xs text-on-surface-variant">
                        Đang dùng chung: {sharedForSelected.map((g) => g.name).join(", ")} — sửa
                        ở tab “Nhóm dùng chung”.
                      </p>
                    )}
                  </div>

                  <form
                    className="flex flex-col gap-2 border-t border-outline-variant pt-space-md"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = newGroupName.trim();
                      if (!name) return;
                      setNewGroupName("");
                      void run(
                        () =>
                          createOptionGroup({
                            productId: selected.id,
                            name,
                            mode: newGroupMode,
                            sortOrder: groups.length + 1,
                          }),
                        `Đã tạo nhóm "${name}".`,
                        groupsState.reload,
                      );
                    }}
                  >
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Tên nhóm riêng, vd: Chọn mì"
                      className={inputClass}
                    />
                    <ModePicker value={newGroupMode} onChange={setNewGroupMode} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90"
                    >
                      <Plus size={17} strokeWidth={2.4} />
                      Thêm nhóm riêng cho món này
                    </button>
                  </form>
                </section>

                {groupsState.loading ? (
                  <Skeleton className="h-40 w-full rounded-card" />
                ) : groupsState.error ? (
                  <ErrorState onRetry={groupsState.reload} />
                ) : groups.length === 0 ? (
                  <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                    Món này chưa có biến thể riêng. Với size đồ uống, tạo nhóm ở tab “Nhóm dùng
                    chung” rồi gán món này vào.
                  </div>
                ) : (
                  groups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onRun={run}
                      onPatch={(patch) => patchGroup(group.id, patch)}
                      onDrop={() => dropGroup(group.id)}
                      onPatchOption={patchOption}
                      onDropOption={dropOption}
                      reloadGroups={groupsState.reload}
                    />
                  ))
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-[44px] flex-1 rounded-card px-3 text-label-md transition-colors ${
        active
          ? "bg-surface-container-lowest text-on-surface shadow-card"
          : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}

function ProductRow({
  product,
  active,
  onSelect,
}: {
  product: AdminProduct;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={`flex min-h-[44px] w-full items-center gap-3 rounded-card px-2 py-3 text-left transition-colors ${
          active ? "bg-surface-container" : "hover:bg-surface-container-low"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-body-md text-on-surface">{product.name}</span>
        <span className="shrink-0 text-label-sm text-on-surface-variant">
          {formatVnd(product.base_price)}
        </span>
        <ChevronRight size={16} strokeWidth={2.2} className="shrink-0 text-on-surface-variant" />
      </button>
    </li>
  );
}

function ModePicker({
  value,
  onChange,
}: {
  value: GroupMode;
  onChange: (v: GroupMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <ModeButton
        active={value === "single"}
        onClick={() => onChange("single")}
        title="Chọn một"
        hint="Thay giá gốc"
      />
      <ModeButton
        active={value === "size"}
        onClick={() => onChange("size")}
        title="Size"
        hint="Cộng thêm (M/L)"
      />
      <ModeButton
        active={value === "multi"}
        onClick={() => onChange("multi")}
        title="Chọn nhiều"
        hint="Cộng thêm như topping"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[44px] flex-col justify-center rounded-card border px-3 py-2 text-left transition-colors ${
        active
          ? "border-secondary bg-secondary-container text-on-secondary-container"
          : "border-outline-variant text-on-surface hover:bg-surface-container-low"
      }`}
    >
      <span className="text-label-md">{title}</span>
      <span className="text-label-xs opacity-80">{hint}</span>
    </button>
  );
}

function GroupCard({
  group,
  onRun,
  onPatch,
  onDrop,
  onPatchOption,
  onDropOption,
  reloadGroups,
  products,
  assigned,
  onAssign,
}: {
  group: AdminOptionGroup;
  onRun: RunFn;
  /** Sửa nhóm trong state local — không đọc lại DB sau mỗi thao tác. */
  onPatch: (patch: Partial<AdminOptionGroup>) => void;
  onDrop: () => void;
  onPatchOption: (optionId: string, patch: Partial<Tables<"product_options">>) => void;
  onDropOption: (optionId: string) => void;
  /** Tạo mới cần id do DB sinh ra nên phải đọc lại đúng danh sách này. */
  reloadGroups: () => void;
  /** Chỉ truyền cho nhóm dùng chung: danh sách món để tick gán. */
  products?: AdminProduct[];
  assigned?: string[];
  onAssign?: (productIds: string[]) => void;
}) {
  const single = group.max_select === 1;
  // "Size" là nhóm chọn một nhưng CỘNG THÊM giá (delta) thay vì thay giá gốc.
  const sizeGroup = single && group.price_mode === "delta";
  const mode: GroupMode = sizeGroup ? "size" : single ? "single" : "multi";
  const shared = group.product_id === null;
  const [name, setName] = useState(group.name);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState(0);

  return (
    <section className="flex flex-col gap-3 rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (!next || next === group.name) {
                setName(group.name);
                return;
              }
              void onRun(
                () => updateOptionGroup(group.id, { name: next }),
                "Đã đổi tên nhóm.",
                () => onPatch({ name: next }),
                // Lỗi thì trả ô nhập về tên đang lưu, không để chữ gõ dở nằm lại.
                () => setName(group.name),
              );
            }}
            aria-label="Tên nhóm biến thể"
            className={inputClass}
          />
          {shared && (
            <p className="mt-1 text-label-xs text-on-surface-variant">
              Nhóm dùng chung · sửa ở đây là mọi món đang gán đổi theo
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const question = shared
              ? `Xoá nhóm dùng chung "${group.name}" và gỡ khỏi mọi món?`
              : `Xoá nhóm "${group.name}" và toàn bộ biến thể bên trong?`;
            if (!confirm(question)) return;
            void onRun(() => deleteOptionGroup(group.id), "Đã xoá nhóm.", onDrop);
          }}
          aria-label={`Xoá nhóm ${group.name}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={16} strokeWidth={2.2} />
        </button>
      </div>

      <ModePicker
        value={mode}
        onChange={(next) => {
          if (next === mode) return;
          const patch =
            next === "single"
              ? { is_required: true, min_select: 1, max_select: 1, price_mode: "replace" }
              : next === "size"
                ? { is_required: true, min_select: 1, max_select: 1, price_mode: "delta" }
                : { is_required: false, min_select: 0, max_select: 5, price_mode: "delta" };
          void onRun(
            () => updateOptionGroup(group.id, patch),
            "Đã đổi kiểu nhóm.",
            () => onPatch(patch),
          );
        }}
      />

      {single && (
        <LabeledSwitch
          on={group.is_required}
          onChange={() =>
            void onRun(
              () => updateOptionGroup(group.id, { is_required: !group.is_required }),
              group.is_required ? "Biến thể thành tuỳ chọn." : "Biến thể thành bắt buộc.",
              () => onPatch({ is_required: !group.is_required }),
            )
          }
          onLabel="Bắt buộc chọn"
          offLabel="Không bắt buộc"
        />
      )}

      {group.product_options.length === 0 ? (
        <p className="rounded-card bg-surface-container-low px-3 py-4 text-center text-body-sm text-on-surface-variant">
          Nhóm chưa có biến thể nào.
        </p>
      ) : (
        <ul className="flex flex-col">
          {group.product_options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              priceMode={group.price_mode}
              onRun={onRun}
              onPatch={(patch) => onPatchOption(option.id, patch)}
              onDrop={() => onDropOption(option.id)}
            />
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 border-t border-outline-variant pt-space-md"
        onSubmit={(e) => {
          e.preventDefault();
          const n = optName.trim();
          // Nhóm size cần dòng M = 0đ, nên cho phép giá 0 với nhóm này.
          if (!n || !Number.isFinite(optPrice) || optPrice < 0 || (optPrice === 0 && mode !== "size")) {
            toast.error("Nhập tên biến thể và giá hợp lệ.");
            return;
          }
          setOptName("");
          setOptPrice(0);
          void onRun(
            () =>
              createOption({
                groupId: group.id,
                name: n,
                price: optPrice,
                sortOrder: group.product_options.length + 1,
              }),
            `Đã thêm "${n}".`,
            reloadGroups,
          );
        }}
      >
        <input
          value={optName}
          onChange={(e) => setOptName(e.target.value)}
          placeholder={
            mode === "single"
              ? "Tên biến thể, vd: Mì trộn xúc xích"
              : mode === "size"
                ? "Tên size, vd: Size M / Size L"
                : "Tên lựa chọn"
          }
          className={inputClass}
        />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <MoneyInput
              value={optPrice}
              onChange={setOptPrice}
              placeholder={mode === "single" ? "Giá bán" : mode === "size" ? "Phụ phí size" : "Phụ phí"}
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-card border border-outline-variant px-4 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <Plus size={16} strokeWidth={2.4} />
            Thêm
          </button>
        </div>
        <p className="text-label-xs text-on-surface-variant">
          {mode === "single"
            ? "Giá này là giá khách trả cho biến thể, thay cho giá gốc của món."
            : mode === "size"
              ? "Giá này cộng thêm vào giá món: size M để 0đ, size L nhập phần chênh lệch."
              : "Giá này cộng thêm vào giá món."}
        </p>
      </form>

      {onAssign && products && (
        <div className="flex flex-col gap-2 border-t border-outline-variant pt-space-md">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-label-md text-on-surface">Gán cho món</h3>
            <span className="text-label-xs text-on-surface-variant">
              {(assigned ?? []).length} món
            </span>
          </div>
          {products.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">Chưa có món nào để gán.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto rounded-card border border-outline-variant">
              {products.map((product) => {
                const on = (assigned ?? []).includes(product.id);
                return (
                  <li key={product.id} className="border-b border-outline-variant/60 last:border-b-0">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          onAssign(
                            on
                              ? (assigned ?? []).filter((id) => id !== product.id)
                              : [...(assigned ?? []), product.id],
                          )
                        }
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface">
                        {product.name}
                      </span>
                      <span className="shrink-0 text-label-xs text-on-surface-variant">
                        {formatVnd(product.base_price)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function OptionRow({
  option,
  priceMode,
  onRun,
  onPatch,
  onDrop,
}: {
  option: Tables<"product_options">;
  priceMode: string;
  onRun: RunFn;
  onPatch: (patch: Partial<Tables<"product_options">>) => void;
  onDrop: () => void;
}) {
  const savedPrice = Number(option.price_delta);
  const [name, setName] = useState(option.name);
  const [price, setPrice] = useState(savedPrice);
  const dirty = name.trim() !== option.name || price !== savedPrice;
  const replace = priceMode === "replace";

  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 py-2 first:border-t-0">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Tên biến thể ${option.name}`}
        className={`${inputClass} min-w-0 flex-1`}
      />
      <div className="w-28 shrink-0">
        <MoneyInput value={price} onChange={setPrice} />
      </div>
      <span className="shrink-0 text-label-xs text-on-surface-variant">
        {replace ? "giá bán" : "phụ phí"}
      </span>

      {dirty && (
        <button
          type="button"
          onClick={() =>
            void onRun(
              () =>
                updateOption(option.id, {
                  name: name.trim() || option.name,
                  price_delta: price,
                }),
              "Đã lưu biến thể.",
              () => onPatch({ name: name.trim() || option.name, price_delta: price }),
              () => {
                setName(option.name);
                setPrice(savedPrice);
              },
            )
          }
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-card bg-primary-container px-3 text-label-sm text-on-primary-container"
        >
          Lưu
        </button>
      )}

      <LabeledSwitch
        on={option.is_available}
        onChange={() =>
          void onRun(
            () => updateOption(option.id, { is_available: !option.is_available }),
            option.is_available ? "Đã đánh dấu tạm hết." : "Đã bật bán lại.",
            () => onPatch({ is_available: !option.is_available }),
          )
        }
        onLabel="Còn bán"
        offLabel="Tạm hết"
        tone="danger"
      />

      <button
        type="button"
        onClick={() => void onRun(() => deleteOption(option.id), "Đã xoá biến thể.", onDrop)}
        aria-label={`Xoá ${option.name}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </li>
  );
}
