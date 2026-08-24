# Branch merge and behavior audit

Date: 2026-08-15 (Asia/Taipei)

## Conclusion

After refreshing `origin` with `git fetch --prune origin`, the repository has
three branch refs other than `main` and `develop` (excluding the symbolic
`origin/HEAD` alias). All three contain commit objects that are reachable from
neither local `main` nor local `develop`, so they are **unmerged by commit
identity**. However, none contains a final function, behavior, configuration, or
documentation change that is missing from `develop`: each branch's effective
patch is already present there, either as the same patch or as a squash.

`main` does not contain any of the three effective changes. Therefore the
branches are not safe to classify as merged into both base branches by ancestry,
but they are safe to classify as functionally redundant with `develop`.

| Branch | Tip | Commit objects in neither `main` nor `develop` | Effective change in `develop` | Effective change in `main` |
| --- | --- | ---: | --- | --- |
| `origin/codex/add-docker-development-manual` | `fd07e82cbfb6cc6910bf4863951e0ad634d4a050` | 1 | Yes, exact patch in `5a70f935706ee379dba972089844a1df69863791` | No |
| `origin/feat/fastq-phred-quality-decoder` | `ae2c0057def4486abebfae1701216f4b7ad05d50` | 13 | Yes, cumulative squash in `0c79458b17c9b59a0eb2b163da9d710c31d645b9` | No |
| `origin/fix/docmeta-clear-edit-time` | `de4ca2cc0ce0a3b46f02ac985769f74c9df20dba` | 2 | Yes, cumulative squash in `c4863e6e56aea58fa561483e14c29cc942eea5eb` | No |

## Scope and method

The audited base refs were local `main` at
`22b469ad70d08c68bf52decb80656b872d544fb1` and local `develop` at
`811130f8c4b013a2c7a4fff34e2b6872eeb6dfdf`. `origin/main` points to the same
commit. Local `develop` is one commit ahead of `origin/develop` at
`5a70f935706ee379dba972089844a1df69863791`; that extra local commit only
configures engineering skills and does not affect the conclusions. These ref
values come from `git for-each-ref refs/heads refs/remotes` after the fetch.

For this report, "unmerged commit" means a commit returned by:

```bash
git rev-list <candidate> --not main develop
```

That tests reachability from the union of both base histories: every reported
commit is absent from both histories as a commit object. Behavior equivalence was
then checked with stable patch IDs for the complete branch delta from its merge
base and with Git blob IDs for every changed implementation file. This cumulative
comparison is necessary because `git cherry develop <candidate>` cannot recognize
several branch commits that were squashed into one `develop` commit.

## `origin/codex/add-docker-development-manual`

### Structurally unmerged commit

- `fd07e82cbfb6cc6910bf4863951e0ad634d4a050` — `docs: add Docker development workflow`

The branch forked from `c4863e6e56aea58fa561483e14c29cc942eea5eb`.
Its single commit is not an ancestor of either base ref and is the sole result of
`git rev-list origin/codex/add-docker-development-manual --not main develop`.

### Effective behavior

This branch adds a Node 22 development image, a Compose service with a
bind-mounted source tree and named `node_modules` volume, build-context secret
exclusions, and paired Docker workflow documentation. The executable behavior is
visible at
`fd07e82cbfb6cc6910bf4863951e0ad634d4a050:Dockerfile.dev`, lines 1-14, and
`fd07e82cbfb6cc6910bf4863951e0ad634d4a050:compose.yaml`, lines 1-16. Operational
scope and API limitations are documented at
`fd07e82cbfb6cc6910bf4863951e0ad634d4a050:docs/docker-development.md`, lines
1-14 and 63-73. It introduces no React or JavaScript function.

