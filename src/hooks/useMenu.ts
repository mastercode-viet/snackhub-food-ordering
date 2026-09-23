import { useMemo } from "react";
import { useAsync } from "@/hooks/useAsync";
import {
  fetchCategories,
  fetchComboBySlug,
  fetchProductBySlug,
  fetchProducts,
  fetchStoreOpen,
  fetchStoreSettings,
  type ComboDetail,
  type ProductDetail,
  type ProductWithCategory,
} from "@/lib/queries";
import type { Tables } from "@/types/database";

export function useCategories() {
  return useAsync<Tables<"categories">[]>(fetchCategories, []);
}

export function useStoreSettings() {
  return useAsync<Tables<"store_settings">>(fetchStoreSettings, []);
}

export function useStoreOpen() {
  return useAsync<boolean>(fetchStoreOpen, []);
}

export function useProductDetail(slug: string | undefined) {
  const fn = useMemo(
    () => () => (slug ? fetchProductBySlug(slug) : Promise.resolve(null)),
    [slug],
  );

  return useAsync<ProductDetail | null>(fn, [slug]);
}

export function useComboDetail(slug: string | undefined) {
  const fn = useMemo(
    () => () => (slug ? fetchComboBySlug(slug) : Promise.resolve(null)),
    [slug],
  );

  return useAsync<ComboDetail | null>(fn, [slug]);
}

export function useProducts(params: { categoryId?: string | null; search?: string }) {
  const { categoryId = null, search = "" } = params;

  const fn = useMemo(
    () => () => fetchProducts({ categoryId, search }),
    [categoryId, search],
  );

  return useAsync<ProductWithCategory[]>(fn, [categoryId, search]);
}
