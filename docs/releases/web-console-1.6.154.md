# Web Console 1.6.154 source changes

Direct navigation to a Stack or Service creation route without the effective
resource schema's create permission previously returned to the Stacks list
without explaining why. The shared route guard now shows one sticky error
before that redirect. Its wording applies to Stack and the Service variants
that use the guard, and is translated in English, Traditional Chinese, and
Japanese. Other shipped locales inherit the English base translation.

The Service upgrade query continues to check update permission. An allowed
upgrade shows no permission notice; a denied upgrade shows an update-specific
notice, rather than a create error. The redirect target and API behavior are
unchanged.

Source verification: Chrome 153 QUnit tests for the shared route guard passed
(5/5), covering denied and allowed creation, allowed and denied upgrades, and
an explicit false upgrade query. The localization quality check passed across
12 shipped locales with no missing keys, orphan keys, or invalid ICU messages.
The Node 24 package lock changes only its two root version fields from
1.6.153 to 1.6.154; dependency entries are unchanged.

Packaged browser acceptance and Server 8080 acceptance remain pending. Source
tests do not establish that a new immutable Server image contains this UI or
that its live permission matrix has passed.
