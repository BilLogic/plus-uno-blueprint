-- The reflection form gets modelled as what it is: six sections, each doing
-- something different, in the phase where a tutor actually fills it in.
--
-- It was one step with four cells, three of which described the unshipped
-- redesign as current state. Read against CMU-PLUS/web-app @ 5cbe8a2:
-- reflection.jsp, reflection.js, ReflectionServlet.java, SessionReflection.hbm.xml.
--
-- Two facts worth reading twice, because both are load-bearing and neither was
-- recorded anywhere: the recording upload is NOT required, so a tutor can
-- submit with no recording and no reason given; and the escalation checkbox is
-- never stored — the webhook fires and the fact that a tutor asked for help
-- then exists only in Slack and the application log.
--
-- Deliberately not modelled: the "Session did not happen" branch, which is
-- shipped and real (it replaces the whole form with a reasons list and clears
-- the recording columns). It is described inside the Session information cell
-- rather than given its own path. That is a gap, not an omission by accident.
--
-- Bill's call on the duplicate with In-session > Wrap-Up: both, cross-linked.
-- This scenario is the spec; Wrap-Up and the Growth Loop each keep one cell
-- that points here.

begin;

update scenarios set position = position + 1 where phase_id='a0000000-0000-4000-8000-000000000105';

insert into scenarios (id, phase_id, name, summary, position, view_type, origin) values
('c3000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000105','Session Reflection',
 'After every session the tutor fills in a multi-section reflection: what happened, one section per student they tutored, how the session went, and how they think they did. It is the only routine channel through which a concern about a student reaches a supervisor, and about 80% of them leave the free-text notes empty — which is the problem the unshipped redesign exists to solve. Modelled here at full detail; In-session › Wrap-Up carries the same moment from the room''s point of view.',
 1,'single','import');

insert into paths (id, scenario_id, name, path_type, summary, origin) values
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001','Happy Path','happy',
 'The session happened, the tutor has a recording, and they fill the form in one sitting.','import');

insert into lanes (id, path_id, name, lane_role, position, origin) values
('c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000002','Storyboard','visual',0,'import'),
('c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000002','Regular Tutor','customer_actions',1,'import'),
('c3000000-0000-4000-8000-000000000012','c3000000-0000-4000-8000-000000000002','Lead Tutor',null,2,'import'),
('c3000000-0000-4000-8000-000000000013','c3000000-0000-4000-8000-000000000002','Front Stage Tech','frontstage_tech',3,'import'),
('c3000000-0000-4000-8000-000000000014','c3000000-0000-4000-8000-000000000002','Front Stage Actions','frontstage_actions',4,'import'),
('c3000000-0000-4000-8000-000000000015','c3000000-0000-4000-8000-000000000002','Back Stage Actions','backstage_actions',5,'import'),
('c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000002','Back Stage Tech','backstage_tech',6,'import');

insert into steps (id, scenario_id, name, summary, origin) values
('c3000000-0000-4000-8000-000000000020','c3000000-0000-4000-8000-000000000001','Open the form',
 'The tutor reaches the reflection from their sessions list or the home tab, usually after the lead has reminded them, and the form opens on the first of its sections.','import'),
('c3000000-0000-4000-8000-000000000021','c3000000-0000-4000-8000-000000000001','Session information',
 'The tutor says which session this was, which students they tutored, and attaches the recording — the only step whose answers change what the rest of the form asks.','import'),
('c3000000-0000-4000-8000-000000000022','c3000000-0000-4000-8000-000000000001','Student Reflection',
 'One pane per student tutored: a rating of the interaction, and the one thing the next tutor should know. This is the part the whole form exists for, and the part most often left blank.','import'),
('c3000000-0000-4000-8000-000000000023','c3000000-0000-4000-8000-000000000001','Session Evaluation',
 'The tutor rates the session and picks what went well or what got in the way, and can ask for a supervisor''s attention.','import'),
('c3000000-0000-4000-8000-000000000024','c3000000-0000-4000-8000-000000000001','Self Reflection',
 'The tutor rates their own performance and names where they want to keep growing — asked every session, not on a cadence.','import'),
('c3000000-0000-4000-8000-000000000025','c3000000-0000-4000-8000-000000000001','Submit',
 'The reflection is stored, and if the tutor asked for it a message lands in the supervisors'' Slack. Nothing else happens automatically.','import');

insert into path_steps (path_id, step_id, position) values
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000020',1),
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000021',2),
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000022',3),
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000023',4),
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000024',5),
('c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000025',6);

insert into cells (id, path_id, lane_id, step_id, position, content, summary, origin) values
('c3000000-0000-4000-8000-000000000101','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000020',0,
 'Opens the reflection from Your Sessions › Reflections, or the Reflection tab on Home.',
 'Two ways in, both self-serve. Nothing prompts the tutor: the form is remembered or it is not, which is why tutors on back-to-back shifts routinely defer it and why the lead''s spoken reminder is scripted into the wrap-up.','import'),
