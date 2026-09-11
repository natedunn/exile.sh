# Maxroll importer review

Checked September 11, 2026. Maxroll's rendered footer links its Terms of Service to https://www.ziffdavis.com/terms-of-use (effective September 2026). The legacy `/tos` route returns a rendered 404 with that footer; the merchandise store has separate terms.

Section 2 restricts automated extraction and reuse except where expressly permitted. Given the user's requirement to stay within the terms, no Maxroll URL importer was added. A permitted integration or export workflow needs separate verification.

Direct HTTP requests returned 403. Chromium could render the site's 404 page and expose the current terms link. The HTTP status alone was not treated as proof of a contractual restriction.
