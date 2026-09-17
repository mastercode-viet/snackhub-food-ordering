import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
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
  type ToppingGroupFull,
} from "@/lib/adminQueries";

export default function AdminToppingsPage() {
  const state = useAsync(
    async () => ({
      groups: await fetchToppingGroups(),
      products: await fetchAdminProducts(),
      assignments: await fetchAssignments(),
    }),
    [],
  );

  const [newGroup, setNewGroup] = useState("");

  async function run(action: () => Promise<unknown>, okMessage: string) {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  }

  if (state.loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  if (state.error) return <ErrorState onRetry={state.reload} />;

  const { groups, products, assignments } = state.data!;

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-sm text-on-surface">Nhóm topping</h1>
        <p className="text-body-sm text-on-surface-variant">
          Một nhóm gán được cho nhiều món. Sửa giá hay xoá topping ở đây không làm thay đổi
          các đơn đã đặt trước đó.
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
          placeholder="Tên nhóm mới, ví dụ: Topping trà sữa"
          className="min-h-[44px] flex-1 rounded-card border border-outline-variant bg-surface-container-lowest px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface"
        >
          <Plus size={17} strokeWidth={2.4} />
          Tạo nhóm
        </button>
      </form>

      {groups.length === 0 ? (
        <EmptyState
          icon="🧋"
          title="Chưa có nhóm topping nào"
          description="Tạo nhóm đầu tiên ở ô phía trên."
        />
      ) : (
        <div className="flex flex-col gap-space-md">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              products={products}
              assignedProductIds={assignments[group.id] ?? []}
              onRun={run}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

function GroupCard({
  group,
  products,
  assignedProductIds,
  onRun,
}: {
  group: ToppingGroupFull;
  products: { id: string; name: string }[];
  assignedProductIds: string[];
  onRun: RunFn;
}) {
  const [name, setName] = useState(group.name);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [picked, setPicked] = useState<string[]>(assignedProductIds);

  const assignedNames = products
    .filter((p) => assignedProductIds.includes(p.id))
    .map((p) => p.name);

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
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
          className="min-h-[44px] min-w-0 flex-1 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-label-lg text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />

        <button
          type="button"
          onClick={() => {
            if (!confirm(`Xoá nhóm "${group.name}" và toàn bộ topping bên trong?`)) return;
            void onRun(() => deleteToppingGroup(group.id), "Đã xoá nhóm.");
          }}
          aria-label={`Xoá nhóm ${group.name}`}
          className="inline-flex size-11 items-center justify-center rounded-card border border-outline-variant text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={17} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex flex-col divide-y divide-outline-variant">
        {group.topping_items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-md text-on-surface">{item.name}</p>
              <p className="text-label-sm text-primary">+{formatVnd(item.price_delta)}</p>
            </div>

            <button
              type="button"
              onClick={() =>
                void onRun(
                  () => updateToppingItem(item.id, { is_available: !item.is_available }),
                  item.is_available ? "Đã tắt topping." : "Đã bật lại topping.",
                )
              }
              className={`inline-flex min-h-[44px] items-center rounded-card border px-3 text-label-sm transition-colors ${
                item.is_available
                  ? "border-outline-variant text-secondary"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {item.is_available ? "Còn hàng" : "Tạm hết"}
            </button>

            <button
              type="button"
              onClick={() => void onRun(() => deleteToppingItem(item.id), "Đã xoá topping.")}
              aria-label={`Xoá ${item.name}`}
              className="inline-flex size-11 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
            >
              <X size={17} strokeWidth={2.4} />
            </button>
          </div>
        ))}
      </div>

      <form
        className="flex flex-wrap gap-2"
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
          className="min-h-[44px] w-28 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
        >
          <Plus size={16} strokeWidth={2.4} />
          Thêm
        </button>
      </form>

      <div className="flex flex-col gap-2 border-t border-outline-variant pt-space-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-label-sm text-on-surface-variant">
            Áp dụng cho:{" "}
            <span className="text-on-surface">
              {assignedNames.length > 0 ? assignedNames.join(", ") : "chưa gán món nào"}
            </span>
          </p>

          <button
            type="button"
            onClick={() => {
              setPicked(assignedProductIds);
              setAssigning((v) => !v);
            }}
            className="inline-flex min-h-[44px] items-center rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            {assigning ? "Đóng" : "Chọn món"}
          </button>
        </div>

        {assigning && (
          <div className="flex flex-col gap-2">
            <div className="grid gap-1.5 sm:grid-cols-2">
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
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-card border px-3 text-left text-body-md transition-colors ${
                      on
                        ? "border-secondary bg-secondary-fixed/50 text-on-secondary-fixed"
                        : "border-outline-variant text-on-surface"
                    }`}
                  >
                    <span className="inline-flex size-5 shrink-0 items-center justify-center">
                      {on && <Check size={16} strokeWidth={2.6} className="text-secondary" />}
                    </span>
                    <span className="min-w-0 truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setAssigning(false);
                void onRun(() => setGroupProducts(group.id, picked), "Đã cập nhật món áp dụng.");
              }}
              className="min-h-[44px] self-start rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface"
            >
              Lưu danh sách món
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
