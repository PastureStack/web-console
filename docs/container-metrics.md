# Container metrics tables

The host and service container tables are designed to remain useful when an
environment contains more containers than can be rendered economically on one
page.

## Effective usage

CPU, memory, network, and storage are displayed in separate columns. Each
column combines a 60-sample sparkline with an effective-usage value calculated
over the same rolling window:

```text
RMS = sqrt((x1² + x2² + ... + xn²) / n)
```

Only samples actually received from the statistics stream contribute to the
calculation. Leading zeroes used to fill a new sparkline are presentation data
and are not included.

The inputs are:

- CPU: total CPU percentage;
- memory: used memory in MiB;
- network: receive plus transmit throughput in KB/s;
- storage: read plus write throughput in KB/s.

## Stable live ranking

All four effective-usage columns are sortable and initially rank the highest
usage first. Live values and sparklines continue to update with each sample,
while the rank is reconsidered every ten seconds. Values within five percent
of each other keep their prior relative order. This prevents nearly equal
containers from repeatedly trading places.

When a rank does change, table rows use a short FLIP transform so their movement
is visible without an abrupt layout jump. Ordinary name, address, version, and
identifier sorts use natural numeric ordering.

## Bounded rendering

The default statistics page contains ten rows and can be changed to 25 or 50.
The preference is retained for the user. Lightweight rolling aggregates are
kept for every container so sorting covers the complete result set, but SVG
sparklines are created and updated only for the current page. Leaving the
browser tab suspends the aggregate statistics connection until the tab becomes
visible again.

This preserves meaningful whole-table ranking while bounding active chart work
to four charts per visible row.
