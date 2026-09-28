# Web Console 1.6.149 source changes

Registry Add creates a Registry and then its separate RegistryCredential. If
the second request fails, the form retains the new Registry ID, does not
submit the Registry again, and shows an explicit choice to stay or leave it
for later recovery. Credential retries first reload the server collection.
Only a definitely rejected write can be retried; a timeout, server error, or
unknown result cannot trigger another POST. A credential found on readback is
not treated as proof that the write-only password matches the form. The user
must use Edit to set the desired password. No uncertain or pre-existing
Registry is automatically deleted. Edit can add credentials to a Registry
that has none, without dereferencing a missing credential.

After successful creation, Registry and RegistryCredential, Certificate, and
Secret are each reloaded by their new ID with fresh action links before the
list is shown. A failed refresh keeps the form open, and Retry refreshes only;
it does not resubmit the saved resource. Certificate Edit now shares the
encrypted-private-key validation used by Add. Registry duplicate-address and
recovery messages are available in English, Traditional Chinese, and Japanese,
with English fallback for the other bundled locales.

Source tests and builds are tracked separately from browser acceptance. This
note does not claim the isolated 8080 QA workflow or production deployment has
passed.
