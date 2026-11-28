# Web Console 1.6.246

This Server-compatible build retains the two LB label-ownership fixes from
1.6.245. All pages still start with AI collaboration off; the build ceiling is
`enabled`, matching the existing Server distribution. This does not enable
backend AI flags or grant any additional session/API Key permission.

The previous 1.6.244/245 component artifacts use the default `off` ceiling and
were rejected by the Server consumer before deployment. They are retained under
their immutable tags. This release does not replace their bytes.

Twenty-one focused LB source cases cover initialization order, intentional label
removal and settings without LB-form controls. The deployed nonempty-secondary UI case was completed as detailed below.

## Deployed acceptance

Server 1.6.609 loaded the exact published assets. Six real Edge UI phases
completed upgrade, independent rollback, a separate upgrade/finish and refresh.
One nonempty dependent sidekick and mounted data/settings survived. Four native
actions returned 202 with no service PUT or browser/API errors. Twelve mechanical
negative controls passed. This qualifies the tested topology, not all secondary
configurations.
