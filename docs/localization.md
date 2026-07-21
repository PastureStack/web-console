# Localization

PastureStack Web Console treats `en-us.yaml` as the message contract. Every
selectable locale must contain the same non-empty keys, preserve every ICU
argument, and parse as valid ICU MessageFormat. A locale is not considered
supported when it silently falls back to English for ordinary interface text.

## Supported locale contracts

| Locale | Primary regional convention | Moment locale | Default date and time |
|---|---|---|---|
| `de-de` | Germany | `de` | Locale `LL LTS` |
| `fa-ir` | Iran | `fa` | Locale `LL LTS` |
| `fil-ph` | Philippines | `tl-ph` | `MMMM D, YYYY h:mm:ss A` through `LL h:mm:ss A` |
| `fr-fr` | France | `fr` | Locale `LL LTS` |
| `hu-hu` | Hungary | `hu` | Locale `LL LTS` |
| `ja-jp` | Japan | `ja` | `YYYY年M月D日 HH:mm:ss` through `LL LTS` |
| `ko-kr` | South Korea | `ko` | `YYYY년 M월 D일 A h:mm:ss` through `LL LTS` |
| `pt-br` | Brazil | `pt-br` | Locale `LL LTS` |
| `ru-ru` | Russia | `ru` | Locale `LL LTS` |
| `uk-ua` | Ukraine | `uk` | Locale `LL LTS` |
| `zh-hans` | Mainland China | `zh-cn` | Locale `LL LTS` |
| `zh-tw` | Taiwan | `zh-tw` | `YYYY年M月D日 Ahh點mm分ss秒` |

The Filipino interface uses the modern BCP 47 application locale `fil-PH`.
Moment 2.x exposes the corresponding Philippine language data under its legacy
`tl-ph` identifier, so the application maps between them explicitly.
The console overrides Moment's Philippine `LTS` value to retain the commonly
used 12-hour clock with `AM` or `PM` in full date-time values.

Regional date and language decisions are checked against Unicode CLDR's
[Filipino](https://unicode.org/cldr/charts/49/summary/fil.html),
[Japanese](https://unicode.org/cldr/charts/49/summary/ja.html),
[Korean](https://unicode.org/cldr/charts/49/summary/ko.html), and
[Persian](https://unicode.org/cldr/charts/49/summary/fa.html) locale data.
Filipino terminology also follows the Mozilla Filipino localization
[style guide](https://wiki.mozilla.org/L10n%3ATeams%3Atl/Style_Guide): use
formal but natural Filipino, retain established technical terms and acronyms,
and do not invent transliterations that make a technical interface harder to
understand.

## Terminology and quality rules

- Preserve product names, API identifiers, file names, commands, paths, and ICU
  argument names exactly when they are machine contracts.
- Translate ordinary interface prose. An exact English value is accepted only
  when every word belongs to the reviewed technical vocabulary or the value is
  an explicit machine contract. A blanket exception based on word count is not
  permitted.
- Translate messages containing HTML links as complete sentences. The words
  inside and outside a link must follow the target language's natural order;
  independently translated fragments are not accepted merely because every
  key exists.
- User-visible messages must not expose retired vendor branding. Internal API
  keys may remain compatibility contracts, but they must not be presented as
  current product terminology.
- Do not hard-code visible text, accessibility labels, table labels, status
  text, duration labels, or graph-relative time in templates and JavaScript.
  Route those values through the locale contract as well.
- Use terminology customary in the primary country represented by the locale.
  Japanese uses `監査ログ`, Korean uses `감사 로그`, and Filipino uses
  `Talaan ng Pag-audit` for **Audit Log**.
- Treat infrastructure words as domain terms, not dictionary words. For
  example, German uses `Umgebung` for an application environment and `Image`
  for a container image; Brazilian Portuguese uses `Ambiente` and `Stack`;
  Russian uses `Среда`; and French uses `Stack` rather than the physical
  object `Pile`.
- Ambiguous process terminology is reviewed as a complete phrase. **Child
  execution** means a subordinate execution, never the execution of a child.
  The automated gate locks the reviewed phrase in every supported locale.
- Visible component names follow the repository contract: **Orchestration
  Engine** and **Host Provisioner**. Compatibility keys may retain historical
  internal identifiers, but those identifiers are not product labels.
- Japanese and Korean application stacks are named
  `アプリケーションスタック` and `애플리케이션 스택`. Filipino uses
  `Mga Stack ng Aplikasyon`.
- External links must point to a maintained PastureStack repository or document.
  The project does not advertise community channels that it does not operate.
  The complete target inventory is maintained in
  [`integration-links.md`](integration-links.md).
- Templates own spacing between prose and links. Do not depend on trailing
  whitespace in translated YAML scalars because YAML block folding may remove it.
- Loading a Moment locale selects it globally. The vendor bundle resets Moment
  to English after registering every locale, and the user-language service then
  selects the active interface locale. Date helpers reapply that locale when
  formatting existing Moment instances so a language switch updates old rows.
- The user-language service keeps the document `lang` and `dir` attributes in
  sync with the selected locale. Missing white-label data falls back to the
  configured PastureStack application name instead of rendering empty text.

Run both localization gates after changing messages or date handling:

```sh
node scripts/check-ui-zh-tw-localization
node scripts/check-ui-localization-quality
```

The general gate rejects missing and orphaned keys, duplicate YAML mappings,
invalid ICU messages, changed ICU arguments, ordinary untranslated English,
hard-coded template text and accessibility attributes, translation artifacts,
broken help links, stale community links, retired visible branding, unlocalized
relative time and status text, unsafe new-tab links, known semantic false
friends, long English phrases embedded in non-Latin locales, and missing Moment
locale wiring. The application route waits for locale initialization before it
renders authenticated content, preventing first-load fallback warnings and
mixed-language frames. Unit tests pin representative date-time output for every
selectable locale so a Moment upgrade cannot silently change regional formats.
