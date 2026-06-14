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
      addresses: {
        Row: {
          address: string
          apartment: string | null
          comment: string | null
          created_at: string
          entrance: string | null
          floor: string | null
          id: string
          is_default: boolean
          label: string | null
          user_id: string
        }
        Insert: {
          address: string
          apartment?: string | null
          comment?: string | null
          created_at?: string
          entrance?: string | null
          floor?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          user_id: string
        }
        Update: {
          address?: string
          apartment?: string | null
          comment?: string | null
          created_at?: string
          entrance?: string | null
          floor?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_link: string | null
          eyebrow: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_link?: string | null
          eyebrow?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      bonus_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      branch_product_stock: {
        Row: {
          branch_id: string
          id: string
          min_stock: number
          product_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          id?: string
          min_stock?: number
          product_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          id?: string
          min_stock?: number
          product_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_product_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_stock: {
        Row: {
          branch_id: string
          id: string
          ingredient_id: string
          min_stock: number
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          id?: string
          ingredient_id: string
          min_stock?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          id?: string
          ingredient_id?: string
          min_stock?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          kkt_model: string | null
          kkt_operator_inn: string | null
          kkt_operator_name: string
          kkt_payments_address: string | null
          kkt_payments_place: string | null
          kkt_tax_system: string
          kkt_url: string | null
          kkt_vat: string
          name: string
          phone: string | null
          sort_order: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          kkt_model?: string | null
          kkt_operator_inn?: string | null
          kkt_operator_name?: string
          kkt_payments_address?: string | null
          kkt_payments_place?: string | null
          kkt_tax_system?: string
          kkt_url?: string | null
          kkt_vat?: string
          name: string
          phone?: string | null
          sort_order?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          kkt_model?: string | null
          kkt_operator_inn?: string | null
          kkt_operator_name?: string
          kkt_payments_address?: string | null
          kkt_payments_place?: string | null
          kkt_tax_system?: string
          kkt_url?: string | null
          kkt_vat?: string
          name?: string
          phone?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      callback_requests: {
        Row: {
          branch_id: string | null
          comment: string | null
          created_at: string
          id: string
          name: string
          phone: string
          status: string
        }
        Insert: {
          branch_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
          status?: string
        }
        Update: {
          branch_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "callback_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callback_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          branch_id: string | null
          card_total: number
          cash_total: number
          closed_at: string | null
          closing_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          orders_count: number
        }
        Insert: {
          branch_id?: string | null
          card_total?: number
          cash_total?: number
          closed_at?: string | null
          closing_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by: string
          opening_cash?: number
          orders_count?: number
        }
        Update: {
          branch_id?: string | null
          card_total?: number
          cash_total?: number
          closed_at?: string | null
          closing_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          orders_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      combos: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      couriers: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couriers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          cost: number
          created_at: string
          districts: string[] | null
          free_from: number | null
          id: string
          is_active: boolean
          min_order: number
          name: string
          polygon: Json | null
          radius_km: number | null
          sort_order: number
          streets: string | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          cost?: number
          created_at?: string
          districts?: string[] | null
          free_from?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name: string
          polygon?: Json | null
          radius_km?: number | null
          sort_order?: number
          streets?: string | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          cost?: number
          created_at?: string
          districts?: string[] | null
          free_from?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name?: string
          polygon?: Json | null
          radius_km?: number | null
          sort_order?: number
          streets?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          spent_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          spent_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          spent_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredient_components: {
        Row: {
          branch_id: string | null
          component_ingredient_id: string
          created_at: string
          id: string
          parent_ingredient_id: string
          qty: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          component_ingredient_id: string
          created_at?: string
          id?: string
          parent_ingredient_id: string
          qty: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          component_ingredient_id?: string
          created_at?: string
          id?: string
          parent_ingredient_id?: string
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_components_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_components_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_components_component_ingredient_id_fkey"
            columns: ["component_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_components_parent_ingredient_id_fkey"
            columns: ["parent_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          is_prepared: boolean
          min_stock: number
          name: string
          prep_yield: number
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          is_prepared?: boolean
          min_stock?: number
          name: string
          prep_yield?: number
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          is_prepared?: boolean
          min_stock?: number
          name?: string
          prep_yield?: number
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_counts: {
        Row: {
          branch_id: string
          counted: number
          created_at: string
          created_by: string | null
          diff: number
          expected: number
          id: string
          ingredient_id: string
          note: string | null
        }
        Insert: {
          branch_id: string
          counted: number
          created_at?: string
          created_by?: string | null
          diff?: number
          expected?: number
          id?: string
          ingredient_id: string
          note?: string | null
        }
        Update: {
          branch_id?: string
          counted?: number
          created_at?: string
          created_by?: string | null
          diff?: number
          expected?: number
          id?: string
          ingredient_id?: string
          note?: string | null
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          published_at: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          published_at?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          published_at?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      order_changes: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_changes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          modifiers: Json
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          total: number
        }
        Insert: {
          id?: string
          modifiers?: Json
          name: string
          order_id: string
          price: number
          product_id?: string | null
          quantity?: number
          total: number
        }
        Update: {
          id?: string
          modifiers?: Json
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          total?: number
        }
        Relationships: [
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
          address: string | null
          admin_note: string | null
          bonus_credited_at: string | null
          bonus_earned: number
          bonus_used: number
          branch_id: string | null
          change_from: number | null
          comment: string | null
          confirmed_at: string | null
          courier_id: string | null
          created_at: string
          customer_name: string
          deleted_at: string | null
          delivery_cost: number
          delivery_time: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount: number
          done_at: string | null
          fiscal_payload: Json | null
          fiscal_printed_at: string | null
          fiscal_receipt_number: string | null
          fiscal_receipt_url: string | null
          holiday_discount_kind:
            | Database["public"]["Enums"]["holiday_discount_kind"]
            | null
          id: string
          kitchen_printed_at: string | null
          number: number
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          persons: number | null
          phone: string
          pickup_point: string | null
          promo_code: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admin_note?: string | null
          bonus_credited_at?: string | null
          bonus_earned?: number
          bonus_used?: number
          branch_id?: string | null
          change_from?: number | null
          comment?: string | null
          confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name: string
          deleted_at?: string | null
          delivery_cost?: number
          delivery_time?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount?: number
          done_at?: string | null
          fiscal_payload?: Json | null
          fiscal_printed_at?: string | null
          fiscal_receipt_number?: string | null
          fiscal_receipt_url?: string | null
          holiday_discount_kind?:
            | Database["public"]["Enums"]["holiday_discount_kind"]
            | null
          id?: string
          kitchen_printed_at?: string | null
          number?: number
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          persons?: number | null
          phone: string
          pickup_point?: string | null
          promo_code?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admin_note?: string | null
          bonus_credited_at?: string | null
          bonus_earned?: number
          bonus_used?: number
          branch_id?: string | null
          change_from?: number | null
          comment?: string | null
          confirmed_at?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name?: string
          deleted_at?: string | null
          delivery_cost?: number
          delivery_time?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount?: number
          done_at?: string | null
          fiscal_payload?: Json | null
          fiscal_printed_at?: string | null
          fiscal_receipt_number?: string | null
          fiscal_receipt_url?: string | null
          holiday_discount_kind?:
            | Database["public"]["Enums"]["holiday_discount_kind"]
            | null
          id?: string
          kitchen_printed_at?: string | null
          number?: number
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          persons?: number | null
          phone?: string
          pickup_point?: string | null
          promo_code?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifiers: {
        Row: {
          modifier_id: string
          product_id: string
        }
        Insert: {
          modifier_id: string
          product_id: string
        }
        Update: {
          modifier_id?: string
          product_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          calories: number | null
          carbs: number | null
          category_id: string | null
          created_at: string
          description: string | null
          fat: number | null
          id: string
          image_url: string | null
          in_stock: boolean
          ingredients: string | null
          is_active: boolean
          is_addon: boolean
          is_recommended: boolean
          is_semi_product: boolean
          name: string
          price: number
          protein: number | null
          sku: string | null
          sort_order: number
          tags: string[]
          unit: string | null
          updated_at: string
          weight: string | null
          writeoff_mode: string
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fat?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          ingredients?: string | null
          is_active?: boolean
          is_addon?: boolean
          is_recommended?: boolean
          is_semi_product?: boolean
          name: string
          price?: number
          protein?: number | null
          sku?: string | null
          sort_order?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
          weight?: string | null
          writeoff_mode?: string
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          fat?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          ingredients?: string | null
          is_active?: boolean
          is_addon?: boolean
          is_recommended?: boolean
          is_semi_product?: boolean
          name?: string
          price?: number
          protein?: number | null
          sku?: string | null
          sort_order?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
          weight?: string | null
          writeoff_mode?: string
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
      profiles: {
        Row: {
          anniversary_date: string | null
          birth_date: string | null
          bonus_balance: number
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          total_spent: number
        }
        Insert: {
          anniversary_date?: string | null
          birth_date?: string | null
          bonus_balance?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_spent?: number
        }
        Update: {
          anniversary_date?: string | null
          birth_date?: string | null
          bonus_balance?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_spent?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          gift_product_id: string | null
          gift_product_image_url: string | null
          gift_product_name: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order: number
          starts_at: string | null
          used_count: number
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          gift_product_id?: string | null
          gift_product_image_url?: string | null
          gift_product_name?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          starts_at?: string | null
          used_count?: number
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          gift_product_id?: string | null
          gift_product_image_url?: string | null
          gift_product_name?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          starts_at?: string | null
          used_count?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          id: string
          ingredient_id: string
          invoice_id: string
          price: number
          qty: number
          total: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          invoice_id: string
          price?: number
          qty: number
          total?: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          invoice_id?: string
          price?: number
          qty?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          note: string | null
          posted_at: string | null
          status: string
          supplier_id: string | null
          total: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          note?: string | null
          posted_at?: string | null
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          note?: string | null
          posted_at?: string | null
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          branch_id: string | null
          component_product_id: string | null
          id: string
          ingredient_id: string | null
          product_id: string
          qty: number
        }
        Insert: {
          branch_id?: string | null
          component_product_id?: string | null
          id?: string
          ingredient_id?: string | null
          product_id: string
          qty?: number
        }
        Update: {
          branch_id?: string | null
          component_product_id?: string | null
          id?: string
          ingredient_id?: string | null
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          branch_id: string | null
          created_at: string
          delta: number
          id: string
          ingredient_id: string
          order_id: string | null
          reason: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          delta: number
          id?: string
          ingredient_id: string
          order_id?: string | null
          reason: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          ingredient_id?: string
          order_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          ingredient_id: string
          note: string | null
          qty: number
          to_branch_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_branch_id: string
          id?: string
          ingredient_id: string
          note?: string | null
          qty: number
          to_branch_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_branch_id?: string
          id?: string
          ingredient_id?: string
          note?: string | null
          qty?: number
          to_branch_id?: string
        }
        Relationships: []
      }
      stock_writeoffs: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          qty: number
          reason: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          qty: number
          reason?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          qty?: number
          reason?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_person: string | null
          created_at: string
          id: string
          inn: string | null
          is_active: boolean
          name: string
          note: string | null
          phone: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          id?: string
          inn?: string | null
          is_active?: boolean
          name: string
          note?: string | null
          phone?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          id?: string
          inn?: string | null
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      writeoff_schedules: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          days_of_week: number[]
          id: string
          last_run_at: string | null
          name: string
          scope: string
          target_id: string
          time_of_day: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          last_run_at?: string | null
          name: string
          scope: string
          target_id: string
          time_of_day?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          days_of_week?: number[]
          id?: string
          last_run_at?: string | null
          name?: string
          scope?: string
          target_id?: string
          time_of_day?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "writeoff_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "writeoff_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      branches_public: {
        Row: {
          address: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          sort_order: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          sort_order?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      expand_product: {
        Args: { _branch_id: string; _multiplier: number; _product_id: string }
        Returns: {
          ingredient_id: string
          qty: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      issue_vk_welcome_promo: { Args: never; Returns: string }
      loyalty_tier: { Args: { _total: number }; Returns: string }
      post_purchase_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      prepared_ingredient_cost: {
        Args: { _ingredient_id: string }
        Returns: number
      }
      product_cost: { Args: { _product_id: string }; Returns: number }
      recompute_prepared_costs: { Args: never; Returns: undefined }
      run_writeoff_schedule: { Args: { _schedule_id: string }; Returns: Json }
      user_branch: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      delivery_type: "delivery" | "pickup"
      holiday_discount_kind: "birthday" | "anniversary"
      order_status:
        | "new"
        | "confirmed"
        | "cooking"
        | "delivering"
        | "done"
        | "cancelled"
      payment_method: "cash" | "card_courier" | "card_online"
      payment_status: "unpaid" | "paid" | "refunded"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user", "super_admin"],
      delivery_type: ["delivery", "pickup"],
      holiday_discount_kind: ["birthday", "anniversary"],
      order_status: [
        "new",
        "confirmed",
        "cooking",
        "delivering",
        "done",
        "cancelled",
      ],
      payment_method: ["cash", "card_courier", "card_online"],
      payment_status: ["unpaid", "paid", "refunded"],
    },
  },
} as const