('c3000000-0000-4000-8000-000000000102','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000012','c3000000-0000-4000-8000-000000000020',0,
 'Reminds tutors to upload the recording and complete the reflection before they leave.',
 'The lead does not fill in anything different — the form is identical for lead and regular tutors, and eligibility is the only place the app distinguishes them. The reminder is the whole of the lead''s part.','import'),
('c3000000-0000-4000-8000-000000000103','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000013','c3000000-0000-4000-8000-000000000020',0,
 'Reflection form',
 'A single page with a section list down the side — Session Information, Student Reflection, Session Evaluation, Self Reflection — and Submit at the end. The tab labels are derived from each section''s own heading. Drafts save without submitting.','import'),
('c3000000-0000-4000-8000-000000000104','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000020',0,
 'session_reflection',
 'One row per tutor per session, carrying the ratings, the pros and cons lists, the notes, and the recording filename. A row exists from the first draft save, so an unsubmitted reflection is not an absent one.','import'),
('c3000000-0000-4000-8000-000000000111','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000021',0,
 'Picks the date and the session, selects the students they tutored, and attaches the recording.',
 'Date, session and at least one student are required. A "Session did not happen" toggle replaces the whole form with a reasons list and a written explanation, and clears the recording fields. An "I can''t find the student I''m looking for" checkbox drops the student requirement rather than blocking the tutor.','import'),
('c3000000-0000-4000-8000-000000000112','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000013','c3000000-0000-4000-8000-000000000021',0,
 'Recording upload',
 'Up to five files, one gigabyte each, accepting .zip .mp4 .m4a .txt .heic .mov .heif .conf. A zip is expanded in the browser and again on the server. The upload is not required — a tutor can submit with no recording and no reason given, which is the gap the redesign closes.','import'),
('c3000000-0000-4000-8000-000000000113','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000021',0,
 'Recording store',
 'Files land on the app server''s own disk, in a folder named for the reflection. The filenames are joined into one comma-separated string capped at 1024 characters, and the uploaded flag is derived from whether that string exists — so the record of what was uploaded is a truncatable list, not a set of rows.','import'),
('c3000000-0000-4000-8000-000000000114','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000015','c3000000-0000-4000-8000-000000000021',0,
 'A script archives the recordings to Box and clears the folder off the app server.',
 'It versions same-name files and never deletes from Box. A tutor editing a reflection after the sweep has run finds the recording fields blanked, because the check is against the local folder the script has already emptied.','import'),
('c3000000-0000-4000-8000-000000000121','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000022',0,
 'Rates the interaction with each student, and writes the one thing another tutor should know.',
 'One pane per student selected, each with the tutor''s own in-session notes shown read-only above. The five-star rating is required; the note is not, and carries a warning not to name the student in it.','import'),
('c3000000-0000-4000-8000-000000000122','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000013','c3000000-0000-4000-8000-000000000022',0,
 'Reflection form',
 'A sub-tab per student, inserted under the Student Reflection heading and labelled with the student''s name.','import'),
('c3000000-0000-4000-8000-000000000123','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000022',0,
 'student_reflection',
 'One row per student per reflection, holding the rating and the note.','import'),
('c3000000-0000-4000-8000-000000000124','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000015','c3000000-0000-4000-8000-000000000022',0,
 'The note is the only thing here another human can act on, and roughly four in five are left empty.',
 'The rating is required and the note is not, so the form reliably produces a number and unreliably produces the sentence a supervisor or the next tutor could use. 13,438 reflections all-time, 79.9% with empty notes.','import'),
('c3000000-0000-4000-8000-000000000131','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000023',0,
 'Rates the session and picks the areas that went well or got in the way.',
 'Five stars, then a required areas list whose heading flips on the rating: at five it asks what went well, below five what could improve. Picking technical difficulties opens a second list — unmuting, screensharing, breakout rooms, whiteboard. A free-text support request and an escalation checkbox sit underneath, both optional.','import'),
('c3000000-0000-4000-8000-000000000132','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000013','c3000000-0000-4000-8000-000000000023',0,
 'Areas chips',
 'Time management, technical difficulties, organization of session, communication with students, communication with lead tutors, communication with the tutoring team admin, and Other. The technical-difficulties chip is hidden at a five-star rating.','import'),
('c3000000-0000-4000-8000-000000000133','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000023',0,
 'Pros and cons split',
 'The same chips are stored as pros at five stars and as cons below it, in two separate columns. Nothing records which question was asked, so a stored "con" cannot be told apart from an unpicked "pro" after the fact.','import'),
