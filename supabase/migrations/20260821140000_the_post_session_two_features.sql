-- Post-session held two features in one vague scenario, and most of what it
-- said about both was wrong.
--
-- Read against CMU-PLUS/web-app @ 5cbe8a2. Twelve things the blueprint
-- asserted are contradicted by the code:
--
--   * AI Coach has THREE sections — it has two. Time Allocation is commented
--     out in the JSP, the renderer's import, the renderer's call, the DTO
--     field and the helper that would fill it. A tutor sees Impact and then
--     Growth Insights with nothing between them.
--   * The section is called "AI Growth Insights" — the heading reads "Growth
--     Insights". The word AI appears in the sidebar name and in a disclaimer.
--   * Insights are rated thumbs up/down — they are rated Helpful, Not Helpful
--     or Inaccurate. Two of the three buttons carry thumbs icons, which is
--     probably where the belief came from.
--   * Ratings feed something — nothing reads them back. Their one working
--     consequence is unlocking the next insight in the period.
--   * Everyone can open AI Coach — the servlet redirects to /PLUS unless the
--     tutor already has an insight row, and the sidebar entry is hidden by
--     the same check. Enrolment IS having data: there is no experiment,
--     cohort or feature-flag table anywhere.
--   * Reflection answers feed growth insights — insights quote SESSION
--     TRANSCRIPTS. Nothing connects a reflection to an insight, and the PRD
--     lists that connection as a Phase 3 non-goal. The edge asserting it is
--     deleted here, along with one asserting an AI question trigger that also
--     does not exist.
--   * Self Reflection is cadence-gated every tenth session — it is in every
--     reflection. There is no session_count anywhere in the reflection path.
--   * The escalation checkbox is recorded — it fires a Slack webhook and is
--     then discarded. No column holds it.
--   * Lead tutors fill in something different — they do not. The form is
--     identical; eligibility is the only place the app distinguishes them.
--
-- So: the reflection form becomes its own scenario at full detail, AI Coach
-- gets a step for the gate that decides whether any of it happens, and the
-- Growth Loop keeps a pointer instead of a second half-copy.

begin;

-- 1. AI Coach: a step for the gate that decides whether any of it happens ----

insert into steps (id, scenario_id, name, summary, origin) values
('c2000000-0000-4000-8000-0000000000a1','c2000000-0000-4000-8000-000000000001','Open AI Coach',
 'The tutor opens AI Coach from the Toolkit sidebar — if the entry is there at all. The page exists only for tutors who already have insights, so for most of the roster this step does not happen.','import');

update path_steps set position = position + 1
where path_id = 'c2000000-0000-4000-8000-000000000002' and position >= 2;

insert into path_steps (path_id, step_id, position) values
('c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-0000000000a1',2);

insert into cells (id, path_id, lane_id, step_id, position, content, summary, origin) values
('c2000000-0000-4000-8000-0000000000b1','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000011','c2000000-0000-4000-8000-0000000000a1',0,
 'Opens AI Coach from the Toolkit sidebar.',
 'Only if it is there. TutorReviewServlet redirects to /PLUS unless the tutor already has at least one tutor_ai_insight row, and the sidebar entry is hidden by the same check — so for a tutor with no insights the page is not merely empty, it is absent.','import'),
('c2000000-0000-4000-8000-0000000000b2','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000012','c2000000-0000-4000-8000-0000000000a1',0,
 'AI Coach',
 '/PLUS/TutorReview, browser title "PLUS AI Coach", sidebar entry under Toolkit with a New! badge, nested inside the PLUS Tutoring flag. A feature-announcement modal fires on Home for the same audience.','import'),
('c2000000-0000-4000-8000-0000000000b3','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000015','c2000000-0000-4000-8000-0000000000a1',0,
 'Insight presence gate',
 'A single-row lookup on tutor_ai_insight for that advisor. There is no experiment, cohort, variant or feature-flag table anywhere: enrolment IS having data, so whoever inserts the rows decides who sees the page, from outside the app.','import');

update cells set
  content = 'Reads Your Impact — sessions, hours, students, schools.',
  summary = 'Four tiles over the chosen period, counted from sessions the tutor actually attended: sessions attended, total session time to one decimal place, distinct students with an "n with reflections" subtitle, and distinct schools listed by name. Underneath, a callout names their busiest day of the week — a string template, not a model.'