The stable patch ID of `fd07e82...` is
`ca52b297c05dadee949a8526e823055cfa6faf0b`, exactly the patch ID of the later
`develop` commit `5a70f935706ee379dba972089844a1df69863791`
(`docs: add Docker development workflow (#71)`). `git cherry develop
origin/codex/add-docker-development-manual` consequently marks `fd07e82...` with
`-`. The Git blob IDs for `Dockerfile.dev`, `compose.yaml`, and
`docs/docker-development.md` are also identical at the branch tip and `develop`
(`4dffea6802c244e2d5396db559279e755f8cfd82`,
`459d6d2800d3b9392f132bc9710b7253cda63a5c`, and
`9c864ef40cf12f333ad8f6bf5df6ddad8fd384a2`, respectively). A complete
`git rev-parse <branch>:<path> origin/develop:<path>` check also found identical
blob IDs for all nine paths changed by the branch: `.dockerignore`, both
architecture guides, both contributing guides, `Dockerfile.dev`, `compose.yaml`,
and both Docker development guides.

At `main`, `Dockerfile.dev`, `compose.yaml`, and
`docs/docker-development.md` do not exist (`git cat-file -e main:<path>` fails for
each), so this workflow is absent from `main`.

## `origin/feat/fastq-phred-quality-decoder`

### Structurally unmerged commits

The branch forked from `2f9e332c7fd99e1376a5866d58c414508ef43cf0`.
These 13 commits are in neither base history, listed oldest first from
`git log --reverse 2f9e332..origin/feat/fastq-phred-quality-decoder`:

1. `07cc403ecb13244eec992dcd5b8514fd727a2224` — `feat(phred): support FASTQ quality encoding`
2. `0eaaccd04034e127995272e495692d41d44e89c4` — `feat(phred): restore calculator and add bidirectional FASTQ conversion`
3. `9aed9a802729e5001179f93514731f08e05ba6fd` — `test(phred): cover bidirectional FASTQ conversion`
4. `2947eb0c23a9b88b40fa024d27dd4a3d3d557e11` — `fix(phred): preserve reviewed formula text`
5. `1d6457a084b9a7ed42c8076ff9cfb9badd88eb4e` — `refactor(phred): simplify converter interface`
6. `f03a2b03f2e7aa798dd5afe7232050d5f762156a` — `refactor(phred): reuse Q score input for FASTQ`
7. `ff314a46c73656bd148eacdc338af16643f3445d` — `refactor(phred): unify score input and trim metrics`
8. `b664810e1c8aebd285f20e5047d7987dbcabea22` — `fix(phred): format probability as decimal`
9. `b9cd6afedb87fec799d315f8587d2e1b46bea006` — `test(phred): expect decimal probability formatting`
10. `7a1792050427b5e614b49f4f74085ae12be5feac` — `refactor(phred): place FASTQ before shared Q score`
11. `c94373c80b81341e844933a1880a6dadf9441207` — `fix(phred): align conversion fields and render formula`
12. `c25020f5ef69c01746c92fcd4a4ea676c6a41789` — `fix(phred): satisfy i18n audit for converter labels`
13. `ae2c0057def4486abebfae1701216f4b7ad05d50` — `fix(phred): avoid hook-style helper name`

### Effective behavior

The final branch adds integer-score parsing and FASTQ encoding for Phred+33 and
Phred+64, character lookup for the reference table, bidirectional synchronization
between FASTQ strings and scores, validation by the selected offset, and decimal
probability formatting. The final domain functions are defined at
`ae2c0057def4486abebfae1701216f4b7ad05d50:src/components/PhredScaleConverter/lib/phredDomain.js`:

- offset validation and FASTQ decoding: lines 1-21;
- `parseFastqQualityScores` and `encodeFastqQualityScores`: lines 23-37;
- `fastqCodeForScore`: lines 39-44;
- probability and score calculations/formatting: lines 50-86.

The synchronized UI handlers are at
`ae2c0057def4486abebfae1701216f4b7ad05d50:src/components/PhredScaleConverter.jsx`,
lines 41-139, and the FASTQ input and reference-table output are at lines 147-209
and 272-273.

