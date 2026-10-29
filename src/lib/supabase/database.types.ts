export type AccountRole = "employer" | "writer";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: AccountRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: AccountRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_role: AccountRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
