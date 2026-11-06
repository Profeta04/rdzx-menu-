-- Function to handle the first admin setup
CREATE OR REPLACE FUNCTION public.handle_admin_setup()
RETURNS TRIGGER AS $$
BEGIN
  -- If the email is the requested admin email
  IF (NEW.email = 'pedroviniciusferminoprofeta@gmail.com') THEN
    -- Insert into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Insert or Update profile with the admin key
    -- We wait for the profile to be created if there's a trigger, 
    -- but here we'll just ensure it exists or update it.
    INSERT INTO public.profiles (id, admin_key)
    VALUES (NEW.id, 'HYPERADMIN-PVP-7890-8888')
    ON CONFLICT (id) DO UPDATE SET admin_key = 'HYPERADMIN-PVP-7890-8888';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_setup();
