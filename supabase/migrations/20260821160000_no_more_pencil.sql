-- PLUS does not run sessions on Pencil any more.
--
-- `Zoom/Pencil` was one pill for two tools because a session ran on one or
-- the other and the blueprint did not branch on which. With Pencil gone the
-- pair is a name for a thing that no longer exists, and it was on 79 cells.
-- The lowercase `zoom/pencil` alias stays in the app so an older slice or a
-- hand-typed label still resolves — to Zoom, not to a second touchpoint.
--
-- And the scenario: "Post-Session Growth Loop" did not read like anything a
-- tutor does. What it holds is the AI Coach review, the training lessons and
-- the badge — coaching aimed at one person. Bill's name: Personalized
-- Coaching.

begin;

update cells set
  content = regexp_replace(content, 'Zoom/Pencil', 'Zoom', 'g'),
  summary = regexp_replace(coalesce(summary,''), 'Zoom/Pencil', 'Zoom', 'g'),
  picture = replace(coalesce(picture,''), 'pencil-logo.png', 'zoom-logo.png')
where content like '%Pencil%' or summary like '%Pencil%' or coalesce(picture,'') like '%pencil%';

update steps set summary = regexp_replace(summary, 'Zoom/Pencil', 'Zoom', 'g')
where summary like '%Pencil%';
update paths set summary = regexp_replace(coalesce(summary,''), 'Zoom/Pencil', 'Zoom', 'g'),
                 note    = regexp_replace(coalesce(note,''), 'Zoom/Pencil', 'Zoom', 'g')
where summary like '%Pencil%' or note like '%Pencil%';
update scenarios set summary = regexp_replace(summary, 'Zoom/Pencil', 'Zoom', 'g') where summary like '%Pencil%';
update phases set summary = regexp_replace(coalesce(summary,''), 'Zoom/Pencil', 'Zoom', 'g') where summary like '%Pencil%';

update scenarios set
  name = 'Personalized Coaching',
  summary = 'What a tutor does with their own development after a session: the AI Coach review, if they are one of the tutors it exists for, then the training lessons and the certification badge. The reflection they fill in first is modelled in Session Reflection.'
where id = 'c2000000-0000-4000-8000-000000000001';

update cells set summary = replace(summary, 'Post-Session Growth Loop', 'Personalized Coaching')
where summary like '%Post-Session Growth Loop%';
update steps set summary = replace(summary, 'Post-Session Growth Loop', 'Personalized Coaching')
where summary like '%Post-Session Growth Loop%';
update steps set summary = replace(summary, 'the growth loop', 'personalized coaching')
where summary like '%the growth loop%';
update cells set summary = replace(summary, 'the growth loop', 'personalized coaching')
where summary like '%the growth loop%';

do $$
declare n int;
begin
  select count(*) into n from cells where content like '%Pencil%' or summary like '%Pencil%' or coalesce(picture,'') like '%pencil%';
  if n > 0 then raise exception '% cells still mention Pencil', n; end if;
  select count(*) into n from steps where summary like '%Pencil%';
  if n > 0 then raise exception '% steps still mention Pencil', n; end if;
  select count(*) into n from scenarios where name = 'Post-Session Growth Loop';
  if n > 0 then raise exception 'the old scenario name survived'; end if;
end $$;

commit;
