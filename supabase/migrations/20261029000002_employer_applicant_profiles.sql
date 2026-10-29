create policy "Employers can read profiles of applicants to their jobs"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.applications as application
    join public.jobs as job on job.id = application.job_id
    where application.writer_id = profiles.id
      and job.employer_id = (select auth.uid())
  )
);
