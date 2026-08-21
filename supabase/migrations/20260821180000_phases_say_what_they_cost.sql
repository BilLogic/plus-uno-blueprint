-- The spec layer above the cells was entirely empty.
--
-- Three scenarios had no summary at all — every one of them in Pre-session,
-- which is the phase carrying the most churn. Four of six phase summaries were
-- sentence fragments with no verb and no full stop. And `business_impact` and
-- `operational_requirements` were empty on all six phases, which is the pair
-- that answers "what does it cost when this goes wrong" and "what has to be
-- staffed for it to run at all" — the two questions a service blueprint exists
-- to answer above the level of a single cell.
--
-- Every figure below is one the blueprint already carried somewhere: 22–41%
-- of sessions cancelled per month, 64% of call-offs auto-approved, 83.4% of
-- students with an attendance record against 31.8% of sessions fully covered,
-- ~80% of reflections with empty notes, 2,100–6,000 sign-up rows a month,
-- eleven onboarding modules, about two weeks with the CPO.
--
-- Where a phase has no numbers, the text says so rather than padding. Neither
-- Application nor Program Administration has a single volume anywhere in the
-- blueprint — no applications received, no acceptance rate, no supervisor
-- headcount, no edits per month — and both `business_impact` values end by
-- naming that gap. A phase whose cost cannot be sized is worth knowing about.

begin;

update scenarios set summary = $q$How a semester's sessions reach the tutors who will run them, and stay accurate as they change. Today the sessions arrive by database import and supervisors review and adjust them in Admin › Sessions, while the tutor watches My Sessions and keeps a calendar feed in sync; edits and cancellations reach affected tutors in-app and by email. A second, unshipped path moves session creation into the app and adds a reconfirmation loop, where answering Unavailable releases the tutor from the roster without a call-off record.$q$
where name = 'Standard Scheduling';

update scenarios set summary = $q$How a seat that opens on an already-scheduled session gets covered without anyone opening it. A session with remaining capacity inside 72 hours joins the fill-in pool automatically, tutors browse the Fill-In tab and take a slot, and the roster updates immediately in Admin › Sessions. Supervisors act only at the edges: pushing a coverage request to Slack for hard-to-fill or urgent gaps, and stepping in for sessions still unfilled close to start.$q$
where name = 'Fill-in Request';

update scenarios set summary = $q$How a tutor comes off a session they are rostered on, and what happens to the seat they leave behind. The twelve-hour line splits it: filed twelve or more hours ahead, the request auto-approves and supervisors take no action; filed inside twelve hours, removal from the roster is immediate and the later review only decides excused or unexcused — 21.4% of 2026 requests. Either way coverage is automatic, because the freed slot appears in every other tutor's Fill-In tab; a third, unshipped path would let the tutor swap into another session instead, so coverage moves rather than disappears.$q$
where name = 'Call-off Request';

update phases set summary = $q$Potential tutors discover PLUS, interview, and receive an offer to join the PLUS team.$q$ where name = 'Application';
update phases set summary = $q$A session's roster and materials are settled before it runs: the semester schedule, the call-offs and fill-ins that change it, and the resources the tutor picks out.$q$ where name = 'Pre-session';
update phases set summary = $q$Tutors, the lead tutor and the classroom teacher run the live session together, from opening the room to signing it off.$q$ where name = 'In-session';
update phases set summary = $q$The tutor closes out the session — reflection, hours, and anything they need to raise — and the cycle returns to Pre-session for the next one.$q$ where name = 'Post-session';

update phases set business_impact = $q$The only intake into the workforce every later phase spends: no session runs without tutors who came through the info session, the group interview and CPO clearance. The cost here is time-shaped rather than money-shaped — clearance runs about two weeks with the CPO before any app or training access is granted, so a thin hiring cycle surfaces as unfilled sessions a month later. No application, interview or offer-acceptance volumes exist anywhere in the blueprint, so funnel loss in this phase cannot be sized.$q$
where name = 'Application';
update phases set business_impact = $q$Every tutor-hour the program later spends is unlocked here: the onboarding gate blocks session sign-up until all eleven modules are complete, so a tutor stalled in training is a tutor who cannot be rostered. When it runs, it feeds a sign-up pipeline carrying 2,100–6,000 tutor-session sign-up rows a month in spring 2026. The failure cost falls on people, not systems — supervisors chase stalled tutors by hand, and clearance status only reaches the app through a weekly Friday ETL, so a tutor cleared on a Monday waits days for access.$q$
where name = 'Onboarding';
update phases set business_impact = $q$This is where the schedule meets reality, and reality moves it a lot: 22–41% of sessions were cancelled per month in spring 2026 (March: 322 of 793), against 300–640 call-offs a month. What the phase is worth is that most of that churn costs nobody any work — 64% of call-offs auto-approve with no supervisor action, and the freed seat re-advertises itself into the Fill-In tab, with fill-ins running about 10–12% of sign-ups. What it costs when it fails is a session that runs short-staffed or not at all, because the only backstop for a slot nobody takes is a supervisor noticing it close to start.$q$
where name = 'Pre-session';
update phases set business_impact = $q$The phase the program exists to deliver, and the only one a student sees; everything upstream is preparation for it. It is also where the record of what happened gets made, and that record is patchy — attendance is captured for 83.4% of students but only 31.8% of sessions are fully covered, so roughly two in three sessions leave holes in the data every downstream measure is built on. When something goes wrong inside a session there is no system path out of the room: the lead tutor posts in the school Slack channel and waits for a supervisor, or the teacher emails the tutors mailbox.$q$
where name = 'In-session';
update phases set business_impact = $q$Two things the organisation can get nowhere else are produced here, and both leak. The reflection is the only routine channel by which a concern about a student reaches a supervisor, yet about 80% of the 1,500–2,000 reflections filed per month in season leave the free-text notes empty — the part the form exists for. Payroll leaks the other way: hours are self-reported in Workday and nothing links session records to it, so a missed weekly deadline is caught only when a supervisor notices and follows up over Slack or email.$q$
where name = 'Post-session';
update phases set business_impact = $q$Nothing here is visible to a tutor or a student, and everything in the other five phases depends on it: the rosters, groups, session calendar and institution settings the whole blueprint reads from are maintained by hand in this phase. Its leverage is that one supervisor action moves many people at once — a group edit changes a scheduling dimension, a session edit reaches every affected tutor, a CSV adds a cohort of students — which is equally its exposure, since a mistake propagates the same way. No admin-side volumes exist in the blueprint, so the workload this phase carries cannot be sized.$q$
where name = 'Program Administration';

