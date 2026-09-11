# Web Console 1.6.116

- Correctly recognize structured MFA errors inside generic transport wrappers.
- Open security confirmation for sensitive settings changes; retry the original
  PUT only after confirmation and never after cancellation.
- Keep localized errors while showing bounded HTTP status and API code for
  otherwise unknown failures; never display raw server response bodies.
- Focused browser tests cover confirmation, cancellation, secret-input clearing,
  login gating, and safe diagnostic rendering.
- Pair with Engine 0.183.298 for the live v2-beta MFA authorization schema fix.
