-- Tech Setup payroll step — Front Stage Tech / Back Stage Tech Workday view labels.

update public.cells
set
  content = 'Workday (Employee View)',
  links = jsonb_build_array(
    jsonb_build_object(
      'type', 'tech_description',
      'label', 'Workday (Employee View)',
      'description', 'The tutor completes payroll onboarding tasks in Workday, including entering personal and employment information.',
      'picture', '/blueprint-images/shared/front-stage-tech/workday-logo.png'
    )
  )
where id = 'a0000000-0000-4000-8000-000000100606';

update public.cells
set
  content = 'Workday (Employer View)',
  links = jsonb_build_array(
    jsonb_build_object(
      'type', 'tech_description',
      'label', 'Workday (Employer View)',
      'description', 'The PLUS Supervisor Team completes corresponding student employment paperwork in Workday on the employer side.',
      'picture', '/blueprint-images/shared/front-stage-tech/workday-logo.png'
    )
  )
where id = 'a0000000-0000-4000-8000-000000100608';
