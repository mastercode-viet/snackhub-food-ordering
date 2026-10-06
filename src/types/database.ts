/**
 * Sinh từ schema Supabase (project awquwyqtcbgbdqkpehnp).
 * Chạy lại sau mỗi lần đổi schema:
 *   supabase gen types typescript --project-id awquwyqtcbgbdqkpehnp > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          full_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: string
          id: string
          product_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          combo_id: string
          id?: string
          product_id: string
          quantity?: number
          sort_order?: number
        }
        Update: {
          combo_id?: string
          id?: string
          product_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          name: string
          price: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name: string
          price: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses: number | null
          min_order_amount: number
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          base_price: number
          combo_id: string | null
          combo_items_snapshot: Json
          created_at: string
          id: string
          item_note: string | null
          line_total: number
          options: Json
          options_price: number
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          base_price: number
          combo_id?: string | null
          combo_items_snapshot?: Json
          created_at?: string
          id?: string
          item_note?: string | null
          line_total: number
          options?: Json
          options_price?: number
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          base_price?: number
          combo_id?: string | null
          combo_items_snapshot?: Json
          created_at?: string
          id?: string
          item_note?: string | null
          line_total?: number
          options?: Json
          options_price?: number
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string | null
          assigned_staff_id: string | null
          building: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: Database["public"]["Enums"]["cancelled_by"] | null
          class_name: string | null
          collected_by_staff_id: string | null
          completed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_note: string | null
          discount_amount: number
          discount_code: string | null
          discount_code_id: string | null
          floor: string | null
          id: string
          order_code: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          payos_checkout_url: string | null
          payos_order_code: number | null
          payos_payment_link_id: string | null
          payos_qr_code: string | null
          room: string | null
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          assigned_staff_id?: string | null
          building: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: Database["public"]["Enums"]["cancelled_by"] | null
          class_name?: string | null
          collected_by_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_note?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_code_id?: string | null
          floor?: string | null
          id?: string
          order_code: string
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payos_checkout_url?: string | null
          payos_order_code?: number | null
          payos_payment_link_id?: string | null
          payos_qr_code?: string | null
          room?: string | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          assigned_staff_id?: string | null
          building?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: Database["public"]["Enums"]["cancelled_by"] | null
          class_name?: string | null
          collected_by_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_note?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_code_id?: string | null
          floor?: string | null
          id?: string
          order_code?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payos_checkout_url?: string | null
          payos_order_code?: number | null
          payos_payment_link_id?: string | null
          payos_qr_code?: string | null
          room?: string | null
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_collected_by_staff_id_fkey"
            columns: ["collected_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payos_webhook_events: {
        Row: {
          error_message: string | null
          event_hash: string
          id: string
          order_id: string | null
          payload: Json
          payos_order_code: number | null
          processed: boolean
          processed_at: string | null
          received_at: string
          reference: string | null
          signature: string | null
        }
        Insert: {
          error_message?: string | null
          event_hash: string
          id?: string
          order_id?: string | null
          payload: Json
          payos_order_code?: number | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          reference?: string | null
          signature?: string | null
        }
        Update: {
          error_message?: string | null
          event_hash?: string
          id?: string
          order_id?: string | null
          payload?: Json
          payos_order_code?: number | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          reference?: string | null
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payos_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_history: {
        Row: {
          amount: number
          confirmed_by: string
          created_at: string
          id: string
          paid_at: string
          pay_month: string
          staff_id: string
        }
        Insert: {
          amount: number
          confirmed_by: string
          created_at?: string
          id?: string
          paid_at?: string
          pay_month: string
          staff_id: string
        }
        Update: {
          amount?: number
          confirmed_by?: string
          created_at?: string
          id?: string
          paid_at?: string
          pay_month?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_select: number
          min_select: number
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_topping_groups: {
        Row: {
          product_id: string
          sort_order: number
          topping_group_id: string
        }
        Insert: {
          product_id: string
          sort_order?: number
          topping_group_id: string
        }
        Update: {
          product_id?: string
          sort_order?: number
          topping_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_topping_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_topping_groups_topping_group_id_fkey"
            columns: ["topping_group_id"]
            isOneToOne: false
            referencedRelation: "topping_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          name: string
          search_text: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name: string
          search_text?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name?: string
          search_text?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          bucket_key: string
          hit_count: number
          id: number
          window_start: string
        }
        Insert: {
          action: string
          bucket_key: string
          hit_count?: number
          id?: number
          window_start: string
        }
        Update: {
          action?: string
          bucket_key?: string
          hit_count?: number
          id?: number
          window_start?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          created_at: string
          id: string
          shift_id: string
          staff_id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift_id: string
          staff_id: string
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          id?: string
          shift_id?: string
          staff_id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          request_type: Database["public"]["Enums"]["shift_swap_request_type"]
          requester_assignment_id: string | null
          requester_staff_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          shift_end: string
          shift_name: string
          shift_start: string
          status: Database["public"]["Enums"]["shift_swap_status"]
          target_assignment_id: string | null
          target_shift_name: string | null
          target_staff_id: string | null
          target_work_date: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          request_type: Database["public"]["Enums"]["shift_swap_request_type"]
          requester_assignment_id?: string | null
          requester_staff_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shift_end: string
          shift_name: string
          shift_start: string
          status?: Database["public"]["Enums"]["shift_swap_status"]
          target_assignment_id?: string | null
          target_shift_name?: string | null
          target_staff_id?: string | null
          target_work_date?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          request_type?: Database["public"]["Enums"]["shift_swap_request_type"]
          requester_assignment_id?: string | null
          requester_staff_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shift_end?: string
          shift_name?: string
          shift_start?: string
          status?: Database["public"]["Enums"]["shift_swap_status"]
          target_assignment_id?: string | null
          target_shift_name?: string | null
          target_staff_id?: string | null
          target_work_date?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_requester_assignment_id_fkey"
            columns: ["requester_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_staff_id_fkey"
            columns: ["requester_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_assignment_id_fkey"
            columns: ["target_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          bank_account: string | null
          created_at: string
          email: string
          full_name: string
          hourly_rate: number
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          created_at?: string
          email: string
          full_name: string
          hourly_rate?: number
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          created_at?: string
          email?: string
          full_name?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          checkin_radius_m: number
          close_time: string
          id: number
          is_open: boolean
          min_order_amount: number
          open_time: string
          payos_hold_minutes: number
          shipping_fee: number
          store_latitude: number | null
          store_longitude: number | null
          store_name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          checkin_radius_m?: number
          close_time?: string
          id?: number
          is_open?: boolean
          min_order_amount?: number
          open_time?: string
          payos_hold_minutes?: number
          shipping_fee?: number
          store_latitude?: number | null
          store_longitude?: number | null
          store_name?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          checkin_radius_m?: number
          close_time?: string
          id?: number
          is_open?: boolean
          min_order_amount?: number
          open_time?: string
          payos_hold_minutes?: number
          shipping_fee?: number
          store_latitude?: number | null
          store_longitude?: number | null
          store_name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_logs: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          created_at: string
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          staff_id: string
          total_minutes_worked: number | null
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          staff_id: string
          total_minutes_worked?: number | null
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          staff_id?: string
          total_minutes_worked?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topping_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      topping_items: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "topping_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "topping_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_daily_stats: {
        Row: {
          avg_order_value: number | null
          cancelled_orders: number | null
          cod_revenue: number | null
          completed_orders: number | null
          day: string | null
          payos_revenue: number | null
          revenue: number | null
          sla_breached_orders: number | null
          total_discount: number | null
          total_orders: number | null
        }
        Relationships: []
      }
      admin_hourly_heatmap: {
        Row: {
          day: string | null
          hour: number | null
          total_orders: number | null
        }
        Relationships: []
      }
      admin_top_combos: {
        Row: {
          combo_id: string | null
          combo_name: string | null
          day: string | null
          total_quantity: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_top_products: {
        Row: {
          day: string | null
          product_id: string | null
          product_name: string | null
          total_quantity: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_order_by_code: {
        Args: { p_order_code: string; p_reason?: string }
        Returns: Json
      }
      cancel_shift_swap_request: { Args: { p_id: string }; Returns: undefined }
      cancel_stale_payos_orders: { Args: never; Returns: number }
      check_rate_limit: {
        Args: {
          p_action: string
          p_bucket_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      confirm_staff_payroll: {
        Args: { p_amount: number; p_pay_month: string; p_staff_id: string }
        Returns: {
          amount: number
          confirmed_by: string
          created_at: string
          id: string
          paid_at: string
          pay_month: string
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_shift_swap_request: {
        Args: {
          p_assignment_id: string
          p_reason?: string
          p_target_staff_id?: string
          p_type: Database["public"]["Enums"]["shift_swap_request_type"]
        }
        Returns: string
      }
      fetch_staff_directory: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      generate_order_code: { Args: never; Returns: string }
      get_order_by_code: { Args: { p_order_code: string }; Returns: Json }
      get_staff_attendance_detail: {
        Args: { p_month: string; p_staff_id: string }
        Returns: {
          check_in_at: string
          check_in_deviation_minutes: number
          check_out_at: string
          check_out_deviation_minutes: number
          shift_end: string
          shift_name: string
          shift_start: string
          work_date: string
        }[]
      }
      get_staff_attendance_stats: {
        Args: { p_month: string }
        Returns: {
          absent_count: number
          assigned_days: number
          early_leave_count: number
          full_name: string
          late_count: number
          staff_id: string
        }[]
      }
      get_staff_monthly_hours: {
        Args: { p_month: string }
        Returns: {
          full_name: string
          role: Database["public"]["Enums"]["staff_role"]
          shift_count: number
          staff_id: string
          total_hours: number
          total_minutes: number
        }[]
      }
      immutable_unaccent: { Args: { p_text: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_store_open: { Args: { p_at?: string }; Returns: boolean }
      preview_discount_code: {
        Args: { p_code: string; p_subtotal: number }
        Returns: {
          discount_amount: number
          discount_code: string
          discount_code_id: string
        }[]
      }
      purge_old_rate_limits: { Args: never; Returns: undefined }
      redeem_discount_code: {
        Args: { p_code: string; p_subtotal: number }
        Returns: {
          discount_amount: number
          discount_code: string
          discount_code_id: string
        }[]
      }
      release_discount_code: {
        Args: { p_discount_code_id: string }
        Returns: undefined
      }
      resolve_shift_swap_request: {
        Args: {
          p_approve: boolean
          p_id: string
          p_note?: string
          p_replacement_staff_id?: string
          p_target_assignment_id?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      cancelled_by: "customer" | "admin" | "system"
      discount_type: "percent" | "fixed"
      order_status:
        | "pending_confirmation"
        | "preparing"
        | "delivering"
        | "completed"
        | "cancelled"
      payment_method: "cod" | "payos"
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"
      shift_swap_request_type: "swap" | "leave"
      shift_swap_status: "pending" | "approved" | "rejected" | "cancelled"
      staff_role: "superadmin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cancelled_by: ["customer", "admin", "system"],
      discount_type: ["percent", "fixed"],
      order_status: [
        "pending_confirmation",
        "preparing",
        "delivering",
        "completed",
        "cancelled",
      ],
      payment_method: ["cod", "payos"],
      payment_status: ["unpaid", "pending", "paid", "failed", "refunded"],
      shift_swap_request_type: ["swap", "leave"],
      shift_swap_status: ["pending", "approved", "rejected", "cancelled"],
      staff_role: ["superadmin", "staff"],
    },
  },
} as const
