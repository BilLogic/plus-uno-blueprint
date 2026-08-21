-- The blueprint said four things that are not true, and one lane that renders
-- without its own interaction line.
--
-- The largest is a shipped/planned inversion. `Post-Session Growth Loop ›
-- Complete reflection` describes the AI follow-up question card as current
-- state, on the HAPPY PATH, while `Wrap-Up › Prototype: Reflection redesign`
-- describes the same feature as "design stage, zero AI in the live reflection
-- code". Both rows are in this database. The live form has star ratings and
-- areas chips and no AI at all; the AI card is a Figma spec that has not been
-- piloted (Notion "Tutor Reflection Form Enhancement" → Rollout: "N/A until
-- pilot"). An agent reading the happy path would tell a tutor to answer a
-- question card that does not exist.
--
-- The rest: a password credential that was never issued (tutors sign in with
-- Google OAuth), "payroll software" where the name Workday is known and used
-- in the same step's own pills, clearances sent "to CMU" when only the CPO can
-- verify them, and Zoom written into five in-session sentences where the
-- session may equally be running on Pencil.
--
-- And a rendering bug with a data cause: two scenarios name their spine actor
-- `Tutor` where twenty name it `Regular Tutor`. The role is resolved from a
-- legacy NAME map (src/lib/laneRoles.ts) that knows 'Regular Tutor' and not
-- 'Tutor' — so Session Prep & Resources and Post-Session Growth Loop draw no
-- line of interaction at all. Renaming fixes it; setting `lane_role` on every
-- role-less lane stops the name map being load-bearing in the first place.

begin;

-- 1. The reflection is not an AI product yet -------------------------------

update cells set
  content = $q$Completes the post-session reflection — Session Information, a Student Reflection per student, Session Evaluation, and Self Reflection — rating with stars and picking from areas chips.$q$,
  summary = $q$The live form: session date and picker, students to reflect on, session files and recording, a per-student rating plus one note another tutor should know, then star ratings for the session and for their own performance. Free-text notes are left empty on about 80% of reflections, which is the problem the redesign exists to solve. The redesigned form — chips and an AI follow-up per section — is modelled on Wrap-Up's "Prototype: Reflection redesign" path and is not shipped.$q$
where id = 'c2000000-0000-4000-8000-000000000040';

update cells set
  summary = $q$Multi-section form reached from Your Sessions › Reflections or the Home Reflection tab. 1–5 star button-group ratings and adaptive areas chips; recording upload accepts up to 5 files and 1GB. It carries NO AI question card — that is the unshipped redesign, modelled on Wrap-Up's prototype path.$q$
where id = 'c2000000-0000-4000-8000-000000000041';

update cells set
  content = $q$Supervisors track reflection completion and export answers from the Tutors admin page; a flagged reflection opens a supervisor follow-up.$q$,
  summary = $q$Reflections are reviewed by export, not by a dashboard. Feeding them into AI Student Insights is Phase 3 of the reflection redesign PRD and an explicit non-goal of the current work — it does not happen today.$q$
where id = 'c2000000-0000-4000-8000-000000000043';

-- The follow-up LLM does not exist on this path. The row is not deleted: it is
-- the same touchpoint the Wrap-Up prototype names, so it keeps its identity
-- and says which side of the line it is on.
update cells set
  content = $q$Reflection store$q$,
  summary = $q$Submitted reflections land in session_reflection, keyed by session_reflection_id, carrying video_name and recording_uploaded; a Box upload script archives the recording off the app VM and clears the local folder. The per-section follow-up question LLM belongs to the unshipped redesign — see Wrap-Up's "Prototype: Reflection redesign".$q$
where id = 'c2000000-0000-4000-8000-000000000042';

-- 2. No password was ever issued -------------------------------------------

update cells set
  summary = $q$The supervisor team emails the tutor which address to sign in with, and the setup steps that follow. Sign-in itself is Google OAuth on the email on file — no password is issued.$q$
where id = 'a0000000-0000-4000-8000-000000100806';

-- 3. Name the system a reader can check ------------------------------------

update cells set
  content = $q$Completes the employer-side student employment paperwork in Workday.$q$
where id = 'a0000000-0000-4000-8000-000000100607';

-- 4. Only the CPO can verify a clearance ------------------------------------

update cells set
  content = $q$Completes clearances with the CPO, who confirms them to PLUS.$q$,
  summary = $q$PLUS staff cannot verify clearance documents themselves and self-reported clearance is legally unusable, so the tutor's documents go to the CPO and the confirmation comes back from there.$q$
where id = 'a0000000-0000-4000-8000-000000100303';

-- 5. A session runs on Zoom OR Pencil ---------------------------------------
-- `Zoom` stays the pill for Zoom used OUTSIDE a session — the info session,
-- the group interview, a supervisor follow-up call. These five are mid-session.

update cells set content = $q$Reminds students to plug in their headphones and use their real names in the session.$q$
where id = 'a0000000-0000-4000-8000-000000180601';
update cells set content = $q$Joins the Zoom/Pencil session.$q$
where id = 'a0000000-0000-4000-8000-000000180203';
update cells set content = $q$Posts the session link in the school's learning platform or shares the QR code, depending on session needs.$q$
where id = 'a0000000-0000-4000-8000-000000180301';
update cells set content = $q$Zoom/Pencil$q$
where id = '7d47fc7c-071f-46be-914c-bcffbbaca729';
update cells set content = $q$Helps students leave the session.$q$
where id = 'a0000000-0000-4000-8000-0000001c0101';
update cells set content = $q$Fills out the reflection form and uploads the session recording.$q$
where id = 'a0000000-0000-4000-8000-0000001c0403';
update cells set content = $q$Reminds tutors to upload the session recording and complete the reflection form.$q$
where id = 'a0000000-0000-4000-8000-0000001c0402';

-- 6. One name for the spine actor, and a role that does not depend on it -----

update lanes set name = 'Regular Tutor' where name = 'Tutor';

update lanes l set lane_role = m.role
from (values
  ('Customer Actions','customer_actions'),
  ('Regular Tutor','customer_actions'),
  ('Front Stage Actions','frontstage_actions'),
  ('Frontstage Actions','frontstage_actions'),
  ('Back Stage Actions','backstage_actions'),
  ('Backstage Actions','backstage_actions'),
  ('Front Stage Tech','frontstage_tech'),
  ('Back Stage Tech','backstage_tech'),
  ('Computer Systems','support_systems'),
  ('Visual','visual'),
  ('Step Visual','step_visual')
) as m(name, role)
where l.lane_role is null and l.name = m.name;

do $$
declare n int;
begin
  select count(*) into n from lanes where name = 'Tutor';
  if n > 0 then raise exception 'a lane is still called Tutor: %', n; end if;

  select count(*) into n from lanes where name = 'Regular Tutor' and lane_role is distinct from 'customer_actions';
  if n > 0 then raise exception '% Regular Tutor lanes still carry no customer_actions role', n; end if;

  select count(*) into n from cells
   where content ilike '%AI follow-up question card%'
     and lane_id in (select l.id from lanes l join paths p on p.id=l.path_id where p.path_type = 'happy');
  if n > 0 then raise exception '% happy-path cells still claim the AI card is shipped', n; end if;

  select count(*) into n from cells where content = 'Sends clearances to CMU.';
  if n > 0 then raise exception 'the CMU clearance claim survived'; end if;
end $$;

commit;
