# Web Console 1.6.246 candidate

This Server-compatible build retains the two LB label-ownership fixes from
1.6.245. All pages still start with AI collaboration off; the build ceiling is
`enabled`, matching the existing Server distribution. This does not enable
backend AI flags or grant any additional session/API Key permission.

The previous 1.6.244/245 component artifacts use the default `off` ceiling and
were rejected by the Server consumer before deployment. They are retained under
their immutable tags. This release does not replace their bytes.

Twenty-one focused LB source cases cover initialization order, intentional label
removal and settings without LB-form controls. Deployed nonempty-secondary UI
upgrade/rollback and independent finish remain separate required evidence.