Although every individual branch commit is marked `+` by `git cherry develop`,
the cumulative diff `2f9e332..ae2c005` has stable patch ID
`357db8b6a725609f70842b3d87ec63195a6b0e55`, exactly matching the patch ID of
the single `develop` commit `0c79458b17c9b59a0eb2b163da9d710c31d645b9`
(`feat: improve Phred FASTQ quality conversion`). The three changed files are
byte-for-byte identical at the branch tip and `develop`, as shown by equal blob
IDs:

| File | Shared blob ID |
| --- | --- |
| `src/components/PhredScaleConverter.jsx` | `0271062ae4e13b2f9fc834e1cf4b04d85bed79b5` |
| `src/components/PhredScaleConverter/lib/phredDomain.js` | `0a0b967ed8609f7af3261e80f852ed47b5fae629` |
| `src/tests/phredDomain.test.js` | `6e0c6db0c462fefd292724e8f7f859dfc6385ec1` |

Therefore no final Phred function or behavior is missing from `develop`.

At `main`, the domain file contains only score/probability conversion and
formatting (`main:src/components/PhredScaleConverter/lib/phredDomain.js`, lines
1-35), and its component has only score/probability modes
(`main:src/components/PhredScaleConverter.jsx`, lines 13-29 and 35-107). It has
none of `FASTQ_PHRED_OFFSETS`, `decodeFastqQualityString`,
`parseFastqQualityScores`, `encodeFastqQualityScores`, or `fastqCodeForScore`, so
the FASTQ behavior is absent from `main`.

## `origin/fix/docmeta-clear-edit-time`

### Structurally unmerged commits

The branch forked from `0c79458b17c9b59a0eb2b163da9d710c31d645b9`.
These two commits are in neither base history:

1. `7188244465f35b16f53a063331004da84fb9c593` — `chore: apply DocMeta edit-time hotfix`
2. `de4ca2cc0ce0a3b46f02ac985769f74c9df20dba` — `fix(docmeta): clear total editing time metadata`

### Effective behavior

The branch makes metadata stripping clear ODF `editing-duration`, OOXML
`docProps/app.xml` `TotalTime`, and the displayed `TotalTime` value after a
private strip. The ODF removal lists are at
`de4ca2cc0ce0a3b46f02ac985769f74c9df20dba:src/components/DocMeta.jsx`, lines
840-850; OOXML `TotalTime` clearing is at lines 884-899; and the in-memory result
clears `TotalTime` at lines 905-926.

The cumulative diff `0c79458..de4ca2c` has stable patch ID
`6c1a627001c7b349d87bd1ecd7daee3a20151b45`, exactly matching the patch ID of
the single `develop` commit `c4863e6e56aea58fa561483e14c29cc942eea5eb`
(`fix(docmeta): clear total editing time metadata`). `src/components/DocMeta.jsx`
has the same blob ID at the branch tip and `develop`:
`412bf86d8c2d097c0bd84f825809ae92ea560517`. Therefore no DocMeta function or
behavior is missing from `develop`.

At `main`, the parser can read ODF `editing-duration` into `TotalTime`
(`main:src/components/DocMeta.jsx`, lines 334-345), but the stripping path omits
`editing-duration`, never edits OOXML `app.xml`, and preserves `f.app` after a
private strip (`main:src/components/DocMeta.jsx`, lines 832-887 and 890-907).
The fix is therefore absent from `main`.

## Practical interpretation

- Do not merge any of the three branch tips into `develop` merely to recover
  functionality; their final effective changes are already present there.
- An ancestry-only cleanup tool will still report the branches as unmerged,
  because the original commit objects were not retained during the squash/direct
  landing workflow.
- Promoting current `develop` to `main` would carry all three effective changes;
  merging the stale topic branches independently into `main` would also pull
  branch-specific historical ancestry and is not necessary for preserving their
  functions.

## Reproduction commands

```bash
git fetch --prune origin
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes
git rev-list <candidate> --not main develop
git merge-base develop <candidate>
git diff <merge-base>..<candidate> | git patch-id --stable
git show <develop-landing-commit> --pretty=format: | git patch-id --stable
git rev-parse <candidate>:<path> develop:<path>
git grep -n '<function-or-behavior-token>' main -- <path>
```
