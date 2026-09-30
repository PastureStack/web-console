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

The official numeric [release `1.6.160`](https://github.com/PastureStack/web-console/releases/tag/1.6.160)
is published from source commit `63964fa3a6da5cbd452cdc1061c1e18340055362`.
[Official validation run `36702030007`](https://github.com/PastureStack/web-console/actions/runs/36702030007)
passed the full 725/725 test suite and produced two byte-identical
`web-console-1.6.160.tar.gz` archives. The published archive contains
`VERSION.txt=1.6.160` and has SHA-256
`705946b96e693c55a8ab5de3bc96b14020a52a050bf3992c302b9fb3c1408a51`;
the remote published asset's hash was independently read back and matched.
The earlier 32/32 result is the focused formatter/growl check, not the full
suite count.

Server artifact and native browser acceptance remain pending. Neither
component publication nor these tests complete the resource/role matrix.
