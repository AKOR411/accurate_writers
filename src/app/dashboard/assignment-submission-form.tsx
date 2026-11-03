"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useMemo, useState, useTransition } from "react";
import { registerWorkSubmission, type DashboardActionState } from "@/app/actions/dashboard";
import type { Database } from "@/lib/supabase/database.types";

const mimeByExtension: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
const maxSize = 25 * 1024 * 1024;

export default function AssignmentSubmissionForm({
  assignmentId,
  writerId,
  supabaseUrl,
  supabaseAnonKey,
}: {
  assignmentId: string;
  writerId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  const supabase = useMemo(
    () => createBrowserClient<Database>(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey],
  );
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!file) {
      setError("Choose a DOC, DOCX, or PDF file to submit.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = mimeByExtension[extension];
    if (!mimeType || (file.type && file.type !== mimeType)) {
      setError("Only DOC, DOCX, and PDF files are supported.");
      return;
    }
    if (file.size <= 0 || file.size > maxSize) {
      setError("Files must be no larger than 25 MB.");
      return;
    }
    if (comments.length > 2000) {
      setError("Keep comments under 2,000 characters.");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${assignmentId}/${writerId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("work-submissions")
      .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("storage_path", storagePath);
    formData.set("file_name", file.name);
    formData.set("mime_type", mimeType);
    formData.set("file_size", String(file.size));
    formData.set("comments", comments);
    startTransition(async () => {
      const result: DashboardActionState = await registerWorkSubmission({}, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Work submitted.");
        setFile(null);
        setComments("");
      }
    });
  }

  return (
    <form className="dashboard-form assignment-submission-form" onSubmit={submit}>
      <label
        className="assignment-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) setFile(droppedFile);
        }}
      >
        <input
          accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
          className="visually-hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <strong>{file ? file.name : "Drop your file here or browse files"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "DOC, DOCX, or PDF · up to 25 MB"}</span>
      </label>
      <label>
        Comments <span className="dashboard-optional">(optional)</span>
        <textarea maxLength={2000} onChange={(event) => setComments(event.target.value)} rows={3} value={comments} />
      </label>
      {error && <p className="dashboard-feedback error" role="alert">{error}</p>}
      {success && <p className="dashboard-feedback success" role="status">{success}</p>}
      <button className="button dashboard-form-submit" disabled={isPending || !file} type="submit">
        {isPending ? "Submitting..." : "Submit work"}
      </button>
    </form>
  );
}
