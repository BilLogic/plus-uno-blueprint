-- Rename Front Stage Tech in Onboarding Modules happy path step 5
-- from "Google Quiz embedded in Notion" to "Google Quiz".

update public.cells
set
  content = 'Google Quiz',
  links = (
    select coalesce(
      jsonb_agg(
        case
          when link->>'type' = 'tech_description'
            and link->>'label' = 'Google Quiz embedded in Notion'
          then jsonb_set(link, '{label}', to_jsonb('Google Quiz'::text))
          else link
        end
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(coalesce(links, '[]'::jsonb)) as link
  )
where id = 'a0000000-0000-4000-8000-000000110506';
