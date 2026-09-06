# Cloudflare runtime SSRF harness

<p align="center">
  <a href="../../../README.md">English</a>
  &nbsp;·&nbsp;
  <a href="../../../README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="../../../README.md">Project README</a>
  &nbsp;·&nbsp;
  <a href="../../../CONTRIBUTING.md">Contributing</a>
  &nbsp;·&nbsp;
  <a href="../../../ARCHITECTURE.md">Architecture</a>
  &nbsp;·&nbsp;
  <a href="../../../PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <a href="https://github.com/rhosiqs/small-web-tools/tags"><img src="https://img.shields.io/github/v/tag/rhosiqs/small-web-tools?sort=semver&amp;label=version" alt="Version: latest Git tag"></a>
  <a href="https://github.com/rhosiqs/small-web-tools/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rhosiqs/small-web-tools/ci.yml?branch=develop&amp;label=CI" alt="CI status"></a>
  <a href="https://github.com/rhosiqs/small-web-tools/blob/develop/LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a" alt="MIT license"></a>
</p>

This isolated Worker is deployment-only evidence for CR-009. Configure
`SSRF_TEST_HOSTS` with hostnames owned by the test operator and set
`SSRF_TEST_TOKEN` as a Worker secret. The controlled hosts must cover:

- a public response;
- a redirect chain whose final target is loopback, private, link-local, or a metadata hostname;
- a DNS-change/rebinding scenario controlled by the operator.

`npm run test:ssrf-runtime` deploys this harness and the controlled redirect target
to an unclaimed Cloudflare temporary preview account. The harness is public only for
the short-lived verification window and requires a random 256-bit bearer token that
is never printed or committed. Cloudflare deletes the temporary account if it is
not claimed. The verifier covers a public control, redirects to loopback/metadata,
a hostname resolving to loopback, same-zone public routing, mixed public/private
address answers, IPv4-mapped IPv6, timeout cancellation, and repeated alternating
public/loopback DNS answers. It prints only redacted, non-secret evidence plus
short-lived gate metadata tied to the configured compatibility date and fetch
implementation revision. Production extraction stays disabled when that metadata
is missing, malformed, incomplete, mismatched, or expired.

For a permanent-account run, keep the same authentication and allowlist controls,
invoke through an authenticated route or Service Binding, and preserve the
response/log evidence. Do not point fixtures at real private services.

Unit tests do not close the DNS time-of-check/time-of-use portion of CR-009. That
finding remains open until this harness is executed in Cloudflare's production
runtime or arbitrary egress is moved behind a component that binds validation to
the actual connection.