update phases set operational_requirements = $q$Four teams have to be running at once: marketing posting to the branding guidelines, the design and dev teams keeping the website current, and the supervisor team maintaining the Handshake posting, the info-session slides and the application form. The supervisor team also carries the whole assessment load by hand — hosting the Zoom info session and tracking attendance to gate the form, running the group interview from the shared slides, taking notes in Notion, then reviewing those notes against the recording. Nothing completes without an outside party: the CPO or the school confirms clearance, and onboarding information is held until it comes back.$q$
where name = 'Application';
update phases set operational_requirements = $q$Content and accounts each need an owner: the instructional design team writes and maintains the modules, their reflection questions, the Google quizzes and the supplementary materials, while the supervisor team assigns lessons, creates each tutor's account in Admin › Tutors, and files the student-employment paperwork in Workday. Progress does not move on its own — supervisors watch the training-progress view and follow up with the tutors who stall. The phase also depends on parties PLUS does not run: CMU HR for the I-9 and payroll, the CPO for the Act 153 clearances, and Google OAuth, Slack, Accredible and the weekly clearance ETL for access, badging and status.$q$
where name = 'Onboarding';
update phases set operational_requirements = $q$Most of this phase is staffed by jobs rather than people: the 72-hour auto-add job that pushes open seats into the fill-in pool, the auto-approval rules that sit on the twelve-hour line, the calendar feed and reminder emails, and the semester database import that puts the sessions there to begin with. Supervisors are needed at three points only — recording excused or unexcused on pending call-offs, reassigning the calling-off tutor's students once a call-off is approved, and chasing sessions still unfilled close to start. The Slack bridge is the one manual escalation route, used to push coverage requests for hard-to-fill or urgent gaps.$q$
where name = 'Pre-session';
update phases set operational_requirements = $q$A session needs three staffed roles in the room on top of the tutors: a lead tutor who builds the breakout rooms, takes tutor attendance, renames students to the roster, hand-assigns anyone the algorithm missed, and signs the session off; a classroom teacher who holds the physical room, the wifi, the devices and the session link; and supervisors watching that school's Slack channel live, because that channel is the escalation path out of the room. The supervisor team must have created the session record and the link beforehand. The app side runs on the assignment algorithm with its live rebalancing and single-student placement for late arrivals, plus research-team inputs — the student ordering and the session's condition — that decide what tutors are asked to do.$q$
where name = 'In-session';
update phases set operational_requirements = $q$The lead tutor has to close the loop in the room — reminding tutors to upload the recording and file the reflection before they leave — because nothing chases them afterwards. Backstage needs a supervisor on two manual queues: the Slack list of reflections that asked for attention, and Workday hours approval, including spotting the tutors who missed the weekly deadline, since no system flags it. Storage and services carry the rest — a script archives recordings to Box and clears the folder off the app server, an escalation webhook routes flagged reflections, and an LLM microservice plus Accredible produce the insights and badges.$q$
where name = 'Post-session';
update phases set operational_requirements = $q$This phase is a person, not a system: a supervisor with admin access has to work six surfaces continuously — Tutors, Sessions, Students, Groups, broadcast and export, and institution settings — with a system admin above them for cross-institution setup. The data model makes part of that load structural, because groups carry a foreign key that also makes a group a scheduling dimension, so a group or session edit reaches rosters and tutors rather than staying local. Two integrations have to stay up for the phase's side effects to land: the rostering Slack bridge that every student addition posts to, and the email plumbing behind tutor broadcasts.$q$
where name = 'Program Administration';

do $$
declare n int;
begin
  select count(*) into n from scenarios where coalesce(summary,'') = '';
  if n > 0 then raise exception '% scenarios still say nothing', n; end if;
  select count(*) into n from phases where coalesce(business_impact,'') = '' or coalesce(operational_requirements,'') = '';
  if n > 0 then raise exception '% phases are still blank above the cell layer', n; end if;
  select count(*) into n from phases where summary !~ '\.$';
  if n > 0 then raise exception '% phase summaries are still fragments', n; end if;
end $$;

commit;