where id = 'c2000000-0000-4000-8000-000000000030';

update cells set
  content = 'AI Coach',
  summary = 'The page reads "Your Month in Review, {name}" with a period dropdown built from whatever period pairs exist for that tutor. The heading says Month unconditionally, though the schema stores an arbitrary period_start/period_end pair and the labeller handles cross-month ranges.'
where id = 'c2000000-0000-4000-8000-000000000031';

insert into cells (id, path_id, lane_id, step_id, position, content, summary, origin) values
('c2000000-0000-4000-8000-0000000000b4','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000015',
 (select step_id from cells where id='c2000000-0000-4000-8000-000000000030'),0,
 'Session and reflection counts',
 'Impact is computed live from the tutor''s own session rows, not stored: attended sessions drive every tile, and the "with reflections" figure is a distinct-student count over those sessions. Two further fields — total student learning time and concepts mastered — are hardcoded to "--" and never rendered.','import');

update cells set
  content = 'Reviews how session time was allocated.',
  maturity = 'prototype',
  summary = 'PROTOTYPE (exploratory, not shipped as of Aug 2026): the section is commented out in every layer — the pane in the JSP, the renderer''s import and its call, the field on the DTO, and the helper that would populate it. A tutor sees Impact and then Growth Insights with nothing between them. The tutor_time_allocation table exists, carrying active-tutoring, goal-setting, observing, troubleshooting and other percentages, and the suggestion that would have accompanied it is a threshold if/else rather than a model.'
where id = 'c2000000-0000-4000-8000-000000000032';

insert into cells (id, path_id, lane_id, step_id, position, content, summary, maturity, origin) values
('c2000000-0000-4000-8000-0000000000b5','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000015',
 (select step_id from cells where id='c2000000-0000-4000-8000-000000000032'),0,
 'tutor_time_allocation',
 'PROTOTYPE (exploratory, not shipped as of Aug 2026): the table and its item class are in the schema with per-period percentages, and nothing populates or reads them in the app.','prototype','import');

update cells set
  content = 'Reads Growth Insights and rates each one Helpful, Not Helpful or Inaccurate.',
  summary = 'Each insight names a tutoring skill, describes it, and quotes an excerpt from the tutor''s own session transcript against a session reference. Rating one flips it from UNDER_REVIEW to REVIEWED and unlocks the next locked insight in the period — so the rating is also the way forward, not only an opinion. A free-text box appears once a rating exists, and the buttons then lock. Pilot scale: 882 insights across 148 tutors in the eight-week spring 2026 pilot; 116 feedback events, about three quarters positive.'
where id = 'c2000000-0000-4000-8000-000000000033';

update cells set
  content = 'Insight store',
  summary = 'tutor_ai_insight holds the skill name, its description, the insight text, the quoted transcript excerpt, a session reference, a period pair and a status of UNDER_REVIEW, LOCKED or REVIEWED. It records no model, prompt or version — nothing says which system wrote a given insight. Nothing in the app ever creates one of these rows: the service exposes reads and a status flip and no create at all, so insights arrive from outside it.'
where id = 'c2000000-0000-4000-8000-000000000034';

insert into cells (id, path_id, lane_id, step_id, position, content, summary, origin) values
('c2000000-0000-4000-8000-0000000000b6','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000012',
 (select step_id from cells where id='c2000000-0000-4000-8000-000000000033'),0,
 'Growth Insights',
 'The section heading a tutor sees is "Growth Insights" — the word AI appears only in the sidebar name and in the line underneath, "The growth insights are generated by AI, which may make mistakes!".','import'),
('c2000000-0000-4000-8000-0000000000b7','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000015',
 (select step_id from cells where id='c2000000-0000-4000-8000-000000000033'),1,
 'Insight feedback store',
 'tutor_ai_insight_feedback holds one rating per tutor per insight, upserted, with optional free text. The server stores whatever string arrives — the three values are defined in the browser and there is no whitelist or constraint behind them.','import'),
('c2000000-0000-4000-8000-0000000000b8','c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000014',
 (select step_id from cells where id='c2000000-0000-4000-8000-000000000033'),0,
 'Nobody reads the ratings back — inside the app they are written, echoed to the tutor who gave them, and otherwise untouched.',
 'No supervisor view, no export, no aggregation. Their only working consequence is unlocking the next insight. Whether anything outside the app consumes them cannot be answered from the app.','import');

commit;
