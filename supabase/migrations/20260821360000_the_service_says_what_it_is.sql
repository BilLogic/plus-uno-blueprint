-- The service was called "PLUS Application" and summarised as "Application
-- through onboarding and session lifecycle" — a name that described the app
-- rather than the service, and a summary that listed three of six phases
-- using the word this schema just retired.
--
-- The service panel puts this line under the title on every overview, so it
-- is the first sentence anyone reads.

update public.services
set name = 'PLUS Tutoring',
    summary = 'A hybrid human-AI tutoring service: university students run live, in-class math sessions for middle schoolers, supported by an app that handles their hiring, scheduling, session tooling and reflection.',
    updated_at = now()
where id = (select id from public.services order by created_at limit 1);

do $$
declare s text;
begin
  select summary into s from services limit 1;
  if s ~* 'lifecycle' then raise exception 'the summary still says lifecycle'; end if;
  if length(s) < 60 then raise exception 'the summary is too short to be one'; end if;
end $$;
