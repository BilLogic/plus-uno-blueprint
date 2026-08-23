-- Nine cells describing a design exploration in the present tense, and a
-- reconfirmation flow that four cells out of seven said was live.
--
-- `Prototype: Lead Dashboard Wrap-Up` carried no maturity marker anywhere: no
-- summaries at all, and content like "Closes breakout rooms and opens the PLUS
-- Wrap-Up Dashboard showing room attendance status." Four invented product
-- names — PLUS Wrap-Up Dashboard, PLUS Session Sign-Off & Submission Tracker,
-- PLUS AI Debrief Summaries, PLUS Reflection Automated Notification — had been
-- admitted into the touchpoint vocabulary as though they were surfaces you
-- could open. Its sibling prototype path in the same scenario marks every cell.
-- Its path_type was 'alternative' where every other prototype path is 'named'.
--
-- Card 2452 (session edit/revert plus the reconfirmation prompt) is built and
-- in QA, not deployed. Two cells said so, in two different phrasings; four
-- more described the same unshipped mechanism in the present tense, including
-- the state machine and the fan-out. Production tutor_session has no reconfirm
-- column at all.
--
-- Two markers survive, because they mean different things:
--   PROTOTYPE (exploratory, not shipped as of Aug 2026) — design work, no card
--   PLANNED (Card <n>, <state>)                          — committed, in build

begin;

update paths set path_type = 'named' where name = 'Prototype: Lead Dashboard Wrap-Up';

update cells set
  content = $q$Planned — closes breakout rooms and opens a wrap-up dashboard of room attendance.$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): today the lead closes the rooms and stops the recording with nothing showing which rooms finished. The dashboard is a design exploration.$q$
where id = '692f6740-32b2-449a-b52a-b03623708be8';

update cells set
  content = $q$Planned — wrap-up dashboard$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): a lead-tutor view of room attendance at close. No such surface exists in the app; the name is a design placeholder, not a product.$q$
where id = '3dd1c832-d43a-478f-a369-94907b8770f5';

update cells set
  summary = $q$The same videoconference the session ran on — this path changes what the lead sees alongside it, not what closes the rooms.$q$
where id = '7d47fc7c-071f-46be-914c-bcffbbaca729';

update cells set
  content = $q$Planned — checks who has submitted a recording and a form, then signs off the session.$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): today the lead reminds tutors verbally and has no way to see who complied. Sign-off would replace the reminder with a record.$q$
where id = 'f0e2b6ce-74ff-459b-b8b0-6945ccbe3fc3';

update cells set
  content = $q$Planned — session sign-off and submission tracker$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): a per-session matrix of recording and reflection submissions. A design placeholder — nothing tracks submission at session level today.$q$
where id = 'dbbde9f5-a666-4675-a24b-f5bf3b376434';

update cells set
  content = $q$Planned — runs the debrief from AI-surfaced session highlights.$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): the debrief is unaided today. Highlights would come from the session recording, which is not processed on this timescale.$q$
where id = '7d24188b-b400-462e-80c5-0978a40d5adc';

update cells set
  content = $q$Planned — AI debrief summaries$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): a design placeholder. No summary of a session exists in the minutes after it ends.$q$
where id = 'bc172bd8-59e7-40a5-97da-bc6d94d66684';

update cells set
  content = $q$Planned — thanks students while tutors are prompted to start their reflections.$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): the prompt is the lead's own voice today, which is why tutors on back-to-back shifts defer the form.$q$
where id = '7b7e5d80-0067-476a-9dce-feeb53fec3dc';

update cells set
  content = $q$Planned — automated reflection prompt$q$,
  summary = $q$PROTOTYPE (exploratory, not shipped as of Aug 2026): a design placeholder for a notification at session close. Nothing prompts a tutor to reflect today.$q$
where id = '87ea3a63-ca29-4efd-a36d-4ff1e1240a01';

update cells set
  content = $q$Planned — reconfirms availability when a session is edited or reverted.$q$,
  summary = $q$PLANNED (Card 2452, in QA for release 11.4): when a supervisor edits a session's time or reverts a cancellation, the tutor gets a reconfirmation prompt, singly or in a batch. Confirming keeps them on the roster; marking Unavailable removes them from the session without a call-off record.$q$
where id = 'b0000000-0000-4000-8000-000000140303';

update cells set
  summary = $q$Alerts about cancelled and rescheduled sessions reach the tutor here. PLANNED (Card 2452, in QA for release 11.4): reconfirmation requests would arrive on the same surface.$q$
where id = 'b0000000-0000-4000-8000-000000140306';

update cells set
  content = $q$Planned — reconfirmation state machine$q$,
  summary = $q$PLANNED (Card 2452, in QA for release 11.4): each affected TutorSession would carry a ReconfirmState of PENDING and tutor responses would apply to the roster. Production tutor_session has no reconfirm column.$q$
where id = 'b0000000-0000-4000-8000-000000140308';

update cells set
  content = $q$Planned — reconfirmation fan-out$q$,
  summary = $q$PLANNED (Card 2452, in QA for release 11.4): editing sessions with notification enabled would fan reconfirm requests out to signed-up tutors (editSession, TutorScheduleServlet), and a tutor answering Unavailable would drop off the roster.$q$
where id = 'b4556df8-9f49-4dbf-990a-8a7a88b13a02';

update cells set
  summary = $q$My Sessions shows upcoming sessions; the calendar-sync modals offer Subscribe, an auto-updating feed, or Add event only. Session changes surface as cancelled or time-change alerts. PLANNED (Card 2452, in QA for release 11.4): those alerts would also ask the tutor to re-state availability.$q$
where id = 'a0000000-0000-4000-8000-000000140206';

do $$
declare n int;
begin
  select count(*) into n from cells c join lanes l on l.id=c.lane_id join paths pa on pa.id=l.path_id
   where pa.name = 'Prototype: Lead Dashboard Wrap-Up' and coalesce(c.summary,'') = '';
  if n > 0 then raise exception '% Lead Dashboard cells still carry no maturity', n; end if;
  select count(*) into n from cells c join lanes l on l.id=c.lane_id join paths pa on pa.id=l.path_id
   where pa.name like 'Prototype:%' and c.summary not like 'PROTOTYPE (exploratory, not shipped as of Aug 2026)%'
     and c.content not like 'Planned — %' and c.content <> 'Zoom/Pencil';
  if n > 0 then raise exception '% prototype cells use a different maturity vocabulary', n; end if;
  select count(*) into n from cells
   where (content ilike '%Reconfirmation%' or summary ilike '%reconfirm%')
     and summary not like '%PLANNED (Card 2452, in QA for release 11.4)%'
     and lane_id in (select l.id from lanes l join paths p on p.id=l.path_id where p.path_type='happy');
  if n > 0 then raise exception '% happy-path reconfirmation cells carry no marker', n; end if;
end $$;

commit;
