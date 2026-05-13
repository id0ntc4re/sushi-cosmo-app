
-- Backfill missing profiles for existing users
INSERT INTO public.profiles (id, email, referral_code)
SELECT u.id, u.email, upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Ensure profile is created automatically on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
