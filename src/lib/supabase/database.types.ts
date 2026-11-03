export type AccountRole = "employer" | "writer";
export type JobStatus = "pending" | "approved" | "rejected" | "closed";
export type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn";
export type OfferStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";
export type AssignmentStatus = "in_progress" | "submitted_for_review" | "revision_requested" | "completed" | "cancelled";
export type SubmissionStatus = "submitted" | "revision_requested" | "approved";
export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded" | "disputed";

type GeneratedTable<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          id: string;
          job_id: string;
          writer_id: string;
          cover_letter: string;
          experience_summary: string;
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
          experience_summary?: string;
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
          is_draft: boolean;
          filled_at: string | null;
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
          is_draft?: boolean;
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
          is_draft?: boolean;
          filled_at?: string | null;
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
          bio: string;
          skills: string[];
          portfolio_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: AccountRole;
          bio?: string;
          skills?: string[];
          portfolio_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          bio?: string;
          skills?: string[];
          portfolio_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_offers: GeneratedTable<{
        id: string; job_id: string; application_id: string; employer_id: string; writer_id: string;
        amount: number; currency: string; instructions: string; status: OfferStatus; expires_at: string;
        responded_at: string | null; created_at: string; updated_at: string;
      }, {
        id?: string; job_id: string; application_id: string; employer_id: string; writer_id: string;
        amount: number; currency: string; instructions?: string; status?: OfferStatus; expires_at?: string;
        responded_at?: string | null; created_at?: string; updated_at?: string;
      }>;
      assignments: GeneratedTable<{
        id: string; job_id: string; offer_id: string; employer_id: string; writer_id: string;
        agreed_amount: number; currency: string; instructions: string; deadline: string | null;
        status: AssignmentStatus; accepted_at: string; completed_at: string | null;
        created_at: string; updated_at: string;
      }, {
        id?: string; job_id: string; offer_id: string; employer_id: string; writer_id: string;
        agreed_amount: number; currency: string; instructions?: string; deadline?: string | null;
        status?: AssignmentStatus; accepted_at?: string; completed_at?: string | null;
        created_at?: string; updated_at?: string;
      }>;
      work_submissions: GeneratedTable<{
        id: string; assignment_id: string; writer_id: string; version: number; storage_path: string;
        file_name: string; mime_type: string; file_size: number; comments: string;
        status: SubmissionStatus; review_notes: string | null; reviewed_at: string | null; created_at: string;
      }, {
        id?: string; assignment_id: string; writer_id: string; version: number; storage_path: string;
        file_name: string; mime_type: string; file_size: number; comments?: string;
        status?: SubmissionStatus; review_notes?: string | null; reviewed_at?: string | null; created_at?: string;
      }>;
      notifications: GeneratedTable<{
        id: string; recipient_id: string; actor_id: string | null; event_type: string; title: string;
        body: string; href: string; read_at: string | null; created_at: string;
      }, {
        id?: string; recipient_id: string; actor_id?: string | null; event_type: string; title: string;
        body: string; href: string; read_at?: string | null; created_at?: string;
      }>;
      messages: GeneratedTable<{
        id: string; job_id: string | null; assignment_id: string | null; sender_id: string;
        recipient_id: string; body: string; read_at: string | null; created_at: string;
      }, {
        id?: string; job_id?: string | null; assignment_id?: string | null; sender_id: string;
        recipient_id: string; body: string; read_at?: string | null; created_at?: string;
      }>;
      payments: GeneratedTable<{
        id: string; assignment_id: string; employer_id: string; writer_id: string; amount: number;
        currency: string; status: PaymentStatus; collection_status: string; collection_confirmed_at: string | null;
        provider: string | null; provider_reference: string | null; confirmed_at: string | null; created_at: string; updated_at: string;
      }>;
      payment_attempts: GeneratedTable<{
        id: string; payment_id: string; employer_id: string; provider: string; merchant_request_id: string | null;
        checkout_request_id: string | null; phone_number: string; amount: number; status: string;
        receipt_number: string | null; result_code: string | null; result_description: string | null;
        callback_received_at: string | null; created_at: string; updated_at: string;
      }, {
        id?: string; payment_id: string; employer_id: string; provider?: string; merchant_request_id?: string | null;
        checkout_request_id?: string | null; phone_number: string; amount: number; status?: string;
        receipt_number?: string | null; result_code?: string | null; result_description?: string | null;
        callback_received_at?: string | null; created_at?: string; updated_at?: string;
      }>;
      reviews: GeneratedTable<{
        id: string; assignment_id: string; reviewer_id: string; reviewee_id: string; rating: number;
        comment: string; created_at: string;
      }>;
      disputes: GeneratedTable<{
        id: string; assignment_id: string; opened_by: string; reason: string; status: string;
        resolution: string | null; resolved_at: string | null; created_at: string; updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      award_job_offer: { Args: { target_application: string; offer_amount: number; offer_instructions?: string }; Returns: string };
      respond_to_job_offer: { Args: { target_offer: string; accept_offer: boolean }; Returns: string | null };
      submit_assignment_work: { Args: { target_assignment: string; file_path: string; upload_name: string; upload_mime: string; upload_size: number; writer_comments?: string }; Returns: string };
      review_assignment_submission: { Args: { target_assignment: string; decision: string; notes?: string }; Returns: undefined };
      cancel_assignment: { Args: { target_assignment: string; cancellation_reason?: string }; Returns: undefined };
      process_daraja_payment_callback: {
        Args: {
          target_checkout_id: string; target_merchant_id: string; callback_result_code: string;
          callback_result_description: string; callback_amount: number | null; callback_phone: string | null;
          callback_receipt: string | null;
        };
        Returns: string;
      };
      mark_notifications_read: { Args: { notification_ids: string[] }; Returns: undefined };
    };
    Enums: {
      account_role: AccountRole;
      application_status: ApplicationStatus;
      job_status: JobStatus;
      offer_status: OfferStatus;
      assignment_status: AssignmentStatus;
      submission_status: SubmissionStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
