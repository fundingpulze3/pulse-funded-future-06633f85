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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          purchase_id: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          purchase_id: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          purchase_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_status_history_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "challenge_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          commission_amount: number | null
          commission_status: string
          created_at: string
          id: string
          purchase_id: string | null
          referred_id: string
          referrer_id: string
        }
        Insert: {
          commission_amount?: number | null
          commission_status?: string
          created_at?: string
          id?: string
          purchase_id?: string | null
          referred_id: string
          referrer_id: string
        }
        Update: {
          commission_amount?: number | null
          commission_status?: string
          created_at?: string
          id?: string
          purchase_id?: string | null
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "challenge_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image: string | null
          role: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          image?: string | null
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "blog_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          canonical_url: string | null
          content: string
          created_at: string
          excerpt: string | null
          focus_keyword: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          published_at: string | null
          reading_time: number | null
          slug: string
          sort_order: number | null
          thumbnail_alt: string | null
          thumbnail_ratio: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          canonical_url?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time?: number | null
          slug: string
          sort_order?: number | null
          thumbnail_alt?: string | null
          thumbnail_ratio?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          canonical_url?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time?: number | null
          slug?: string
          sort_order?: number | null
          thumbnail_alt?: string | null
          thumbnail_ratio?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          background_image_url: string
          certificate_type: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          background_image_url: string
          certificate_type: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Update: {
          background_image_url?: string
          certificate_type?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_visible: boolean
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_visible?: boolean
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_visible?: boolean
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenge_purchases: {
        Row: {
          amount_paid: number
          challenge_id: string
          created_at: string
          id: string
          last_payout_at: string | null
          payment_status: string
          reward_cycle: string | null
          status: string
          swap_free: boolean
          total_profit: number | null
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          amount_paid: number
          challenge_id: string
          created_at?: string
          id?: string
          last_payout_at?: string | null
          payment_status?: string
          reward_cycle?: string | null
          status?: string
          swap_free?: boolean
          total_profit?: number | null
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          amount_paid?: number
          challenge_id?: string
          created_at?: string
          id?: string
          last_payout_at?: string | null
          payment_status?: string
          reward_cycle?: string | null
          status?: string
          swap_free?: boolean
          total_profit?: number | null
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_purchases_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          account_size: number
          created_at: string
          daily_drawdown: string
          id: string
          is_active: boolean
          leverage: string
          max_drawdown: string
          min_trading_days: string
          name: string
          price: number
          profit_target: string
          step_type: string
        }
        Insert: {
          account_size: number
          created_at?: string
          daily_drawdown: string
          id?: string
          is_active?: boolean
          leverage?: string
          max_drawdown: string
          min_trading_days: string
          name: string
          price: number
          profit_target: string
          step_type: string
        }
        Update: {
          account_size?: number
          created_at?: string
          daily_drawdown?: string
          id?: string
          is_active?: boolean
          leverage?: string
          max_drawdown?: string
          min_trading_days?: string
          name?: string
          price?: number
          profit_target?: string
          step_type?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
        }
        Relationships: []
      }
      help_article_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          id: string
          is_helpful: boolean
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_helpful: boolean
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_helpful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "help_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          author_id: string
          collection_id: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          slug: string
          sort_order: number | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          collection_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          slug: string
          sort_order?: number | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          collection_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          slug?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "help_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      help_collections: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      help_support_tickets: {
        Row: {
          article_id: string | null
          auto_reply_sent: boolean
          created_at: string
          email: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          last_reply_at: string | null
          message: string
          name: string
          priority: string
          source: string
          status: string
          subject: string
        }
        Insert: {
          article_id?: string | null
          auto_reply_sent?: boolean
          created_at?: string
          email: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_reply_at?: string | null
          message: string
          name: string
          priority?: string
          source?: string
          status?: string
          subject: string
        }
        Update: {
          article_id?: string | null
          auto_reply_sent?: boolean
          created_at?: string
          email?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_reply_at?: string | null
          message?: string
          name?: string
          priority?: string
          source?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_support_tickets_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          created_at: string
          document_back_url: string | null
          document_front_url: string | null
          document_type: string | null
          face_video_url: string | null
          id: string
          occupation: string | null
          preferred_trading_strategy: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_of_funds: string | null
          status: string
          trading_experience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_type?: string | null
          face_video_url?: string | null
          id?: string
          occupation?: string | null
          preferred_trading_strategy?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_of_funds?: string | null
          status?: string
          trading_experience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string | null
          document_type?: string | null
          face_video_url?: string | null
          id?: string
          occupation?: string | null
          preferred_trading_strategy?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_of_funds?: string | null
          status?: string
          trading_experience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_content: {
        Row: {
          content: string
          created_at: string
          id: string
          page_slug: string
          section_key: string
          sort_order: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          page_slug: string
          section_key: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          page_slug?: string
          section_key?: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          created_at: string
          id: string
          page_url: string
          referrer: string | null
          session_id: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_url: string
          referrer?: string | null
          session_id: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_url?: string
          referrer?: string | null
          session_id?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_details: Json | null
          payment_method: string
          payout_number: string
          profit_split_percentage: number
          purchase_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reward_cycle: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_details?: Json | null
          payment_method?: string
          payout_number?: string
          profit_split_percentage?: number
          purchase_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_cycle?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_details?: Json | null
          payment_method?: string
          payout_number?: string
          profit_split_percentage?: number
          purchase_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_cycle?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "challenge_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_gmail_ids: {
        Row: {
          gmail_uid: string
          id: string
          processed_at: string
        }
        Insert: {
          gmail_uid: string
          id?: string
          processed_at?: string
        }
        Update: {
          gmail_uid?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          created_at: string
          gmail_message_id: string | null
          id: string
          message: string
          sender_email: string | null
          sender_name: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          message: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          message?: string
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "help_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_credentials: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          challenge_id: string
          created_at: string
          id: string
          is_assigned: boolean
          mt5_login: string
          mt5_password: string
          mt5_server: string
          purchase_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          challenge_id: string
          created_at?: string
          id?: string
          is_assigned?: boolean
          mt5_login: string
          mt5_password: string
          mt5_server?: string
          purchase_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          challenge_id?: string
          created_at?: string
          id?: string
          is_assigned?: boolean
          mt5_login?: string
          mt5_password?: string
          mt5_server?: string
          purchase_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_credentials_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_credentials_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "challenge_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_certificates: {
        Row: {
          account_number: string | null
          certificate_image_url: string | null
          certificate_type: string
          created_at: string
          credential_id: string | null
          description: string | null
          id: string
          pdf_url: string | null
          purchase_id: string | null
          stats: Json | null
          title: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          certificate_image_url?: string | null
          certificate_type?: string
          created_at?: string
          credential_id?: string | null
          description?: string | null
          id?: string
          pdf_url?: string | null
          purchase_id?: string | null
          stats?: Json | null
          title?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          certificate_image_url?: string | null
          certificate_type?: string
          created_at?: string
          credential_id?: string | null
          description?: string | null
          id?: string
          pdf_url?: string | null
          purchase_id?: string | null
          stats?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_certificates_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "trading_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certificates_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "challenge_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "administrator" | "employee"
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
      app_role: ["admin", "moderator", "user", "administrator", "employee"],
    },
  },
} as const
