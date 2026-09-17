# Vulnerability Disclosure Policy

Last reviewed: 2026-08-08

## Supported versions

This project is under active pre-1.0 development. The current `develop` revision
and the newest version-formatted Git tag (`vMAJOR.MINOR.PATCH`) are supported.
Older revisions and tags, including the historical `-beta` tags, are not supported;
please reproduce a report against a supported revision when possible.

## Report privately

Please report suspected vulnerabilities by email to
[emailforvirtualmachine@gmail.com](mailto:emailforvirtualmachine@gmail.com?subject=Small%20Web%20Tools%20private%20report).
Do not open a public GitHub issue or discussion for a report that contains exploit
details, secrets, personal data, or other sensitive information.

Include only the information needed to investigate:

- a concise description and the affected revision or tag;
- the affected feature, environment, and observed impact;
- minimal reproduction steps that do not expose third-party data; and
- a way to contact you for follow-up.

Remove credentials, access tokens, personal data, and unrelated user content before
sending a report. The maintainer reviews reports as availability permits and may ask
for more information. This project does not promise a fixed response or resolution
timeline.

## Scope

Reports may cover the hosted web interface, Cloudflare Pages Functions, the
rate-limiter Worker, build and deployment configuration, and direct dependencies.
This includes the URL-fetching surface used by Font Extractor and the local
file/media-processing tools. Reports should describe the affected boundary and
impact without publishing an exploit recipe.

Reports about unsupported revisions, availability-only traffic floods, or issues in
third-party services without a demonstrated impact on this project may be closed as
out of scope.

## Coordinated disclosure

Please allow the maintainer to investigate and coordinate a fix before public
disclosure. Act in good faith: avoid accessing data that is not yours, disrupting
the service, degrading availability, or retaining data obtained during testing.

