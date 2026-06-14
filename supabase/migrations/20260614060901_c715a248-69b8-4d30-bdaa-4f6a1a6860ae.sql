ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kkt_model text;
UPDATE public.branches SET kkt_model = 'Атол 30Ф' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.branches SET kkt_model = 'Атол 11Ф' WHERE id = '891e497e-33b8-462c-b268-c5c73245c380';