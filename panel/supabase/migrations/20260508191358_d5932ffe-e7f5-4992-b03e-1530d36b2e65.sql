UPDATE auth.users 
SET encrypted_password = crypt('Rodrigo188200@#$', gen_salt('bf')),
    updated_at = now()
WHERE email = 'pedroviniciusferminoprofeta@gmail.com';