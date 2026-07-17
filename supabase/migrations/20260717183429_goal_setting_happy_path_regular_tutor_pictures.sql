update public.cells as c
set picture = v.picture
from (
  values
    ('a0000000-0000-4000-8000-0000001a0103'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-01-join-breakout-session.png'),
    ('a0000000-0000-4000-8000-0000001a0203'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-02-share-screen.png'),
    ('a0000000-0000-4000-8000-0000001a0303'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-03-goal-activity.png'),
    ('a0000000-0000-4000-8000-0000001a0403'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-04-goal-strategy.png'),
    ('a0000000-0000-4000-8000-0000001a0503'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-05-finalize-goals.png'),
    ('a0000000-0000-4000-8000-0000001a0603'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-06-leave-breakout-room.png'),
    ('a0000000-0000-4000-8000-0000001a0703'::uuid, '/blueprint-images/goal-setting/happy-path/regular-tutor/step-07-next-student.png')
) as v(id, picture)
where c.id = v.id;
