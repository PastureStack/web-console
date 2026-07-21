# Internationalization #

Every piece of localizable text is put into the translation files here.

 - Files must be named matching a locale in the list at https://github.com/andyearnshaw/Intl.js/tree/master/locale-data/jsonp (with a `.yaml` extension).`
 - The code refers to the appropriate key and it is looked up for the current language to get the string to be displayed.
 - If the key does not exist in the current language, the English value is used as a fallback.
 - If there is no English value either, the un-translated key is shown

Pluralization

Variables can be pluralized with the syntax:

```
You have {numPhotos, plural,
  =0 {no photos.}
  =1 {one photo.}
  other {# photos.}}
```

# Docs #

See [ember-intl wiki](https://github.com/jasonmit/ember-intl/wiki) for more info about supported features in translations, and [ICU](http://userguide.icu-project.org/formatparse/messages) for more info about pluralization.

# Testing #

 - You can press shift+L to toggle between the current language and a special `none` language which will show the translation keys for every string.
 - When starting up the ember server, a warning will be printed for each key that is in `en-us` but missing from another language.
 - Run `node scripts/check-ui-zh-tw-localization` after changing Traditional Chinese translations. The gate checks English-key coverage, known malformed keys, Taiwanese terminology, CJK/Latin spacing, and the required `Audit Log` translation (`稽核日誌`).
 - Run `node scripts/check-ui-localization-quality` after changing any locale. Every selectable locale must cover the full English key contract, preserve ICU arguments, use valid ICU syntax, avoid sentence-length untranslated English and retired visible branding, and include its runtime Moment locale mapping.
 - Visible template text, accessibility labels, JavaScript status text, duration labels, and graph-relative time must use translation keys; the general gate rejects known hard-coded fallbacks.

## Regional locale policy

The supported regional contracts and date formats are documented in
[`docs/localization.md`](../docs/localization.md). Japanese follows Japanese
technical terminology and 24-hour date-time formatting, Korean follows South
Korean terminology and meridiem formatting, and Filipino follows Philippine
terminology while mapping the application locale `fil-PH` to Moment's `tl-ph`
locale data.

## Traditional Chinese (`zh-TW`) terminology

Use terminology customary in Taiwan. In particular, translate `Audit Log` as `稽核日誌`, `Audit Trail` as `稽核軌跡`, `Activity Log` as `活動紀錄` or `操作紀錄`, `Access Log` as `存取日誌`, `System Log` as `系統日誌`, and `Security Log` as `安全性日誌` or `資安日誌` according to context. Separate Chinese text from Latin words, numbers, placeholders, and inline links with appropriate spacing.
