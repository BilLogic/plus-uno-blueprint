-- One cell per touchpoint, and pills that are names.
--
-- A tech pill is the touchpoint's NAME. What happens there is `summary`; why
-- is `function`. All three were being packed into `content`, so the canvas
-- carried sentences where it should carry names.
--
-- Every split source was checked for edges first (`cell_dependencies`) and
-- none had any, so no edge had to choose a half. `tech_description` links key
-- off the pill label and were checked too: no renamed row carries a link
-- whose label matched its own content.
--
-- NOT here: the twelve `Planned — …` rows. That prefix is a MATURITY, and
-- this database has no column for one. Dropping the word would make an
-- unbuilt surface read as a shipped one on the canvas, which is worse than a
-- long pill. They need `cells.maturity` and a renderer marker first.

begin;

/*
  One statement, one table of decisions. `summary` is written only where the
  content was carrying the sentence — `null` leaves the existing summary
  alone, because most of these rows already had the right one underneath the
  wrong pill.
*/
update public.cells as c
set content = v.content,
    summary = coalesce(v.summary, c.summary)
from (values
    ('c2000000-0000-4000-8000-000000000038', $q$Accredible$q$, null),
    ('92429dbd-93e3-4319-ad8c-605b1d932b92', $q$Assignment algorithm$q$, null),
    ('768ab8c7-5640-4e17-ac97-20b47b4f1704', $q$SessionAttendance$q$, null),
    ('45596a59-7bf2-40fc-8012-eb11c38fb817', $q$Clearance ETL$q$, null),
    ('bfaa2a4e-fe92-4506-8cfd-ef1c1f3d0c88', $q$Slack bridge$q$, null),
    ('b0000000-0000-4000-8000-000000180408', $q$Fill-in pool$q$, null),
    ('b0000000-0000-4000-8000-000000170408', $q$Fill-in pool$q$, null),
    ('383d5f0f-43a2-43c6-8402-f2ece077473d', $q$Group foreign key$q$, null),
    ('c2000000-0000-4000-8000-000000000036', $q$LessonLLMFeedback$q$, null),
    ('0877d3e4-55ed-4eba-a0fd-5aef8a5bd219', $q$Live rebalancing$q$, null),
    ('c2000000-0000-4000-8000-000000000034', $q$LLM microservice$q$, null),
    ('b0000000-0000-4000-8000-0000001e1105', $q$No Workday link$q$, null),
    ('b2000000-0000-4000-8000-000000000043', $q$placeSingleStudent$q$, null),
    ('b0000000-0000-4000-8000-000000180508', $q$PLUS App$q$, null),
    ('a0000000-0000-4000-8000-000000170508', $q$PLUS App$q$, null),
    ('e33d3256-d138-47d0-9c60-3cc13ea9aec1', $q$No Workday link$q$, null),
    ('b0000000-0000-4000-8000-000000140108', $q$PLUS App database$q$, null),
    ('c1000000-0000-4000-8000-000000000036', $q$resource_assigned record$q$, null),
    ('05f42ce6-ecd7-40a9-acd6-ea237202287d', $q$Per-student dashboard$q$, null),
    ('f189c060-68c8-41bf-b15b-31ab69f57bf0', $q$RCT condition$q$, null),
    ('b4556df8-9f49-4dbf-990a-8a7a88b13a02', $q$Reconfirmation fan-out$q$, null),
    ('f16deb3d-d0a2-41e3-9b75-74f76a4bc3c2', $q$RCT condition$q$, null),
    ('b0000000-0000-4000-8000-000000150208', $q$Slack bridge$q$, null),
    ('e0000000-0000-4000-8000-000000000633', $q$Slack webhook$q$, null),
    ('e7895077-b8d9-492c-a9e0-d38a88c4b53a', $q$Slack webhook$q$, null),
    ('172c92fc-655b-4231-8ed0-1ffd6ea7005e', $q$Videoconf attendance$q$, null),
    ('c1000000-0000-4000-8000-000000000033', $q$WizardSession$q$, null),
    ('802ecb88-257b-47a9-be10-dee9d320daf3', $q$Session record$q$, null),
    ('fa0c97ce-88b1-49c1-ad5e-3cb8a9576a28', $q$Tutors admin page$q$, null),
    ('ff053fda-10fd-4b1d-a600-c3d406359ba2', $q$Kickoff interview page$q$, null),
    ('c2000000-0000-4000-8000-000000000031', $q$PLUS App$q$, null),
    ('a0000000-0000-4000-8000-000000170206', $q$PLUS App$q$, null),
    ('a0000000-0000-4000-8000-000000150106', $q$PLUS App$q$, null),
    ('c1000000-0000-4000-8000-000000000031', $q$PLUS App$q$, null),
    ('1e3b9d6c-caa3-4c40-9ccb-b612412184eb', $q$Profile page$q$, null),
    ('8b687314-3285-4eb0-803a-c7dfa20d6dbe', $q$Sessions admin$q$, null),
    ('b3000000-0000-4000-8000-000000000034', $q$Slack$q$, null),
    ('eac5de64-65df-4e45-9ca3-36eb930af18d', $q$Students admin page$q$, null),
    ('b2000000-0000-4000-8000-000000000044', $q$Attendance-change handlers$q$, $q$Attendance changes trigger handlers that rebalance tutor assignments.$q$),
    ('a5061cb0-6a7b-4619-b48e-750cf79c4c55', $q$In-session notes$q$, $q$Notes taken during the session are auto-saved and prefill the reflection afterwards.$q$),
    ('c2000000-0000-4000-8000-000000000042', $q$Follow-up question LLM$q$, $q$Per section, an LLM call turns the structured answers into one personalized follow-up question; the free-text answer is stored with the reflection.$q$),
    ('b0000000-0000-4000-8000-000000140306', $q$PLUS App$q$, $q$Alerts and reconfirmation requests reach the tutor here.$q$),
    ('a0000000-0000-4000-8000-000000170606', $q$PLUS App$q$, $q$The Call-Offs tab.$q$),
    ('b0000000-0000-4000-8000-000000180606', $q$PLUS App$q$, $q$The Call-Offs tab.$q$),
    ('b0000000-0000-4000-8000-000000180306', $q$PLUS App$q$, $q$The Call-Offs tab — the same surface early call-offs use.$q$),
    ('a0000000-0000-4000-8000-000000150206', $q$PLUS App$q$, $q$The Fill-In tab.$q$),
    ('b0000000-0000-4000-8000-000000180406', $q$PLUS App$q$, $q$The Fill-In tab.$q$),
    ('a0000000-0000-4000-8000-000000170406', $q$PLUS App$q$, $q$The Fill-In tab.$q$),
    ('e0000000-0000-4000-8000-000000000662', $q$PLUS App$q$, $q$The My Sessions tab.$q$),
    ('e0000000-0000-4000-8000-000000000632', $q$PLUS App$q$, $q$The Tutor Profile page.$q$),
    ('c2000000-0000-4000-8000-000000000041', $q$Tutor Reflection Form$q$, $q$The reflection form carries an AI question card per section.$q$),
    ('b0000000-0000-4000-8000-000000140208', $q$Calendar feed$q$, $q$The app serves a per-tutor calendar feed (GCal/iCal subscribe); feed events intentionally omit student names and Zoom links.$q$),
    ('2b29d3f4-1281-4f92-a9a9-a5e458d9b4cd', $q$Goal entity$q$, null),
    ('bc67fa25-cfa6-4ea1-835c-b4eb06bbf773', $q$Slack webhooks$q$, $q$Follow-ups ride the Slack webhook bridges — there is no dedicated issue-tracking system yet.$q$),
    ('68d60077-bb99-435a-874b-427df175dbb9', $q$Goal-update ETL$q$, $q$Goal-update ETL scripts run Sundays to compute cycle progress and system suggestions. A teacher-set-goal warm-up phase precedes some cycles.$q$),
    ('e0000000-0000-4000-8000-000000000622', $q$Acceptance form (Google Form)$q$, null),
    ('7d47fc7c-071f-46be-914c-bcffbbaca729', $q$Zoom$q$, null)
) as v(id, content, summary)
where c.id = v.id::uuid;

