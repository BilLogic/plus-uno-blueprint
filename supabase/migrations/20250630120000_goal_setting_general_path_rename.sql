-- Goal Setting scenario — restore Happy Path name, keep updated description

update public.paths
set
  name = 'Happy Path',
  description = 'General overview of tutors guiding students through goal-setting activities in breakout sessions. For a more detailed look at the activities, see the other paths in this scenario.'
where id = 'a0000000-0000-4000-8000-00000000080c';
