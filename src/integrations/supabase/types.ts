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
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          sort_order: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          sort_order?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
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
        ]
      }
      delivery_zones: {
        Row: {
          cost: number
          created_at: string
          free_from: number | null
          id: string
          is_active: boolean
          min_order: number
          name: string
          sort_order: number
        }
        Insert: {
          cost?: number
          created_at?: string
          free_from?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name: string
          sort_order?: number
        }
        Update: {
          cost?: number
          created_at?: string
          free_from?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name?: string
          sort_order?: number
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
      ingredients: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          min_stock: number
          name: string
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          stock?: number
          unit?: string
          updated_at?: string
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
          id: string
          number: number
          payment_method: Database["public"]["Enums"]["payment_method"]
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
          id?: string
          number?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
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
          id?: string
          number?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
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
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          ingredients: string | null
          is_active: boolean
          is_addon: boolean
          is_recommended: boolean
          name: string
          price: number
          sku: string | null
          sort_order: number
          tags: string[]
          unit: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          ingredients?: string | null
          is_active?: boolean
          is_addon?: boolean
          is_recommended?: boolean
          name: string
          price?: number
          sku?: string | null
          sort_order?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          ingredients?: string | null
          is_active?: boolean
          is_addon?: boolean
          is_recommended?: boolean
          name?: string
          price?: number
          sku?: string | null
          sort_order?: number
          tags?: string[]
          unit?: string | null
          updated_at?: string
          weight?: string | null
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
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order?: number
          starts_at?: string | null
          used_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          qty: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          qty?: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: []
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
          created_at: string
          delta: number
          id: string
          ingredient_id: string
          order_id: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          ingredient_id: string
          order_id?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          ingredient_id?: string
          order_id?: string | null
          reason?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      loyalty_tier: { Args: { _total: number }; Returns: string }
      user_branch: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
      delivery_type: "delivery" | "pickup"
      order_status:
        | "new"
        | "confirmed"
        | "cooking"
        | "delivering"
        | "done"
        | "cancelled"
      payment_method: "cash" | "card_courier" | "card_online"
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
      order_status: [
        "new",
        "confirmed",
        "cooking",
        "delivering",
        "done",
        "cancelled",
      ],
      payment_method: ["cash", "card_courier", "card_online"],
    },
  },
} as const
