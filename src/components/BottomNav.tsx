import { NavLink } from "react-router-dom";
import { ReceiptText, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useCartCount } from "@/store/cart";

type Tab = { to: string; label: string; icon: LucideIcon; badge?: number };

export default function BottomNav() {
  const cartCount = useCartCount();

  const tabs: Tab[] = [
    { to: "/", label: "Trang chủ", icon: Store },
    { to: "/thuc-don", label: "Thực đơn", icon: UtensilsCrossed },
    { to: "/gio-hang", label: "Giỏ hàng", icon: ShoppingBag, badge: cartCount },
    { to: "/don-hang", label: "Đơn & Tôi", icon: ReceiptText },
  ];

  return (
    <>
      {/* ── Desktop: thanh ngang trên đầu ───────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 hidden border-b border-outline-variant/60 bg-surface-container-lowest/85 backdrop-blur-xl md:block">
        <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-gutter">
          <NavLink to="/" className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
            <img
              src="/logo.png"
              alt="Bếp Của Thỏ"
              width={156}
              height={160}
              className="size-10 shrink-0 object-contain drop-shadow-sm"
            />
            <span className="font-bold text-headline-sm tracking-tight text-on-surface">
              Snack<span className="text-primary">Hub</span>
            </span>
          </NavLink>

          <nav className="flex items-center gap-1.5">
            {tabs.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `relative flex min-h-[44px] items-center gap-2 rounded-full px-4 text-label-md transition-all duration-200 ${
                    isActive
                      ? "bg-inverse-surface text-inverse-on-surface shadow-cta font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container/70 hover:text-on-surface"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{label}</span>
                    {badge !== undefined && badge > 0 && (
                      <motion.span
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className={`ml-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-label-xs font-bold ${
                          isActive ? "bg-primary text-on-primary" : "bg-primary text-on-primary shadow-badge"
                        }`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </motion.span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Mobile: thanh nổi mép dưới ──────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 glass-nav border-t border-white/60 shadow-sheet pb-safe md:hidden">
        <div className="px-margin-mobile">
          <div className="flex h-16 items-center justify-around">
            {tabs.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className="group relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center px-1 transition-colors"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="activeBottomTab"
                        className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-surface-container/80 -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}

                    <span className="relative flex items-center justify-center">
                      <motion.span
                        animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className={`grid size-7 place-items-center transition-colors duration-200 ${
                          isActive ? "text-primary font-bold" : "text-on-surface-variant group-hover:text-on-surface"
                        }`}
                      >
                        <Icon size={21} strokeWidth={isActive ? 2.6 : 1.8} />
                      </motion.span>

                      {badge !== undefined && badge > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          className="absolute -right-2.5 -top-1 h-4 min-w-[18px] rounded-full bg-primary px-1 text-center text-label-xs font-black leading-4 text-on-primary shadow-badge"
                        >
                          {badge > 99 ? "99+" : badge}
                        </motion.span>
                      )}
                    </span>

                    <span
                      className={`mt-0.5 text-label-xs normal-case tracking-normal transition-colors duration-200 ${
                        isActive ? "font-bold text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}