-- Two touchpoints in one cell become two cells in the same slot: the slot
-- already holds a list, keyed `unique (lane_id, step_id, position)`.
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$Reminder emails$q$, $q$The app sends 30-minute pre-session reminder emails to tutors.$q$, position + 1, origin
from public.cells where id = 'b0000000-0000-4000-8000-000000140208';
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$Usage entity$q$, $q$Per-platform usage is persisted alongside goals, one record per edtech platform.$q$, position + 1, origin
from public.cells where id = '2b29d3f4-1281-4f92-a9a9-a5e458d9b4cd';
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$Email service$q$, $q$The async email microservice (EmailHelper templates) carries follow-up notifications.$q$, position + 1, origin
from public.cells where id = 'bc67fa25-cfa6-4ea1-835c-b4eb06bbf773';
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$Teacher goal email$q$, $q$Teacher-facing goal emails go out Mondays, after the Sunday ETL run.$q$, position + 1, origin
from public.cells where id = '68d60077-bb99-435a-874b-427df175dbb9';
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$Workday$q$, null, position + 1, origin
from public.cells where id = 'e0000000-0000-4000-8000-000000000622';
insert into public.cells (path_id, lane_id, step_id, content, summary, position, origin)
select path_id, lane_id, step_id, $q$PLUS Wrap-Up Dashboard$q$, null, position + 1, origin
from public.cells where id = '7d47fc7c-071f-46be-914c-bcffbbaca729';

-- Assertions. A silent no-op is the failure mode that matters here: an id
-- that has moved leaves the sentence on the canvas and nothing says so.
do $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.cells c join public.lanes l on l.id = c.lane_id
  where l.lane_role in ('frontstage_tech','backstage_tech')
    and c.content not like 'Planned %'
    and (
      length(c.content) > 48
      or c.content ~ '[+;]'
      or c.content like '%.'
      or position(E'\n' in c.content) > 0
    );
  if remaining <> 0 then
    raise exception 'touchpoint sweep: % tech cells still carry a sentence', remaining;
  end if;
end $$;

commit;
