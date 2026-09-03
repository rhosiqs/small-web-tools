# About Small Web Tools

<p align="center">
  <a href="ABOUT.md">English</a>
  &nbsp;·&nbsp;
  <a href="ABOUT.zh-TW.md">繁體中文</a>
</p>

**Last Updated:** September 3, 2026

**In-app page:** `/home/about`

**Source repository:** [github.com/hhter2/small-web-tools](https://github.com/hhter2/small-web-tools) (MIT License; GitHub access may be required)

**Maintainer Contact:** Rhosiqs (<emailforvirtualmachine@gmail.com>)

This document is the complete version. The `/home/about` page carries the same
information in the shorter form the site presents to visitors.

## What this is

Small Web Tools is a free collection of small, single-purpose web tools. Each tool
does one job — convert a value, inspect a file, count something, generate something
— and does it without an account, an installation, or advertising.

The catalog is grouped into six categories:

- **Text** — word counting, casing, slash conversion, and related text handling.
- **Developer** — encoding, Markdown and Mermaid preview, code preview, GitHub HTML
  snippets, base conversion, folder analysis, and website font extraction.
- **Network** — IP lookup and network speed measurement.
- **Media** — color conversion, image/document/audio/video metadata, media
  separation, and SVG-to-PNG conversion.
- **Bioinfo** — DNA conversion, codon tables, and Phred quality-score conversion.
- **Utilities** — QR codes and barcodes, password generation and strength checking,
  currency and date calculation, Roman numerals, and a random wheel.

## Local-first processing

Most tools run entirely in the browser. The text you paste and the files you select
are processed on your own device and are not uploaded.

A small number of features genuinely need a server, remote data, or a downloaded
runtime — live exchange rates, IP lookup, the speed test, the website font scan, the
optional map preview, and the FFmpeg WebAssembly runtime among them. Every one of
them is declared in `config/network-services.json`, listed on the `/home/privacy`
page, and described in [`PRIVACY.md`](PRIVACY.md). Services that require permission
stay blocked until they are allowed on the `/home/consent` page.

## Modes, languages, and preferences

All tools mode shows the complete catalog grouped by category, with audience
presets for daily users, developers, bioinformatics researchers, designers, and
students. Simple mode shows a shorter list for quick everyday tasks.

The interface is available in English and Traditional Chinese and offers a light and
a dark theme. Language, theme, sidebar layout, and consent choices are stored only
in the browser that made them.

## Open source

The application is open source under the [MIT License](LICENSE). Source code, issue
tracker, and release history live in the repository, where bug reports and
suggestions are welcome. [`CONTRIBUTING.md`](CONTRIBUTING.md) describes the
engineering workflow and [`ARCHITECTURE.md`](ARCHITECTURE.md) the structure of the
application.

## Contact and related documents

For questions, corrections, or suggestions, write to
<emailforvirtualmachine@gmail.com>. Security reports follow the separate process in
[`SECURITY.md`](SECURITY.md) and must not be filed as public issues.

- [`TERMS.md`](TERMS.md) — terms of use.
- [`PRIVACY.md`](PRIVACY.md) — privacy policy and data-flow disclosure.
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure policy.
- [`LICENSE`](LICENSE) — MIT License.
