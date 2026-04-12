-- Helper RPCs for encrypt/decrypt credentials, bypass bytea serialization issues.

alter table social_credentials
  alter column credential_encrypted type text using encode(credential_encrypted, 'base64');

create or replace function credential_encrypt(plaintext text, secret text)
returns text
language plpgsql
volatile
security definer
as $$
begin
  return encode(pgp_sym_encrypt(plaintext, secret), 'base64');
end;
$$;

create or replace function credential_decrypt(ciphertext_b64 text, secret text)
returns text
language plpgsql
volatile
security definer
as $$
begin
  return pgp_sym_decrypt(decode(ciphertext_b64, 'base64'), secret);
end;
$$;

grant execute on function credential_encrypt(text, text) to service_role;
grant execute on function credential_decrypt(text, text) to service_role;
