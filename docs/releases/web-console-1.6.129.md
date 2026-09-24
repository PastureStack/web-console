# Web Console 1.6.129

The environment detail header now offers Edit when the network policy editor
is available but the project has neither metadata-update nor member-update
permission. The link opens the same environment at `?editing=true`, where the
existing capability checks govern network controls and saving.

Project and member editors keep their existing Edit action without a duplicate
header link. No API request, role assumption, or backend authorization rule
changes in this release. The consuming Server release declares its Server and
Engine pairing.
