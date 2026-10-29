export type AccountRole = "employer" | "writer";
export type JobStatus = "pending" | "approved" | "rejected" | "closed";
export type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          id: string;
          job_id: string;
          writer_id: string;
          cover_letter: string;
          proposed_budget: number | null;
          status: ApplicationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          writer_id: string;
          cover_letter: string;
          proposed_budget?: number | null;
          status?: ApplicationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ApplicationStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_writer_id_fkey";
            columns: ["writer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          employer_id: string;
          title: string;
          description: string;
          category: string;
          budget_min: number;
          budget_max: number;
          currency: string;
          word_count: number | null;
          deadline: string | null;
          status: JobStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employer_id: string;
          title: string;
          description: string;
          category: string;
          budget_min: number;
          budget_max: number;
          currency?: string;
          word_count?: number | null;
          deadline?: string | null;
          status?: JobStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          category?: string;
          budget_min?: number;
          budget_max?: number;
          currency?: string;
          word_count?: number | null;
          deadline?: string | null;
          status?: JobStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_employer_id_fkey";
            columns: ["employer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: AccountRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
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
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      account_role: AccountRole;
      application_status: ApplicationStatus;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