('c3000000-0000-4000-8000-000000000141','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000024',0,
 'Rates their own performance and picks where they want to keep growing.',
 'Asked every single session — there is no cadence gate in the shipped form. Five stars, then a required list: math teaching proficiency, knowing students better, learning what motivates them, time management, encouraging participation, communication skills, staying positive, and Other. A closing free-text asks what training materials would help.','import'),
('c3000000-0000-4000-8000-000000000142','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000024',0,
 'session_reflection',
 'The self rating and its own pros and cons columns sit on the same row as the session evaluation.','import'),
('c3000000-0000-4000-8000-000000000151','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000011','c3000000-0000-4000-8000-000000000025',0,
 'Submits the reflection.',
 'The last section''s Next button becomes Submit. Ten to fifteen minutes is typical for a full session.','import'),
('c3000000-0000-4000-8000-000000000152','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000014','c3000000-0000-4000-8000-000000000025',0,
 'A message reaches the supervisors'' Slack when the tutor ticked escalate.',
 'It carries the tutor''s name, the date, and the text of the support-request box — nothing else, and no link back to the reflection.','import'),
('c3000000-0000-4000-8000-000000000153','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000016','c3000000-0000-4000-8000-000000000025',0,
 'Escalation webhook',
 'Fires on a real submit and never on a draft save, and a failure is logged and swallowed so the submission still succeeds. The escalation flag itself is never stored: once the webhook has fired or failed, the fact that a tutor asked for help exists only in Slack and in the application log.','import'),
('c3000000-0000-4000-8000-000000000154','c3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000015','c3000000-0000-4000-8000-000000000025',0,
 'Supervisors work the Slack list and export reflections from the Tutors admin page.',
 'There is no dashboard over reflections. Review is a Slack thread for the escalated ones and a spreadsheet export for the rest.','import');

-- Two edges asserting a pipeline that does not exist -------------------------
delete from cell_dependencies where id in (
  '2f15f7a5-b2a0-45cb-8f68-43c326fd993d',   -- "required fields trigger AI question generation"
  '5d8dc9fc-3f7e-4b38-b9eb-66038906b2c8'    -- "reflection answers feed AI growth-insight generation"
);

-- The Growth Loop keeps a pointer; the spec lives in its own scenario --------
delete from cells where id in (
  'c2000000-0000-4000-8000-000000000041',
  'c2000000-0000-4000-8000-000000000042',
  'c2000000-0000-4000-8000-000000000043'
);

update cells set
  content = 'Completes the post-session reflection.',
  summary = 'Modelled in full in Post-session › Session Reflection: session information and recording, a section per student, the session evaluation, the self reflection, and submit. It is a prerequisite for the growth loop only in the sense that it is the same evening — nothing a tutor writes in a reflection reaches AI Coach, whose insights quote session transcripts instead.'
where id = 'c2000000-0000-4000-8000-000000000040';

update steps set
  summary = 'The tutor completes the reflection form. It is modelled step by step in Post-session › Session Reflection; here it marks the point in the evening the growth loop starts from.'
where id = (select step_id from cells where id='c2000000-0000-4000-8000-000000000040');

update scenarios set
  summary = 'What a tutor does with their own development after a session: the AI Coach review, if they are one of the tutors it exists for, then the training lessons and the certification badge. The reflection they fill in first is modelled in Session Reflection.'
where id = 'c2000000-0000-4000-8000-000000000001';

update cells set
  summary = 'Fills out the reflection form and uploads the session recording. Modelled step by step in Post-session › Session Reflection; here it is the last thing that happens in the room. Tutors on back-to-back shifts routinely defer both, which is why the lead''s reminder is scripted.'
where id = 'a0000000-0000-4000-8000-0000001c0403';

do $$
declare n int;
begin
  select count(*) into n from cells c join lanes l on l.id=c.lane_id
   where l.path_id = 'c3000000-0000-4000-8000-000000000002';
  if n <> 21 then raise exception 'expected 21 cells in Session Reflection, found %', n; end if;
  select count(*) into n from cells where summary ilike '%feed AI Growth Insights%' or summary ilike '%feed AI Student Insights%';
  if n > 0 then raise exception '% cells still claim reflections feed insights', n; end if;
  select count(*) into n from cells where content ilike '%thumbs up%' or content ilike '%AI Growth Insights%';
  if n > 0 then raise exception '% cells describe AI Coach as it is not', n; end if;
  select count(*) into n from cell_dependencies d
   where not exists (select 1 from cells where id=d.source_cell_id)
      or not exists (select 1 from cells where id=d.target_cell_id);
  if n > 0 then raise exception '% edges point at a deleted cell', n; end if;
  select count(*) into n from (select lane_id, step_id, position, count(*) from cells group by 1,2,3 having count(*)>1) x;
  if n > 0 then raise exception '% slots hold two cells at one position', n; end if;
end $$;

commit;
