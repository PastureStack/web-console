# Web Console 1.6.160

Certificate deletion could correctly fail at the Engine's reference guard
while the console displayed only a generic unavailable-or-denied notification.
This release gives the known `405 / InvalidAction` certificate-in-use response
a reviewed explanation: remove the load-balancer service's certificate
references before deleting the certificate.

The shared error formatter and growl service use the same classification.
English, Traditional Chinese and Japanese are covered. The server response's
service names and IDs are not displayed. A `403` or `404`, including one with a
nested certificate message, still receives the same neutral explanation. Other
`405` responses are not guessed to be certificate-in-use errors.

No API status, authorization, Certificate mutation, authentication, session,
OIDC, MFA or proxy behavior is changed. Unit coverage includes direct API error
models, nested response envelopes, missing or unrelated codes/messages,
non-disclosure, all three locales, and the existing validation formatting.

Focused native headless Chrome 153 QUnit validation passed 32/32 tests with the
`/errors|growl/` filter. This includes the formatter/growl tests and adjacent
existing error-display tests, not the full suite. Both localization-quality
and Traditional Chinese completeness checks passed with no missing keys.

Release publication and native browser acceptance are separate gates. Full
resource/role-matrix completion is not implied by these formatter tests.
