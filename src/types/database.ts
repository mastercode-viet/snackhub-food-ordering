/**
 * Sinh từ schema Supabase (project awquwyqtcbgbdqkpehnp).
 * Chạy lại sau mỗi lần đổi schema:
 *   supabase gen types typescript --project-id awquwyqtcbgbdqkpehnp > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: { created_at: string; full_name: string | null; user_id: string };
        Insert: { created_at?: string; full_name?: string | null; user_id: string };
        Update: { created_at?: string; full_name?: string | null; user_id?: string };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      combo_items: {
        Row: {
          combo_id: string;
          id: string;
          product_id: string;
          quantity: number;
          sort_order: number;
        };
        Insert: {
          combo_id: string;
          id?: string;
          product_id: string;
          quantity?: number;
          sort_order?: number;
        };
        Update: {
          combo_id?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey";
            columns: ["combo_id"];
            isOneToOne: false;
            referencedRelation: "combos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "combo_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      combos: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          is_featured: boolean;
          name: string;
          price: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          name: string;
          price: number;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          name?: string;
          price?: number;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          max_discount_amount: number | null;
          max_uses: number | null;
          min_order_amount: number;
          starts_at: string | null;
          type: Database["public"]["Enums"]["discount_type"];
          updated_at: string;
          used_count: number;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          max_discount_amount?: number | null;
          max_uses?: number | null;
          min_order_amount?: number;
          starts_at?: string | null;
          type: Database["public"]["Enums"]["discount_type"];
          updated_at?: string;
          used_count?: number;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          max_discount_amount?: number | null;
          max_uses?: number | null;
          min_order_amount?: number;
          starts_at?: string | null;
          type?: Database["public"]["Enums"]["discount_type"];
          updated_at?: string;
          used_count?: number;
          value?: number;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          base_price: number;
          combo_id: string | null;
          combo_items_snapshot: Json;
          created_at: string;
          id: string;
          item_note: string | null;
          line_total: number;
          options: Json;
          options_price: number;
          order_id: string;
          product_id: string | null;
          product_image_url: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          base_price: number;
          combo_id?: string | null;
          combo_items_snapshot?: Json;
          created_at?: string;
          id?: string;
          item_note?: string | null;
          line_total: number;
          options?: Json;
          options_price?: number;
          order_id: string;
          product_id?: string | null;
          product_image_url?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          base_price?: number;
          combo_id?: string | null;
          combo_items_snapshot?: Json;
          created_at?: string;
          id?: string;
          item_note?: string | null;
          line_total?: number;
          options?: Json;
          options_price?: number;
          order_id?: string;
          product_id?: string | null;
          product_image_url?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
        };
        // combo_id CHỈ phục vụ join/báo cáo, KHÔNG dùng để hiển thị — hiển thị
        // dựa vào product_name/product_image_url/base_price (đã snapshot) và
        // combo_items_snapshot. Xem comment cột tương ứng trong migration.
        Relationships: [
          {
            foreignKeyName: "order_items_combo_id_fkey";
            columns: ["combo_id"];
            isOneToOne: false;
            referencedRelation: "combos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          admin_note: string | null;
          building: string;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: Database["public"]["Enums"]["cancelled_by"] | null;
          class_name: string | null;
          completed_at: string | null;
          created_at: string;
          customer_name: string;
          customer_phone: string;
          delivery_note: string | null;
          discount_amount: number;
          discount_code: string | null;
          discount_code_id: string | null;
          floor: string | null;
          id: string;
          order_code: string;
          paid_at: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          payos_checkout_url: string | null;
          payos_order_code: number | null;
          payos_payment_link_id: string | null;
          room: string | null;
          shipping_fee: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total_amount: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          building: string;
          customer_name: string;
          customer_phone: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          subtotal: number;
          total_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      product_option_groups: {
        Row: {
          created_at: string;
          id: string;
          is_required: boolean;
          max_select: number;
          min_select: number;
          name: string;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_select?: number;
          min_select?: number;
          name: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_select?: number;
          min_select?: number;
          name?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_options: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          is_available: boolean;
          name: string;
          price_delta: number;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          is_available?: boolean;
          name: string;
          price_delta?: number;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          is_available?: boolean;
          name?: string;
          price_delta?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      product_topping_groups: {
        Row: {
          product_id: string;
          sort_order: number;
          topping_group_id: string;
        };
        Insert: {
          product_id: string;
          sort_order?: number;
          topping_group_id: string;
        };
        Update: {
          product_id?: string;
          sort_order?: number;
          topping_group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_topping_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_topping_groups_topping_group_id_fkey";
            columns: ["topping_group_id"];
            isOneToOne: false;
            referencedRelation: "topping_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          base_price: number;
          category_id: string | null;
          created_at: string;
          description: string | null;
          discount_percent: number;
          id: string;
          image_url: string | null;
          is_available: boolean;
          is_featured: boolean;
          name: string;
          search_text: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          base_price: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          discount_percent?: number;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          discount_percent?: number;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_featured?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        // supabase-js dùng Relationships để giải nested select
        // (ví dụ .select("*, categories(icon)")) — không được để rỗng.
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          close_time: string;
          id: number;
          is_open: boolean;
          min_order_amount: number;
          open_time: string;
          payos_hold_minutes: number;
          shipping_fee: number;
          store_name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["store_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["store_settings"]["Row"]>;
        Relationships: [];
      };
      topping_groups: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      topping_items: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          is_available: boolean;
          name: string;
          price_delta: number;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          is_available?: boolean;
          name: string;
          price_delta?: number;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          is_available?: boolean;
          name?: string;
          price_delta?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "topping_items_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "topping_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      // payos_webhook_events và rate_limits chỉ Edge Function chạm tới —
      // frontend không có quyền, nên cố tình không khai báo ở đây.
    };
    Views: {
      admin_daily_stats: {
        Row: {
          avg_order_value: number | null;
          cancelled_orders: number | null;
          completed_orders: number | null;
          day: string | null;
          revenue: number | null;
          total_discount: number | null;
          total_orders: number | null;
        };
        Relationships: [];
      };
      admin_top_products: {
        Row: {
          day: string | null;
          product_id: string | null;
          product_name: string | null;
          total_quantity: number | null;
          total_revenue: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cancel_order_by_code: {
        Args: { p_order_code: string; p_reason?: string };
        Returns: Json;
      };
      get_order_by_code: { Args: { p_order_code: string }; Returns: Json };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_store_open: { Args: { p_at?: string }; Returns: boolean };
    };
    Enums: {
      cancelled_by: "customer" | "admin" | "system";
      discount_type: "percent" | "fixed";
      order_status: "pending_confirmation" | "preparing" | "delivering" | "completed" | "cancelled";
      payment_method: "cod" | "payos";
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
