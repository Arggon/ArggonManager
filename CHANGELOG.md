<!-- arggon:generated template="CHANGELOG.md" -->

# Changelog

All notable changes to ArggonManager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0](https://github.com/Arggon/ArggonManager/compare/v0.5.0...v0.6.0) (2026-10-09)


### Added

* **acceptance:** report-only `accept:` detector (report/show + spec analyze finding) — task-role-model-report-only-detector ([0c271bc](https://github.com/Arggon/ArggonManager/commit/0c271bc260eb2900ee4ed7b9d567fbe95bc0e69d))
* **acceptance:** report-only `accept:` detector on report/show + spec analyze ([ab46bd9](https://github.com/Arggon/ArggonManager/commit/ab46bd9ead3455c9eb2fa90e7fdbf63a79f7343a))
* **adapters:** arming for acknowledged orphans (`x-tracker.reap-acked-orphans`) ([69b4dc4](https://github.com/Arggon/ArggonManager/commit/69b4dc466666d3f83c4db25302ecd0a896479998))
* **adapters:** reap orphaned generated files behind a checksum guard ([fe6f006](https://github.com/Arggon/ArggonManager/commit/fe6f0063904e739618236ac4446b6155223992a6))
* **adapters:** reap orphaned generated files behind a checksum guard ([7f01912](https://github.com/Arggon/ArggonManager/commit/7f01912520a0ad4b3dfaf3da2aee16eaf4c1c897))
* **brief:** decision-brief kernel, show field, and report-only finding ([ba7b46d](https://github.com/Arggon/ArggonManager/commit/ba7b46d49f89346a8f63b15853321bdd352f56b0))
* **brief:** decision-brief kernel, show field, and report-only finding ([b2233b6](https://github.com/Arggon/ArggonManager/commit/b2233b67de7ffa8cba5e4b74a0500fe9e5ae7299))
* **task-agent-role-contracts-seam:** rename the four agent ids to their roles, add role contracts and domain-neutral gate language (ADR 0021 §6.1/§6.2/§6.2a′) ([0d1571e](https://github.com/Arggon/ArggonManager/commit/0d1571e0422ed0786a3db23acc57c124c91c695a))
* **zcode:** goal-mode contract derived from the item's checklist (task-zcode-goal-mode) ([6bc995b](https://github.com/Arggon/ArggonManager/commit/6bc995bab44b91b72cd4fbe541aec863e63d86d7))


### Fixed

* **adapters:** reaping ignores `acknowledged`, and README carries the surface ([d4a7a43](https://github.com/Arggon/ArggonManager/commit/d4a7a436961a31fdd58c490d891a7ba1d6ea50f1))
* **arggon:** refuse a tracker write that binds to an undeclared checkout ([eb42a4e](https://github.com/Arggon/ArggonManager/commit/eb42a4eeda02b5f3c5705f618cda5ea469a9f4d4))
* **arggon:** refuse a tracker write that binds to an undeclared checkout (bug-native-arggon-tools-resolve-tracker-root-to-session-cwd) ([567b7a1](https://github.com/Arggon/ArggonManager/commit/567b7a11f34f588c628ef953ba45da5c38779037))
* **auto-done:** classify both done-gate refusals by error code, and correct ADR 0025's measured claim (bug-done-gate-counts-checkboxes-inside-comment-blocks) ([f8b7551](https://github.com/Arggon/ArggonManager/commit/f8b7551bea104cf7a7f81be35e3360775cbbc647))
* **docs:** ADR status doc contract — cover all carriers, read both sides of a link ([aa86f43](https://github.com/Arggon/ArggonManager/commit/aa86f434218c27162aa68ca5b93c600225be3e88))
* **docs:** cite ADR STATUS_CLASSES by symbol, and bound the carrier tail window at a group closer ([7b7c3c7](https://github.com/Arggon/ArggonManager/commit/7b7c3c733323a9d143796aa36ea7f663aa9453c7))
* **docs:** drop the stale ADR 0003 status from the engineering carrier + pin it ([bbe1f4e](https://github.com/Arggon/ArggonManager/commit/bbe1f4eb93e1bc93ba0b42290331d42066b493ea))
* **docs:** index ADR 0023 so the cli lane's parity check passes again ([b2da032](https://github.com/Arggon/ArggonManager/commit/b2da032969c7fa1a5afceebe9dbb59eef0cf68cb))
* **docs:** point convention.md's done-gate rule at ADR 0015's real filename ([2ee9890](https://github.com/Arggon/ArggonManager/commit/2ee989022dbb09a6e61e45f2a148b2a618444f8c))
* **docs:** repair convention.md's dead ADR 0015 link (bug-convention-md-links-nonexistent-adr-0015) ([c5b4b29](https://github.com/Arggon/ArggonManager/commit/c5b4b29e2f75b22d61c818881d5df32cce9191c8))
* **done-gate:** read the live `## Acceptance` section, and refuse a flip with no contract (bug-done-gate-counts-checkboxes-inside-comment-blocks) ([6d3bef0](https://github.com/Arggon/ArggonManager/commit/6d3bef0c15d3588e4ac91093d5aeeef26b1d9671))
* **done-gate:** scope the gate to the live `## Acceptance` section and refuse a flip with no contract (bug-done-gate-counts-checkboxes-inside-comment-blocks) ([8182844](https://github.com/Arggon/ArggonManager/commit/81828441bf63019ffd954769b8b3dd2fc73cf923))
* **exploration 023:** correct the gate/script count — 9 of 10 runnable steps are npm scripts, not 10 of 11 ([26d926e](https://github.com/Arggon/ArggonManager/commit/26d926e91e2daac28445ab10850084369b15402c))
* **kernel:** validate requires the frontmatter block to EXIST, not just to be well-formed ([8f7f2f3](https://github.com/Arggon/ArggonManager/commit/8f7f2f3a833678657b1c581cd4ab65e4645a1d07))
* **release:** make release-please agree with the vX.Y.Z tag contract ([b7b5f86](https://github.com/Arggon/ArggonManager/commit/b7b5f866b5c6914892784251fcc29dfa7bf62612))
* **smoke:** assert the claim's identity doctrine instead of a pinned assignee (ADR 0021 §5) ([bcd165a](https://github.com/Arggon/ArggonManager/commit/bcd165af873e2f204d843aca87bdcd9f67f3245c))
* **start:** the CLI worktree refusal leads with its remediation, not the kernel detail ([f5f6e16](https://github.com/Arggon/ArggonManager/commit/f5f6e16d01744511ab545b19a6aa01673fe88cfd))
* **tasks:** take main's bytes for the three diverged item files (B1) ([019035a](https://github.com/Arggon/ArggonManager/commit/019035a02e3309c233314a9cd7b6f1b512c442c4))
* **test:** pack a private copy, not the checkout (bug-test-suite-lib-dist-rebuild-race) ([c1d8741](https://github.com/Arggon/ArggonManager/commit/c1d8741aaa6f4221d068411b028d105daa0faf72))
* **test:** pin the caller identity in the goal-mode refusal cases ([88afc59](https://github.com/Arggon/ArggonManager/commit/88afc598ff78561f291672db0d55af35a23d2f60))
* **test:** pin the caller identity in the goal-mode refusal cases ([9869a50](https://github.com/Arggon/ArggonManager/commit/9869a50e1b4fc7ae1b8edc93179b759aa5a33047))
* **zcode-seam:** keep the agent rename while adding the goal-mode command ([d642a07](https://github.com/Arggon/ArggonManager/commit/d642a07366be441f973040eee229a3b44575bf9a))


### Changed

* accept ADR 0024 on merge (lifecycle: accepted on merge) ([3d61203](https://github.com/Arggon/ArggonManager/commit/3d612032152f5e0c9ae3a792182e51a68724c659))
* **adopter-friction:** exploration 019 + ADR 0021 + spec/plan 018 + plan, and the implementation chain (round 2) ([12df1ee](https://github.com/Arggon/ArggonManager/commit/12df1ee0d40551036236805df958ed6e8d7e5305))
* **adr-0021:** restate the retired agent ids at the shipped ids (bug-adr-0021-s5-lists-retired-agent-ids) ([e6e3cf2](https://github.com/Arggon/ArggonManager/commit/e6e3cf24bfded03b392ef7d8c9a0ae782f74fe36))
* **adr-0021:** restate the retired agent ids at the shipped ids (PR [#641](https://github.com/Arggon/ArggonManager/issues/641)) ([a184a39](https://github.com/Arggon/ArggonManager/commit/a184a39ae0fe79e9935db3f2222ec9b1956817f6))
* **adr:** accept ADR 0026 in the merge commit, per the ADR lifecycle ([30bcd06](https://github.com/Arggon/ArggonManager/commit/30bcd069bc133b07e95f898dcd0fa9c361210249))
* **adr:** address review on ADR 0026 — default direction, citations, live acceptance ([e2023c1](https://github.com/Arggon/ArggonManager/commit/e2023c1a5d981aaa1f3ed3bfafa2ebdd81999956))
* **adr:** ADR 0021 amendment — name the four agent roles and make the contracts domain-neutral ([8d3b185](https://github.com/Arggon/ArggonManager/commit/8d3b185dc2940c05511a6dcd785c69aff8ef115f))
* **adr:** ADR 0021 is Accepted (status flip after PR [#624](https://github.com/Arggon/ArggonManager/issues/624) merged) ([7e83548](https://github.com/Arggon/ArggonManager/commit/7e83548383978d01e5e0482269fb8bf6c713cb44))
* **adr:** ADR 0026 — the bounded plain-language decision brief ([76e0a4b](https://github.com/Arggon/ArggonManager/commit/76e0a4bcaf55d7b89469195251cb86d2a26ef71f))
* **adr:** amend 0021 — name the four agent roles, make contracts domain-neutral, keep the ids ([5a56a12](https://github.com/Arggon/ArggonManager/commit/5a56a121ee5c70b4b68fa08c7d94b6d801051480))
* **adr:** fix a dead spec link in the ADR 0026 amendment ([cb55685](https://github.com/Arggon/ArggonManager/commit/cb5568526d8816d6b4f4c3328633d2c6443d08a3))
* **adr:** flip ADR 0021 to Accepted (lifecycle: accepted on merge) ([7d23a55](https://github.com/Arggon/ArggonManager/commit/7d23a55fe7eabba0aba6777fe7491e07c4ef55ac))
* **adr:** index ADR 0021 in docs/adr/README.md ([c2e0bfc](https://github.com/Arggon/ArggonManager/commit/c2e0bfccfac79cebcb937162248f29418d94f0c3))
* **adr:** supersede 0021 §6.2a — the agent rename proceeds, gated on orphan reaping ([f1fe2d4](https://github.com/Arggon/ArggonManager/commit/f1fe2d46da78131e18c43bae8b88d7b3c4f6ca09))
* **adr:** supersede 0021 §6.2a — the rename proceeds, gated on orphan reaping ([e4be2a5](https://github.com/Arggon/ArggonManager/commit/e4be2a559abc1a883bd7ee5b09f90db272c77417))
* agent-primary role model — exploration 019 + ADR 0021 (proposed) ([171f43b](https://github.com/Arggon/ArggonManager/commit/171f43b38e1648b94f93cec29d2fdbb4c7fab3c1))
* amend ADR 0020 and correct docs/claim.md to the two-axis invariant ([f3a48d0](https://github.com/Arggon/ArggonManager/commit/f3a48d09964f77b8c765b1b41db1237a758f85dc))
* **auto:** mark items done (PR [#586](https://github.com/Arggon/ArggonManager/issues/586) merged) ([#655](https://github.com/Arggon/ArggonManager/issues/655)) ([42e6e2a](https://github.com/Arggon/ArggonManager/commit/42e6e2a9346cefeada583520c51ffbda2cd0a39b))
* **auto:** mark items done (PR [#620](https://github.com/Arggon/ArggonManager/issues/620) merged) ([#654](https://github.com/Arggon/ArggonManager/issues/654)) ([a544548](https://github.com/Arggon/ArggonManager/commit/a5445484980303dc15238604f2428dc3da75ef31))
* **auto:** mark items done (PR [#622](https://github.com/Arggon/ArggonManager/issues/622) merged) ([#623](https://github.com/Arggon/ArggonManager/issues/623)) ([8e3e921](https://github.com/Arggon/ArggonManager/commit/8e3e9214701142a5027edb5c2bdf092643ad1c5e))
* **auto:** mark items done (PR [#624](https://github.com/Arggon/ArggonManager/issues/624) merged) ([#625](https://github.com/Arggon/ArggonManager/issues/625)) ([1e65a86](https://github.com/Arggon/ArggonManager/commit/1e65a861740d69ff502d599e54e68b90f19b8354))
* **auto:** mark items done (PR [#626](https://github.com/Arggon/ArggonManager/issues/626) merged) ([#627](https://github.com/Arggon/ArggonManager/issues/627)) ([a83404a](https://github.com/Arggon/ArggonManager/commit/a83404aba83c48c5e837a07ed7feb33a39b6436a))
* **auto:** mark items done (PR [#628](https://github.com/Arggon/ArggonManager/issues/628) merged) ([#629](https://github.com/Arggon/ArggonManager/issues/629)) ([e49c425](https://github.com/Arggon/ArggonManager/commit/e49c4259359c490cdae11dc5261012220c2df69e))
* **auto:** mark items done (PR [#630](https://github.com/Arggon/ArggonManager/issues/630) merged) ([#631](https://github.com/Arggon/ArggonManager/issues/631)) ([df03c10](https://github.com/Arggon/ArggonManager/commit/df03c1084aaaf3045ed212989a414b9f0a505046))
* **auto:** mark items done (PR [#632](https://github.com/Arggon/ArggonManager/issues/632) merged) ([#633](https://github.com/Arggon/ArggonManager/issues/633)) ([e93c511](https://github.com/Arggon/ArggonManager/commit/e93c511b71226c0a5582f44527d64a5275845944))
* **auto:** mark items done (PR [#634](https://github.com/Arggon/ArggonManager/issues/634) merged) ([#635](https://github.com/Arggon/ArggonManager/issues/635)) ([6e2a0b1](https://github.com/Arggon/ArggonManager/commit/6e2a0b1c6441454b08d8d814bc83f9b5780b39c6))
* **auto:** mark items done (PR [#642](https://github.com/Arggon/ArggonManager/issues/642) merged) ([#643](https://github.com/Arggon/ArggonManager/issues/643)) ([22938a0](https://github.com/Arggon/ArggonManager/commit/22938a0ef3a31362d32a06f24255767ca2e0ef1c))
* **auto:** mark items done (PR [#644](https://github.com/Arggon/ArggonManager/issues/644) merged) ([#645](https://github.com/Arggon/ArggonManager/issues/645)) ([801022d](https://github.com/Arggon/ArggonManager/commit/801022d076defd4aaa6b002e014368b648bf21b3))
* **auto:** mark items done (PR [#656](https://github.com/Arggon/ArggonManager/issues/656) merged) ([#658](https://github.com/Arggon/ArggonManager/issues/658)) ([8fe3a57](https://github.com/Arggon/ArggonManager/commit/8fe3a575ac039a3d78df31eb7c4d8d7e032c445f))
* **auto:** mark items done (PR [#660](https://github.com/Arggon/ArggonManager/issues/660) merged) ([#661](https://github.com/Arggon/ArggonManager/issues/661)) ([386c517](https://github.com/Arggon/ArggonManager/commit/386c517253ef64d6e6199972f673d5e9b517121b))
* **carriers:** the role model — parity in the loop, named authority (ADR 0021) ([50bc871](https://github.com/Arggon/ArggonManager/commit/50bc871d5cdecbd1dec23f2d02b0e928a6fbce69))
* **carriers:** the role model — work-loop parity, named authority (ADR 0021) ([f216338](https://github.com/Arggon/ArggonManager/commit/f2163380c5f2a4744aca50853152cf99dd2c3190))
* **ci:** CI wall-clock exploration + ADR 0023 (concurrency, duration-aware sharding, the `cli` required check) ([66035a4](https://github.com/Arggon/ArggonManager/commit/66035a4a62e15bec87e70dcc9d353feb4b2a869b))
* **cli:** mark the orphan-reaping example's agent id RETIRED and name its live successor (bug-docs-ts-stale-example-path) ([493008a](https://github.com/Arggon/ArggonManager/commit/493008ae26085d6166c3310dcec7569ab8eebab7))
* **cli:** mark the retired rename-orphan example in docs.ts as retired ([f3ae6d7](https://github.com/Arggon/ArggonManager/commit/f3ae6d77c33f18e32cdce4274e3586cbbf18e78e))
* **convention:** document x-tracker.product-acceptance ([0dae149](https://github.com/Arggon/ArggonManager/commit/0dae149f90f612531934f69f85435b6b31c69d06))
* decline AutoHarness / AutoContext / AutoCompact; adopt the lesson-store idea (exploration-020 + ADR 0022) ([25fde21](https://github.com/Arggon/ArggonManager/commit/25fde21a15709af4ec046104db9e145759320384))
* drop a node_modules symlink accidentally committed by the recovery ([6af1617](https://github.com/Arggon/ArggonManager/commit/6af16170d1d920bd7491f8ecd6ff13e969b70d54))
* drop a scratch probe extraction and ignore tmp/ ([4e60e69](https://github.com/Arggon/ArggonManager/commit/4e60e6921c85b392fcfafd2c90f350ca00f4c40b))
* **exploration:** agent-primary role model — six-phase record + ADR 0021 (proposed) ([2266c1f](https://github.com/Arggon/ArggonManager/commit/2266c1f11e7973003ec834e3a6ee2acde723c003))
* **exploration:** AutoHarness/AutoContext/AutoCompact — decline all five, steal one idea (exploration-020 + ADR 0022) ([8643c32](https://github.com/Arggon/ArggonManager/commit/8643c32b944245138366c804dd1b945abede57f0))
* **exploration:** correct an inference in exploration 025's measured table ([99648f6](https://github.com/Arggon/ArggonManager/commit/99648f69380252fedc712c0b05fc0e222f19a3b6))
* **exploration:** local validation pipeline 023 — greenfield, npm scripts own the gate list ([231e3f1](https://github.com/Arggon/ArggonManager/commit/231e3f15c367594a275418cde7ae5a78d2070419))
* **exploration:** what the AutoHarness/AutoContext/AutoCompact papers change for us — supersede 020's evidence, retain its decision ([46bdf05](https://github.com/Arggon/ArggonManager/commit/46bdf05f5981e6f846abe7a18fa565d72e04dbe6))
* ignore .scratch/ and stop committing isolation scratch ([6bd3363](https://github.com/Arggon/ArggonManager/commit/6bd3363651af4c682391c0ffd0a971f8c39d06b3))
* **json-output:** fix a nested code span in the decision_brief row ([d884b8f](https://github.com/Arggon/ArggonManager/commit/d884b8fbc7228d9a62b6bb59d73391a1a94939aa))
* **methodology:** carry the decision-brief convention across the carriers ([41fdf94](https://github.com/Arggon/ArggonManager/commit/41fdf949727294f5b73b4578241f01e44400e48e))
* **methodology:** carry the decision-brief convention across the carriers ([0e54743](https://github.com/Arggon/ArggonManager/commit/0e547431bf4eb18af763010a76ce540ac77d151e))
* re-run release-please after the label fix ([85f3abe](https://github.com/Arggon/ArggonManager/commit/85f3abecc1c38824c97117eeea01c92578feffab))
* **release:** 0.6.0 ([c722ee1](https://github.com/Arggon/ArggonManager/commit/c722ee13571c0e091a0fff5f9275f0f146085e95))
* **seam:** drop the stranded arggon-prover.md from this repo's own seam ([40292f9](https://github.com/Arggon/ArggonManager/commit/40292f97774b75fb51b4aba8c588ec77c3fbee3d))
* **seam:** regenerate the ZCode goal-mode seam after the round-3 template edit (task-zcode-goal-mode) ([93ec81b](https://github.com/Arggon/ArggonManager/commit/93ec81b50d368f2b67ee8c4d98d1cd97abce9cb4))
* **spec:** promotion policy + the accept: product-acceptance convention (spec-018) ([e14dd75](https://github.com/Arggon/ArggonManager/commit/e14dd75e92a4f0c6b02fc4c304ae933b8759d59f))
* **spec:** promotion policy + the accept: product-acceptance convention (spec-018) ([c47ffb1](https://github.com/Arggon/ArggonManager/commit/c47ffb1f0051dac47b7363c6f14fe978e76dd905))
* **spec:** the agent rename migration (spec-019) ([9fbb81d](https://github.com/Arggon/ArggonManager/commit/9fbb81d41adae94fd6de33f74e86be723ac1b0e8))
* **spec:** the agent rename migration (spec-019) ([3dad7b4](https://github.com/Arggon/ArggonManager/commit/3dad7b4d2c290e71c5985d6a8324e824905609d0))
* supersede the flat parity invariant in ADR 0020 and docs/claim.md ([28251eb](https://github.com/Arggon/ArggonManager/commit/28251eb27e87daaa91d68851723f55c902adc1d6))
* **tasks:** cancel the two seam probes and close out the isolation ([1b0dfec](https://github.com/Arggon/ArggonManager/commit/1b0dfecc72de2eb952ee647644e79166c154c152))
* **tasks:** carry the round-5 approve verdict onto the branch ([7c95fac](https://github.com/Arggon/ArggonManager/commit/7c95facb18a95a4e99cdb14b754ce42f03b7fd8d))
* **tasks:** carry the round-5 approve verdict onto the branch ([6fb0152](https://github.com/Arggon/ArggonManager/commit/6fb0152e84cf244ee20bfc3b802a3d5b3c3a5aee))
* **tasks:** claimed bug-adr-0021-s5-lists-retired-agent-ids ([60fb088](https://github.com/Arggon/ArggonManager/commit/60fb08813670f20d5982c747c9c05b42a1575dff))
* **tasks:** claimed bug-adr-0023-ships-unindexed-blocks-every-pr ([d9d19fb](https://github.com/Arggon/ArggonManager/commit/d9d19fba2646f49bc1c4ca3700e50f4b65dbb023))
* **tasks:** claimed bug-adr-0023-ships-unindexed-blocks-every-pr ([3a30286](https://github.com/Arggon/ArggonManager/commit/3a302869ee9b56c06bb5008117624fc2df8e7644))
* **tasks:** claimed bug-convention-md-links-nonexistent-adr-0015 ([6039f3f](https://github.com/Arggon/ArggonManager/commit/6039f3f41fc09eed0dd21dc059ce6b5ba434bbd3))
* **tasks:** claimed bug-docs-ts-stale-example-path ([aabb4d5](https://github.com/Arggon/ArggonManager/commit/aabb4d593ca867d69d13c3ffea1b2c1907ee7870))
* **tasks:** claimed bug-done-gate-counts-checkboxes-inside-comment-blocks ([11fc70a](https://github.com/Arggon/ArggonManager/commit/11fc70a0cf5c0d82d92d29c378ed25260bdfd909))
* **tasks:** claimed bug-mcp-parity-branch-test-json-parse-of-human-stdout ([be8cea2](https://github.com/Arggon/ArggonManager/commit/be8cea293eaaeef270e24cf91ebbf4e3216ac05f))
* **tasks:** claimed bug-native-arggon-tools-resolve-tracker-root-to-session-cwd ([ccf68d1](https://github.com/Arggon/ArggonManager/commit/ccf68d1670c97a6d5d3b0d50d550e13bb4da9163))
* **tasks:** claimed bug-parity-invariant-restated-outside-carriers ([3b7e768](https://github.com/Arggon/ArggonManager/commit/3b7e76804a48b794b67315e15f3b3df66a7cdc6d))
* **tasks:** claimed bug-test-suite-lib-dist-rebuild-race ([e84d65c](https://github.com/Arggon/ArggonManager/commit/e84d65c458184667a3832316a34c8c2118ddbf35))
* **tasks:** claimed task-adapter-orphan-reaping ([80974cc](https://github.com/Arggon/ArggonManager/commit/80974ccc506a1178a5390f4bcccc864b10038cdf))
* **tasks:** claimed task-adapter-orphan-reaping ([fad39af](https://github.com/Arggon/ArggonManager/commit/fad39afb81e3882cd0ad592034bd6fab2915c332))
* **tasks:** claimed task-adr-0021-role-model-amendment ([e05ac34](https://github.com/Arggon/ArggonManager/commit/e05ac343999b5570e77c971e6fbc49dff75c1d13))
* **tasks:** claimed task-adr-0021-status-accepted ([f00ea0f](https://github.com/Arggon/ArggonManager/commit/f00ea0f9a4f21932ed5c40dd799ef61f62116cc4))
* **tasks:** claimed task-adr-0021-supersede-6-2a ([361db59](https://github.com/Arggon/ArggonManager/commit/361db591a5d28aeb36053397b8daee82b27f8d0e))
* **tasks:** claimed task-adr-0026-owner-decision-brief ([b5395c2](https://github.com/Arggon/ArggonManager/commit/b5395c22d0900788fb5116c32843eea27a779c97))
* **tasks:** claimed task-agent-role-contracts-seam ([b77759e](https://github.com/Arggon/ArggonManager/commit/b77759e703fa758ba4d5ebc41b70739483309b0e))
* **tasks:** claimed task-cli-start-remediation-tail-clipped-on-human-channel ([e7ebef8](https://github.com/Arggon/ArggonManager/commit/e7ebef8c5ecc5e354383e204b4f9028cf38e88fc))
* **tasks:** claimed task-explore-agent-primary-role-model ([75b42f3](https://github.com/Arggon/ArggonManager/commit/75b42f3870d27783ea27ef5be363e938c1669bf1))
* **tasks:** claimed task-explore-autoharness-autocontext-autocompact ([0fceee3](https://github.com/Arggon/ArggonManager/commit/0fceee3ca97efd650f25588aa8facefe7aa5913c))
* **tasks:** claimed task-explore-harness-research-transfer ([8da5693](https://github.com/Arggon/ArggonManager/commit/8da5693a70bd9f818685b1cd51314780e2d2597a))
* **tasks:** claimed task-implement-decision-brief-kernel ([b61f6a0](https://github.com/Arggon/ArggonManager/commit/b61f6a060faee50f78295619ee822450692afd2b))
* **tasks:** claimed task-probe-native-seam-gate ([4184042](https://github.com/Arggon/ArggonManager/commit/4184042efa6d3b94b8663c30d34c5b43507e9e4c))
* **tasks:** claimed task-probe-seam-body-shape ([9647a52](https://github.com/Arggon/ArggonManager/commit/9647a52c7243f84eb4d38fd88f175222d8393fb4))
* **tasks:** claimed task-role-model-report-only-detector ([8cd9411](https://github.com/Arggon/ArggonManager/commit/8cd94110537e489aef6bcb7fdfcb44447a0dbb2d))
* **tasks:** claimed task-spec-agent-rename-migration ([cacc2f2](https://github.com/Arggon/ArggonManager/commit/cacc2f2e3b92f735749705dae1f3af4157c7de35))
* **tasks:** claimed task-spec-owner-decision-brief ([066c3c0](https://github.com/Arggon/ArggonManager/commit/066c3c057f9fb74c8348e5fafda2a5e1cbeb129c))
* **tasks:** claimed task-spec-promotion-policy-and-acceptance ([e4ea49d](https://github.com/Arggon/ArggonManager/commit/e4ea49da1b3947e49f194653b8ca591d7f6b5f2c))
* **tasks:** claimed task-wire-decision-brief-carriers ([ff30563](https://github.com/Arggon/ArggonManager/commit/ff30563d66c06a6a08d88735c67bade2fd7adc6e))
* **tasks:** claimed task-wire-role-model-carriers ([a51296c](https://github.com/Arggon/ArggonManager/commit/a51296ca5e3542fae7d80b2163e4cd939b948702))
* **tasks:** claimed task-zcode-goal-mode ([020731b](https://github.com/Arggon/ArggonManager/commit/020731b1e675a9ee3bb3a7028fcef86db143e19d))
* **tasks:** commented bug-adopter-engineering-template-software-locked ([9967d99](https://github.com/Arggon/ArggonManager/commit/9967d99cbb709eef79b236889c402fb262e64a63))
* **tasks:** commented bug-adopter-engineering-template-software-locked ([05ba97a](https://github.com/Arggon/ArggonManager/commit/05ba97a1e6f3d637b1d148e637e67b0611d17d56))
* **tasks:** commented bug-adopter-engineering-template-software-locked ([f1a7469](https://github.com/Arggon/ArggonManager/commit/f1a7469682d192b287ebc5cbb40af2ed9caf618a))
* **tasks:** commented bug-adr-0021-s5-lists-retired-agent-ids ([c07fd73](https://github.com/Arggon/ArggonManager/commit/c07fd7324988756dfbeaf590d4e2a70775720075))
* **tasks:** commented bug-adr-0021-s5-lists-retired-agent-ids ([689d1b5](https://github.com/Arggon/ArggonManager/commit/689d1b5fa13a7ba2ebedefd3f2c5b48f2ff5d4c5))
* **tasks:** commented bug-adr-0023-ships-unindexed-blocks-every-pr ([3f0dcac](https://github.com/Arggon/ArggonManager/commit/3f0dcac0180aae3d599e8bf6302ee77907825016))
* **tasks:** commented bug-bundle-update-tool-drops-waive-and-force ([1f744a6](https://github.com/Arggon/ArggonManager/commit/1f744a67c0757f80a3daef3110e15588c0d0e1f8))
* **tasks:** commented bug-ci-seam-pin-shell-vs-test-copy-divergence ([f205bed](https://github.com/Arggon/ArggonManager/commit/f205bed747147ad42c82988f59a3549cda9ac5de))
* **tasks:** commented bug-ci-seam-pin-shell-vs-test-copy-divergence ([9f8e747](https://github.com/Arggon/ArggonManager/commit/9f8e74740dd62a39fa96355baece2d62837fefe2))
* **tasks:** commented bug-ci-seam-pin-shell-vs-test-copy-divergence ([c7ec6df](https://github.com/Arggon/ArggonManager/commit/c7ec6df9adcb69d1b99d206845ec545b176449fe))
* **tasks:** commented bug-ci-seam-pin-shell-vs-test-copy-divergence ([d02c892](https://github.com/Arggon/ArggonManager/commit/d02c892b44e1dba55f28326db4573ba5b8c7e3d8))
* **tasks:** commented bug-cli-spawn-suites-exit-1-flake ([2151878](https://github.com/Arggon/ArggonManager/commit/2151878ba85d42ecf9e9dda1daaca98175e3a8d6))
* **tasks:** commented bug-convention-md-links-nonexistent-adr-0015 ([6a5731a](https://github.com/Arggon/ArggonManager/commit/6a5731a3b964f8eaa9d02d92e651fa347148ac40))
* **tasks:** commented bug-docs-ts-stale-example-path ([bf6c6e3](https://github.com/Arggon/ArggonManager/commit/bf6c6e39ac710a1582d2de08beecc1563d04ad5b))
* **tasks:** commented bug-docs-ts-stale-example-path ([8b48256](https://github.com/Arggon/ArggonManager/commit/8b482569496002927944774fe482b05d020bac31))
* **tasks:** commented bug-docs-ts-stale-example-path ([f030e6b](https://github.com/Arggon/ArggonManager/commit/f030e6b42d4978922fa6bd9ab75994aa484e703f))
* **tasks:** commented bug-docs-ts-stale-example-path ([a7fdb32](https://github.com/Arggon/ArggonManager/commit/a7fdb327e6a25fa7257238ad4b10af410c628185))
* **tasks:** commented bug-done-gate-counts-checkboxes-inside-comment-blocks ([f0906c3](https://github.com/Arggon/ArggonManager/commit/f0906c3b6944049d7f90c6bb14d8d3cb4513a4a1))
* **tasks:** commented bug-done-gate-counts-checkboxes-inside-comment-blocks ([8af53c2](https://github.com/Arggon/ArggonManager/commit/8af53c2e0566d2addcf522feabb5218f2ba60418))
* **tasks:** commented bug-done-gate-counts-checkboxes-inside-comment-blocks ([706d8bc](https://github.com/Arggon/ArggonManager/commit/706d8bc3eee39bdda8780c8ee0306a833eeb0f71))
* **tasks:** commented bug-done-gate-counts-checkboxes-inside-comment-blocks ([97ce5fc](https://github.com/Arggon/ArggonManager/commit/97ce5fcfa28cd77e83b11de9ce76197e0199563a))
* **tasks:** commented bug-done-gate-counts-checkboxes-inside-comment-blocks ([23d0444](https://github.com/Arggon/ArggonManager/commit/23d044467ede38a94adbd19fb5f0a85403c02684))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([51bf81a](https://github.com/Arggon/ArggonManager/commit/51bf81a58d5187a35e28df8d9aa5f2df7d051aa5))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([5691ee9](https://github.com/Arggon/ArggonManager/commit/5691ee9e6dd4fdf7704c11c9efe9bedb27c4b35b))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([39ba524](https://github.com/Arggon/ArggonManager/commit/39ba5240a86dc78d0a4d0e13f43e402b60ffa78e))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([298e955](https://github.com/Arggon/ArggonManager/commit/298e95539841a1657dd70ef9f908010f500b6f53))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([0f5bb79](https://github.com/Arggon/ArggonManager/commit/0f5bb79ce1c2cc0bebd032ce07a59b9bd094f76d))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([f052588](https://github.com/Arggon/ArggonManager/commit/f052588f40082d425a8ea13279c0342a46ae6ff3))
* **tasks:** commented bug-engineering-doc-stale-adr-statuses ([0d86f23](https://github.com/Arggon/ArggonManager/commit/0d86f23e2133bbb0dfd2c29668bc65f25b671ad7))
* **tasks:** commented bug-headless-ci-twin-init-nondeterministic ([dfae877](https://github.com/Arggon/ArggonManager/commit/dfae877f4b27c960f4b7b624070668fa9bfcc3d4))
* **tasks:** commented bug-headless-ci-twin-init-nondeterministic ([4db4e46](https://github.com/Arggon/ArggonManager/commit/4db4e46cf6a713a88d191a6929a7e2295e4067aa))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([d619ee3](https://github.com/Arggon/ArggonManager/commit/d619ee39eb5998823af1c3dc3f6f4df2c1a0be4f))
* **tasks:** commented bug-mcp-parity-branch-test-json-parse-of-human-stdout ([49b7fd6](https://github.com/Arggon/ArggonManager/commit/49b7fd6607dd31f4d02874d75ab70c9e9765e28b))
* **tasks:** commented bug-native-arggon-tools-resolve-tracker-root-to-session-cwd ([c1e0e33](https://github.com/Arggon/ArggonManager/commit/c1e0e339cb2fbc53ecbcb299c7215da8b86019eb))
* **tasks:** commented bug-native-guard-silent-without-worktree-declaration ([97b10bd](https://github.com/Arggon/ArggonManager/commit/97b10bda89fae5181c0e64555e42788eec23e87b))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([accfe81](https://github.com/Arggon/ArggonManager/commit/accfe8198bc7a960f3ac215b9f8e91572d0aa8c8))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([c7fe564](https://github.com/Arggon/ArggonManager/commit/c7fe56428af94adace18bb33d64005c7ec5067c4))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([dec04fa](https://github.com/Arggon/ArggonManager/commit/dec04fadf15890c281a8e114894dc07e3d00598e))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([d40666e](https://github.com/Arggon/ArggonManager/commit/d40666e77e8f352af97fa77a2c87236c826674e4))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([66cd2d5](https://github.com/Arggon/ArggonManager/commit/66cd2d5ee6e513e34352207478063eb8334c2718))
* **tasks:** commented bug-native-seam-bundle-diverges-from-live-kernel ([6269fa6](https://github.com/Arggon/ArggonManager/commit/6269fa6586222d4431cbf2031063bd580507e34c))
* **tasks:** commented bug-no-gate-warns-on-paired-impl-and-test-deletion ([a3e5ea7](https://github.com/Arggon/ArggonManager/commit/a3e5ea778936c1439a165775a6b4273f1eea6c3a))
* **tasks:** commented bug-parity-invariant-restated-outside-carriers ([8e9ad88](https://github.com/Arggon/ArggonManager/commit/8e9ad886587cb1678bafa8f695fa6f9c9e7f24cc))
* **tasks:** commented bug-parity-invariant-restated-outside-carriers ([417daa1](https://github.com/Arggon/ArggonManager/commit/417daa1c61d266dce7878d6d3fd916488a959bc4))
* **tasks:** commented bug-parity-invariant-restated-outside-carriers ([b5660fb](https://github.com/Arggon/ArggonManager/commit/b5660fbb921300c597c8e2eb71dd48b6584d6f42))
* **tasks:** commented bug-parity-invariant-restated-outside-carriers ([23aa3d5](https://github.com/Arggon/ArggonManager/commit/23aa3d51baae84fff637e293d23aadc973dcbea2))
* **tasks:** commented bug-prose-format-codespan-test-times-out-under-full-suite ([2274145](https://github.com/Arggon/ArggonManager/commit/227414597a2242804998bf688cea90d2310e5631))
* **tasks:** commented bug-seam-bundle-stale-snapshot-gate ([9f9b22c](https://github.com/Arggon/ArggonManager/commit/9f9b22cd09138a54971ef1305e83ba89800875d3))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([8c8e6f5](https://github.com/Arggon/ArggonManager/commit/8c8e6f530bf4f418d7415f74d846fcb662b7c2e6))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([f9f9eff](https://github.com/Arggon/ArggonManager/commit/f9f9effb070d85b52786a89acdf220b2b926f5df))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([87d3377](https://github.com/Arggon/ArggonManager/commit/87d3377dd4d66c57596c6327436462e098f018a4))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([bf9d53e](https://github.com/Arggon/ArggonManager/commit/bf9d53e35915d9fabe1d0a350237e6f28bb7cc89))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([a5fe16f](https://github.com/Arggon/ArggonManager/commit/a5fe16f80038ad9e7f61eed1e9faa7921df7f1c8))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([9e7f40e](https://github.com/Arggon/ArggonManager/commit/9e7f40ec246145e71c29a995e616bf38b6ad4fd2))
* **tasks:** commented bug-test-suite-lib-dist-rebuild-race ([c1068cb](https://github.com/Arggon/ArggonManager/commit/c1068cb93dd5f277ca420ea64ba9047303d0ac06))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([4073931](https://github.com/Arggon/ArggonManager/commit/40739313c55f2681863eac6e4e1eced9aa6be96d))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([a4a82ad](https://github.com/Arggon/ArggonManager/commit/a4a82ad2f08bcab56dd469a3beed32fc89321590))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([5383014](https://github.com/Arggon/ArggonManager/commit/538301495e09756cd0573da1e47788bf46eef96f))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([c54c18a](https://github.com/Arggon/ArggonManager/commit/c54c18af2745cdaa0c9c5730c53f52ed4e5e2d7d))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([d0e989f](https://github.com/Arggon/ArggonManager/commit/d0e989fc7e5fd7f7949a01c48443a0109d5be023))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([db0a01d](https://github.com/Arggon/ArggonManager/commit/db0a01d83f464ef30def22e465013718da46a2ed))
* **tasks:** commented bug-validate-does-not-check-frontmatter-present ([0fe4b24](https://github.com/Arggon/ArggonManager/commit/0fe4b24e676db730be4cb7fe55bd7b73e534a39e))
* **tasks:** commented bug-verification-regex-matching-nothing ([5dfe812](https://github.com/Arggon/ArggonManager/commit/5dfe812314285fbb6fb94c07a9305db58c9c0d07))
* **tasks:** commented bug-wave-probe-file-check-model-dependent ([577efeb](https://github.com/Arggon/ArggonManager/commit/577efeb66862a5c57044b9afec545b3a6dfccd69))
* **tasks:** commented bug-x-tracker-option-list-has-no-doc-drift-guard ([323fc40](https://github.com/Arggon/ArggonManager/commit/323fc40b72854677463792aaf332ecd7cd538e5f))
* **tasks:** commented bug-zero-byte-item-files-committed-by-comment-autocommit ([0c1fe3c](https://github.com/Arggon/ArggonManager/commit/0c1fe3cb77f92b96a3e7f44de18df96aeb8b3878))
* **tasks:** commented bug-zero-byte-item-files-committed-by-comment-autocommit ([40f4da0](https://github.com/Arggon/ArggonManager/commit/40f4da00135c1276e03724b15a3d640e51182d57))
* **tasks:** commented bug-zero-byte-item-files-committed-by-comment-autocommit ([a979875](https://github.com/Arggon/ArggonManager/commit/a979875dceba970a1c37d53852111ad61d9ac5d7))
* **tasks:** commented story-ci-wall-clock ([1b1771d](https://github.com/Arggon/ArggonManager/commit/1b1771d88ebe7feb0c48ee72672504fbc1fc2a89))
* **tasks:** commented task-adapter-orphan-reaping ([cb09353](https://github.com/Arggon/ArggonManager/commit/cb093531f7aca3dd8e3e26cc7a80a67eeaa88108))
* **tasks:** commented task-adapter-orphan-reaping ([c863758](https://github.com/Arggon/ArggonManager/commit/c8637586ba9a7246df2d14843b802bfceed92012))
* **tasks:** commented task-adapter-orphan-reaping ([fe06ed4](https://github.com/Arggon/ArggonManager/commit/fe06ed44cd721f20bf3d90ecd3ec37ad1360c947))
* **tasks:** commented task-adapter-orphan-reaping ([1b4f96f](https://github.com/Arggon/ArggonManager/commit/1b4f96fb4b3daf3f8025b375fd7ec8e75bff1ff1))
* **tasks:** commented task-adapter-orphan-reaping ([16eb1e7](https://github.com/Arggon/ArggonManager/commit/16eb1e73ed851a614f34aa801d953f19faa1c71f))
* **tasks:** commented task-adapter-orphan-reaping ([29c8793](https://github.com/Arggon/ArggonManager/commit/29c879304cb15608cca03e8494a5bf2137385b50))
* **tasks:** commented task-adapter-orphan-reaping ([1ddcb58](https://github.com/Arggon/ArggonManager/commit/1ddcb586e730c409f783c0318bb163b8abaef0f5))
* **tasks:** commented task-adapter-orphan-reaping ([126c9b1](https://github.com/Arggon/ArggonManager/commit/126c9b19dfadf6a1f82540da91b4df46bfe74e3b))
* **tasks:** commented task-adapter-orphan-reaping ([2e63a68](https://github.com/Arggon/ArggonManager/commit/2e63a688a4fd08291935f36632fe28172403f2f7))
* **tasks:** commented task-adopt-compaction-three-questions ([0a933e3](https://github.com/Arggon/ArggonManager/commit/0a933e334be5c7be294228f294d360829624fa64))
* **tasks:** commented task-adr-0021-role-model-amendment ([d149669](https://github.com/Arggon/ArggonManager/commit/d14966978701aa1611d13134e7b40dbfd4bb524d))
* **tasks:** commented task-adr-0021-role-model-amendment ([13978e9](https://github.com/Arggon/ArggonManager/commit/13978e94d04537f8d646fd2446c4d21083df6818))
* **tasks:** commented task-adr-0021-status-accepted ([0e4525b](https://github.com/Arggon/ArggonManager/commit/0e4525bec2b11eb1980443978660e7895700a97d))
* **tasks:** commented task-adr-0021-supersede-6-2a ([23f2547](https://github.com/Arggon/ArggonManager/commit/23f2547ddfacbda122c45a56dea1560387a00c1d))
* **tasks:** commented task-adr-0021-supersede-6-2a ([a155944](https://github.com/Arggon/ArggonManager/commit/a155944bb76b3045590f05c95ecd76c503375314))
* **tasks:** commented task-adr-0026-owner-decision-brief ([8d88dcf](https://github.com/Arggon/ArggonManager/commit/8d88dcff61834dd1a0d50f699da867185fe54530))
* **tasks:** commented task-adr-0026-owner-decision-brief ([c7d9d18](https://github.com/Arggon/ArggonManager/commit/c7d9d18cad0b81087809e70df1f11af83051a2c6))
* **tasks:** commented task-adr-0026-owner-decision-brief ([5c341e0](https://github.com/Arggon/ArggonManager/commit/5c341e0f73626f2f2e72c3459d6e43656a30b5b1))
* **tasks:** commented task-adr-0026-owner-decision-brief ([89e196c](https://github.com/Arggon/ArggonManager/commit/89e196c9dd072b97e540eee14b497a4f794bfd66))
* **tasks:** commented task-adr-0026-owner-decision-brief ([982dec3](https://github.com/Arggon/ArggonManager/commit/982dec36ab351b25a25854d790e9898ba58587a9))
* **tasks:** commented task-adr-0026-owner-decision-brief ([4894b82](https://github.com/Arggon/ArggonManager/commit/4894b82ff5c7199ebaac4bbc797f71b0eb0522f3))
* **tasks:** commented task-adr-0026-owner-decision-brief ([9cfe5d7](https://github.com/Arggon/ArggonManager/commit/9cfe5d7bf830f7b2ff25ca54f428fb9de6a633d5))
* **tasks:** commented task-adr-0026-owner-decision-brief ([72d7ffc](https://github.com/Arggon/ArggonManager/commit/72d7ffc8d50cc0c67db01a760b6eb9e117e53de3))
* **tasks:** commented task-adr-0026-owner-decision-brief ([3a13cfb](https://github.com/Arggon/ArggonManager/commit/3a13cfb7001b70d1bcffdbdb095bf5bb6fc1b96a))
* **tasks:** commented task-adr-index-parity-does-not-check-titles ([9ec3a6c](https://github.com/Arggon/ArggonManager/commit/9ec3a6c382450bdad8fd0047e312be6e3f673398))
* **tasks:** commented task-adr-index-parity-status-classes-line-ref-stale ([e2ba8a3](https://github.com/Arggon/ArggonManager/commit/e2ba8a3ec54fdf206963e4689d78677c104b2fb1))
* **tasks:** commented task-adr-index-title-rule-unwritten-in-engineering-md ([cc8cf29](https://github.com/Arggon/ArggonManager/commit/cc8cf2934e1f6020ee5a322dbdb0026ab85afc4a))
* **tasks:** commented task-agent-identity-claim-discipline ([2bdaab6](https://github.com/Arggon/ArggonManager/commit/2bdaab6908081bd92992eb0e1a46a9502095b012))
* **tasks:** commented task-agent-identity-claim-discipline ([80c7e03](https://github.com/Arggon/ArggonManager/commit/80c7e038e7822d5be3da0e37597ef533e0de9283))
* **tasks:** commented task-agent-role-contracts-seam ([18f8bca](https://github.com/Arggon/ArggonManager/commit/18f8bca853bbfab915c4f72bbcb47fc10d016070))
* **tasks:** commented task-agent-role-contracts-seam ([231d47f](https://github.com/Arggon/ArggonManager/commit/231d47f324b6184a9416fe83752ab3e69f86f79f))
* **tasks:** commented task-agent-role-contracts-seam ([5748901](https://github.com/Arggon/ArggonManager/commit/57489016326da6bd969128c6e1a5310f486e4e46))
* **tasks:** commented task-agent-role-contracts-seam ([560ef6e](https://github.com/Arggon/ArggonManager/commit/560ef6eda9e11e05d812fafe8c895ece25f429bb))
* **tasks:** commented task-agent-role-contracts-seam ([00ce81f](https://github.com/Arggon/ArggonManager/commit/00ce81fcf7ae5330dc318f9e680821336d142f28))
* **tasks:** commented task-agent-role-contracts-seam ([568918c](https://github.com/Arggon/ArggonManager/commit/568918ce53c01ec6699afb42cba6c9be9c199b8c))
* **tasks:** commented task-cascade-whole-body-acceptance-defers-this-defect ([8a3c5b6](https://github.com/Arggon/ArggonManager/commit/8a3c5b6457ed96af7cc4463f3019d7e12ba16e6e))
* **tasks:** commented task-ci-concurrency-cancel ([3286e8e](https://github.com/Arggon/ArggonManager/commit/3286e8e8c14aec073f7ff5b83ccd9f2addabe7ff))
* **tasks:** commented task-ci-shard-wall-measure ([9832a3d](https://github.com/Arggon/ArggonManager/commit/9832a3d354f462564da9c4485dea38cea93248c0))
* **tasks:** commented task-cli-start-remediation-tail-clipped-on-human-channel ([154078c](https://github.com/Arggon/ArggonManager/commit/154078cff94580a02953d689eb4fdb48fc39fec3))
* **tasks:** commented task-create-needs-a-body-flag-to-author-a-live-contract ([9c56342](https://github.com/Arggon/ArggonManager/commit/9c563420f8be36fc682460b36327c4bf7ba9bd76))
* **tasks:** commented task-dated-correction-not-self-verifying ([c7b46f4](https://github.com/Arggon/ArggonManager/commit/c7b46f4ec7bfcf88965efc9c1e73c7d18a94e376))
* **tasks:** commented task-decide-adr-0021-index-title-editorial-vs-verbatim ([26d9cf6](https://github.com/Arggon/ArggonManager/commit/26d9cf685e3c551313195d830c32ebfe33d21dee))
* **tasks:** commented task-explore-adopter-feedback-channel ([76a0254](https://github.com/Arggon/ArggonManager/commit/76a0254158db4a5d3a024d49cd677a1f11173344))
* **tasks:** commented task-explore-adopter-feedback-channel ([44303c7](https://github.com/Arggon/ArggonManager/commit/44303c7ba69a638c9a9bdc797adcdb3f0d3c8e80))
* **tasks:** commented task-explore-adopter-feedback-channel ([8c4964d](https://github.com/Arggon/ArggonManager/commit/8c4964d19e8cb37d35c086fab6669b8fe191c44f))
* **tasks:** commented task-explore-agent-primary-role-model ([88b52d9](https://github.com/Arggon/ArggonManager/commit/88b52d9a8fa389f65e218033e0679a104b2337fa))
* **tasks:** commented task-explore-agent-primary-role-model ([c233e32](https://github.com/Arggon/ArggonManager/commit/c233e32b04382f6bdb9d65beda33401925ceabef))
* **tasks:** commented task-explore-agent-primary-role-model ([e46afc8](https://github.com/Arggon/ArggonManager/commit/e46afc856a4be2d6b8a57457de8bf43837689dfd))
* **tasks:** commented task-explore-autoharness-autocontext-autocompact ([19e015e](https://github.com/Arggon/ArggonManager/commit/19e015ec458c8e22e6329e6be7850650456a37ae))
* **tasks:** commented task-explore-autoharness-autocontext-autocompact ([f258b17](https://github.com/Arggon/ArggonManager/commit/f258b170723d7ffb5fbd3756b1a303ca323a0299))
* **tasks:** commented task-explore-harness-research-transfer ([71a5300](https://github.com/Arggon/ArggonManager/commit/71a5300e305ab92303f970d1115a47947f9e3395))
* **tasks:** commented task-explore-harness-research-transfer ([4cb16a6](https://github.com/Arggon/ArggonManager/commit/4cb16a67efaca805b81e1f92d72b39a989bf5442))
* **tasks:** commented task-friction-capture-command ([1417842](https://github.com/Arggon/ArggonManager/commit/14178425dea0ca3e367e6849b86a00524dd8e772))
* **tasks:** commented task-implement-decision-brief-kernel ([1316dbd](https://github.com/Arggon/ArggonManager/commit/1316dbdee982652b512abe95e7eb20560ace9e3d))
* **tasks:** commented task-implement-decision-brief-kernel ([e206e7a](https://github.com/Arggon/ArggonManager/commit/e206e7a96959fcce89155b65e9331883dbca3864))
* **tasks:** commented task-implement-decision-brief-kernel ([8980520](https://github.com/Arggon/ArggonManager/commit/898052086596d34a8992e6f08d9e7c21d54ef273))
* **tasks:** commented task-implement-decision-brief-kernel ([67bfb8e](https://github.com/Arggon/ArggonManager/commit/67bfb8eb3b73c324c894ea1e20752b597ac1bb22))
* **tasks:** commented task-measure-kernel-refusal-rate ([43c06e7](https://github.com/Arggon/ArggonManager/commit/43c06e7ee74d20ae688e8504c493e2db28b724cc))
* **tasks:** commented task-migrate-7-leaves-with-no-live-acceptance-contract ([da2326b](https://github.com/Arggon/ArggonManager/commit/da2326b2690cbf639e908f432900b34bdf53e1ad))
* **tasks:** commented task-probe-seam-body-shape ([a38ae1f](https://github.com/Arggon/ArggonManager/commit/a38ae1fb731baf0ab62c94d060fa37c72a1e6d52))
* **tasks:** commented task-release-pipeline-baseline-new-collisions ([623ad67](https://github.com/Arggon/ArggonManager/commit/623ad6724eeb29535d6a67a2e58c711617cdb2a1))
* **tasks:** commented task-role-model-report-only-detector ([740b39c](https://github.com/Arggon/ArggonManager/commit/740b39c6ffa16326c3c8f9bb0ee1ff9c1d0010c4))
* **tasks:** commented task-role-model-report-only-detector ([81b1c4c](https://github.com/Arggon/ArggonManager/commit/81b1c4caad3bb06cf762231666b8ebe793759335))
* **tasks:** commented task-role-model-report-only-detector ([07d721d](https://github.com/Arggon/ArggonManager/commit/07d721d04c615c8bc2e8511eaad8b8f658cdb9e1))
* **tasks:** commented task-role-model-report-only-detector ([e90fc52](https://github.com/Arggon/ArggonManager/commit/e90fc52f3450c5517f6b26965d019eefb58965fb))
* **tasks:** commented task-role-model-report-only-detector ([4526d69](https://github.com/Arggon/ArggonManager/commit/4526d6933c5cfac5e1f644fd06d4ed493ca30b46))
* **tasks:** commented task-role-model-report-only-detector ([91830e4](https://github.com/Arggon/ArggonManager/commit/91830e4106620668741bf082e5ace043bc9ba482))
* **tasks:** commented task-role-model-report-only-detector ([009ea94](https://github.com/Arggon/ArggonManager/commit/009ea945428be3a7a8fc21a511381f0ef1232a35))
* **tasks:** commented task-spec-agent-rename-migration ([8782225](https://github.com/Arggon/ArggonManager/commit/878222567f44347e68b4d4f8144c017b58264a0c))
* **tasks:** commented task-spec-agent-rename-migration ([cfc3088](https://github.com/Arggon/ArggonManager/commit/cfc3088c060c661ec46f98a800713e5a46d75e36))
* **tasks:** commented task-spec-agent-role-contracts ([a07b8f0](https://github.com/Arggon/ArggonManager/commit/a07b8f000164a66f3db4d6435cf39a3dbf1febcd))
* **tasks:** commented task-spec-agent-role-contracts ([5ae0238](https://github.com/Arggon/ArggonManager/commit/5ae02380d0463d5d4b6504dd8acc56d62775671d))
* **tasks:** commented task-spec-owner-decision-brief ([d8fff61](https://github.com/Arggon/ArggonManager/commit/d8fff61dceb77ac32df769b9b1a81c0b3b23fad6))
* **tasks:** commented task-spec-owner-decision-brief ([fce1cab](https://github.com/Arggon/ArggonManager/commit/fce1cab2f9eb7cff016b4accead85868e6af978d))
* **tasks:** commented task-spec-owner-decision-brief ([70adba8](https://github.com/Arggon/ArggonManager/commit/70adba8495e4c7d5dbbf2d1cc0cf22a10f51527d))
* **tasks:** commented task-spec-owner-decision-brief ([7359294](https://github.com/Arggon/ArggonManager/commit/7359294338645204048a420018be1f0c4a35ec84))
* **tasks:** commented task-spec-owner-decision-brief ([4428d24](https://github.com/Arggon/ArggonManager/commit/4428d245bfccd019004d6d49253c5368588d692f))
* **tasks:** commented task-spec-owner-decision-brief ([e950b68](https://github.com/Arggon/ArggonManager/commit/e950b6868f7f47fc7958b5569e3da811611416b7))
* **tasks:** commented task-spec-promotion-policy-and-acceptance ([f51d444](https://github.com/Arggon/ArggonManager/commit/f51d44485912de9ac5f32a425765574c6de5e9a4))
* **tasks:** commented task-spec-promotion-policy-and-acceptance ([ec54861](https://github.com/Arggon/ArggonManager/commit/ec54861f9396e8eb4db732da70865f8a8af114c6))
* **tasks:** commented task-spike-cross-run-lesson-store ([3251d0d](https://github.com/Arggon/ArggonManager/commit/3251d0d402709aa1791ab4dd9011736d73d50c9d))
* **tasks:** commented task-state-exploration-stopping-rule ([38c193a](https://github.com/Arggon/ArggonManager/commit/38c193ae6a86590e2c036718960dd56dea8cdcaf))
* **tasks:** commented task-state-exploration-stopping-rule ([66b04f2](https://github.com/Arggon/ArggonManager/commit/66b04f262e9386c1a8343c6bdf099ffa502bce21))
* **tasks:** commented task-validate-missing-frontmatter-command-surface-assertions ([7d500d4](https://github.com/Arggon/ArggonManager/commit/7d500d4af6af13955cf2381130aa44e6f05fe424))
* **tasks:** commented task-wire-decision-brief-carriers ([40af209](https://github.com/Arggon/ArggonManager/commit/40af209d1ad79268b32158dcaa299fa6fb36ed9b))
* **tasks:** commented task-wire-decision-brief-carriers ([d80ec93](https://github.com/Arggon/ArggonManager/commit/d80ec93cf4d4b263dbedff0067c4ff9780886568))
* **tasks:** commented task-wire-decision-brief-carriers ([f545c65](https://github.com/Arggon/ArggonManager/commit/f545c65519ec0cd4e384fb3ef3462aa89fe8086a))
* **tasks:** commented task-wire-role-model-carriers ([95f8534](https://github.com/Arggon/ArggonManager/commit/95f8534b00e68d2d1c70c1150b980ffd883b6f44))
* **tasks:** commented task-wire-role-model-carriers ([f1b89db](https://github.com/Arggon/ArggonManager/commit/f1b89db13a524d4b5013389472b4860feeacd6a9))
* **tasks:** commented task-wire-role-model-carriers ([03b1cd0](https://github.com/Arggon/ArggonManager/commit/03b1cd03ad157eb98a7bafbd0e486dc0c3cc8dc4))
* **tasks:** commented task-wire-role-model-carriers ([95aff6b](https://github.com/Arggon/ArggonManager/commit/95aff6b84124cb51cb2f3a61f3e961d912e3afef))
* **tasks:** commented task-zcode-goal-mode ([f00b257](https://github.com/Arggon/ArggonManager/commit/f00b257c66e02ad65b06ee00b5119741a966dc20))
* **tasks:** commented task-zcode-goal-mode ([5c826d7](https://github.com/Arggon/ArggonManager/commit/5c826d78f62f3e7a6925840abd7d0684d49abbe3))
* **tasks:** commented task-zcode-goal-mode ([4d4d360](https://github.com/Arggon/ArggonManager/commit/4d4d3601ef163eb852cfa6ee2bdad61d57cbc7b5))
* **tasks:** commented task-zcode-goal-mode ([0a58762](https://github.com/Arggon/ArggonManager/commit/0a58762c56fe426bb0bfc56ef50e9cc6316485fe))
* **tasks:** commented task-zcode-goal-mode ([7e475da](https://github.com/Arggon/ArggonManager/commit/7e475dabe897044a8c7c5be053b9d5a500671d71))
* **tasks:** commented task-zcode-goal-mode ([2c3716c](https://github.com/Arggon/ArggonManager/commit/2c3716c3c15152b3559375f8e08cde0ffa23be0a))
* **tasks:** commented task-zcode-goal-mode ([53ce55d](https://github.com/Arggon/ArggonManager/commit/53ce55d4295b35e4a8aa53720ee500e01dbae12c))
* **tasks:** commented task-zcode-goal-mode ([7f358df](https://github.com/Arggon/ArggonManager/commit/7f358df4e950a29425a50c301df6f271fba4cab1))
* **tasks:** commented task-zcode-goal-mode ([7cf2c62](https://github.com/Arggon/ArggonManager/commit/7cf2c62f575916d9a16fda4543c18f3bcd21fa52))
* **tasks:** commented task-zcode-goal-mode ([826d0fc](https://github.com/Arggon/ArggonManager/commit/826d0fcad3cca315d7cc0ab3e42d560d11600378))
* **tasks:** correct the writer claim and record the npm-10 evidence ([e5bc593](https://github.com/Arggon/ArggonManager/commit/e5bc593a6f0980d75f28c1bc9eddc33593a30bca))
* **tasks:** created agent-role-model ([4112157](https://github.com/Arggon/ArggonManager/commit/4112157300ee4d9cb4e581ade3a743773f2ba2e3))
* **tasks:** created bug-adopter-engineering-template-software-locked ([c503a0d](https://github.com/Arggon/ArggonManager/commit/c503a0dc831c22be1355dd0552ad0fd4b072b186))
* **tasks:** created bug-adr-0021-s5-lists-retired-agent-ids ([ff33bbd](https://github.com/Arggon/ArggonManager/commit/ff33bbdc95a9bee29f124d5c084ce19b604ed883))
* **tasks:** created bug-adr-0023-ships-unindexed-blocks-every-pr ([6d2c822](https://github.com/Arggon/ArggonManager/commit/6d2c822da7427d0c740f5cf561fad8c6c51883e4))
* **tasks:** created bug-adr-status-drift-merged-adr-proposed ([15f6166](https://github.com/Arggon/ArggonManager/commit/15f6166754ecc68d4cf11717342a305ea7c934bc))
* **tasks:** created bug-autorelease-label-lifecycle-unowned ([effd711](https://github.com/Arggon/ArggonManager/commit/effd711d1ea625b8f6e366beded93cb50f307e95))
* **tasks:** created bug-bundle-update-tool-drops-waive-and-force ([9f5bf4a](https://github.com/Arggon/ArggonManager/commit/9f5bf4ab019abf0e68d31cfe2b3884e42d0f1d41))
* **tasks:** created bug-claim-pool-computed-from-main-misses-branch-claims ([e605cbf](https://github.com/Arggon/ArggonManager/commit/e605cbf828c9a7840885ea700ba265fb8bf5f422))
* **tasks:** created bug-docs-ts-stale-example-path ([40b4d60](https://github.com/Arggon/ArggonManager/commit/40b4d600ae1bb23907a4e8632b285512e3fb7b29))
* **tasks:** created bug-done-gate-counts-checkboxes-inside-comment-blocks ([43b5984](https://github.com/Arggon/ArggonManager/commit/43b59842ff9ff2e7e05adf0689a5c95a1312924e))
* **tasks:** created bug-goal-mode-refusal-tests-not-hermetic ([8d74372](https://github.com/Arggon/ArggonManager/commit/8d7437208d0bc394f56f5966c63900d431624b13))
* **tasks:** created bug-headless-ci-twin-init-nondeterministic ([77929fe](https://github.com/Arggon/ArggonManager/commit/77929fe9bddd7819bc05e6ddd271168ba4d07d41))
* **tasks:** created bug-init-force-drops-x-tracker-block ([a8afbbe](https://github.com/Arggon/ArggonManager/commit/a8afbbedb62cf601fa26eac3f00522f2b3d03b23))
* **tasks:** created bug-native-guard-silent-without-worktree-declaration ([bda3fcd](https://github.com/Arggon/ArggonManager/commit/bda3fcded91bbc4ab7299865a70ffe3cf2b94d68))
* **tasks:** created bug-native-seam-bundle-diverges-from-live-kernel ([99499fb](https://github.com/Arggon/ArggonManager/commit/99499fb3f148655730444557c4f8b38b480c494c))
* **tasks:** created bug-native-start-cold-ci-skips-move-leg ([0ab90a2](https://github.com/Arggon/ArggonManager/commit/0ab90a24a69d3ecd9ba193125082fc538314fa75))
* **tasks:** created bug-no-gate-warns-on-paired-impl-and-test-deletion ([b04b787](https://github.com/Arggon/ArggonManager/commit/b04b787eab5d74e6f5015c08e58a1227b652085b))
* **tasks:** created bug-parity-invariant-restated-outside-carriers ([e4764c9](https://github.com/Arggon/ArggonManager/commit/e4764c98aeef3c2c14a80628f6903f4db03820c2))
* **tasks:** created bug-prose-format-codespan-test-times-out-under-full-suite ([4ac87df](https://github.com/Arggon/ArggonManager/commit/4ac87df6dd40752be38a35a3f7b42682e3818e6f))
* **tasks:** created bug-release-config-workflow-agreement-ungated ([66ae95d](https://github.com/Arggon/ArggonManager/commit/66ae95d0721f17f0ccb0cd65683d055f5b154d16))
* **tasks:** created bug-seam-bundle-stale-snapshot-gate ([3c2b1dc](https://github.com/Arggon/ArggonManager/commit/3c2b1dc6d3824a9c99a4bd8e0350feb19d2c7e07))
* **tasks:** created bug-self-decided-false-positive-owner-assigned ([b4a44db](https://github.com/Arggon/ArggonManager/commit/b4a44db5b7772c54b2cdcac919d6a2e33014c139))
* **tasks:** created bug-skill-exploration-reference-fails-prettier ([c16b858](https://github.com/Arggon/ArggonManager/commit/c16b858ad627afd794a8956b92ad0e99fca466c7))
* **tasks:** created bug-smoke-harness-env-hermeticity-worktree-keys ([18c0d49](https://github.com/Arggon/ArggonManager/commit/18c0d4904983836d07a71100939214b5597b8eb0))
* **tasks:** created bug-test-suite-lib-dist-rebuild-race ([66eea42](https://github.com/Arggon/ArggonManager/commit/66eea424d9cce5ba73a5b7d7fc82a19f84af75a0))
* **tasks:** created bug-verification-regex-matching-nothing ([1255dd3](https://github.com/Arggon/ArggonManager/commit/1255dd352bb7a44495b9bafc470a355d95001768))
* **tasks:** created bug-wave-probe-file-check-model-dependent ([dc1c982](https://github.com/Arggon/ArggonManager/commit/dc1c982336c3f408301561e5c7c34dabc46edcb9))
* **tasks:** created bug-x-tracker-option-list-has-no-doc-drift-guard ([16c9519](https://github.com/Arggon/ArggonManager/commit/16c9519a688ec035925c832db4e2973cab3dfc64))
* **tasks:** created bug-zero-byte-item-files-committed-by-comment-autocommit ([e15156f](https://github.com/Arggon/ArggonManager/commit/e15156fd530402651c5e04bf703f464a0acfc14e))
* **tasks:** created external-agent-tooling ([84b7562](https://github.com/Arggon/ArggonManager/commit/84b7562be2c755af50f61e13d2e57de45d41c19e))
* **tasks:** created external-harness-evaluation ([708430c](https://github.com/Arggon/ArggonManager/commit/708430c27bdb642c2d9bf2e4cc7dc5b2a9c142de))
* **tasks:** created harness-research-transfer ([1a14c8c](https://github.com/Arggon/ArggonManager/commit/1a14c8c4846f90c09a58259a6fb4aa14ce2b8de3))
* **tasks:** created role-model-foundation ([56a5e2e](https://github.com/Arggon/ArggonManager/commit/56a5e2e9bb23dba0f4122efc762e9dce3aef4d31))
* **tasks:** created story-ci-wall-clock ([72e4776](https://github.com/Arggon/ArggonManager/commit/72e4776e1054849cf612d416c142beacadcb3e68))
* **tasks:** created task-adapter-orphan-reaping ([9f40b31](https://github.com/Arggon/ArggonManager/commit/9f40b3174b66705ca695e47fc3f1c61c452d117d))
* **tasks:** created task-adopt-compaction-three-questions ([e97c7d9](https://github.com/Arggon/ArggonManager/commit/e97c7d9588397ea72ff66a206912a7c594ef12d1))
* **tasks:** created task-adr-0021-role-model-amendment ([7887dc6](https://github.com/Arggon/ArggonManager/commit/7887dc6a49b71dfbabb84a342a1d98a0ab634999))
* **tasks:** created task-adr-0021-status-accepted ([77399d6](https://github.com/Arggon/ArggonManager/commit/77399d68de896a1cf5dc01b32a2d2a23a8164c55))
* **tasks:** created task-adr-0021-supersede-6-2a ([feee4d2](https://github.com/Arggon/ArggonManager/commit/feee4d2791326f3f10597eb197103ba65a385514))
* **tasks:** created task-adr-0026-owner-decision-brief ([3330d56](https://github.com/Arggon/ArggonManager/commit/3330d5649e07bb7f4e4a8b5f5e78ec31c90f0a74))
* **tasks:** created task-adr-index-parity-status-classes-line-ref-stale ([45d5ae8](https://github.com/Arggon/ArggonManager/commit/45d5ae8d64d38363210668bba0468ee8bd8d0fa5))
* **tasks:** created task-adr-index-title-rule-unwritten-in-engineering-md ([5434a02](https://github.com/Arggon/ArggonManager/commit/5434a020cb8eb55d4f16fea9f0432de30b204d5b))
* **tasks:** created task-adr-local-validation-pipeline ([d466b8b](https://github.com/Arggon/ArggonManager/commit/d466b8b249139b19283c864cf7be38151308a09c))
* **tasks:** created task-agent-identity-claim-discipline ([53b3853](https://github.com/Arggon/ArggonManager/commit/53b3853bf0ea2219038c169d15c3ee1443d774c4))
* **tasks:** created task-agent-role-contracts-seam ([d75039b](https://github.com/Arggon/ArggonManager/commit/d75039b287fde828c8ce19ae67e95313fd12c0b8))
* **tasks:** created task-cascade-whole-body-acceptance-defers-this-defect ([01ccb6b](https://github.com/Arggon/ArggonManager/commit/01ccb6b781eab0db16d9b849ed5740e123a3e2c6))
* **tasks:** created task-ci-concurrency-cancel ([42d9d4d](https://github.com/Arggon/ArggonManager/commit/42d9d4d0ed05f92289b8f9288a97e818bcf9fd27))
* **tasks:** created task-ci-shard-wall-measure ([e632fa8](https://github.com/Arggon/ArggonManager/commit/e632fa82a3efd3bd1bdd7956dc276e6b609065bc))
* **tasks:** created task-create-needs-a-body-flag-to-author-a-live-contract ([3a003ee](https://github.com/Arggon/ArggonManager/commit/3a003eea349fd0f0e3234ec4d5a34ba9f50e4a8a))
* **tasks:** created task-dated-correction-not-self-verifying ([c0b929d](https://github.com/Arggon/ArggonManager/commit/c0b929da8430841954644533db54599e32b0549d))
* **tasks:** created task-decide-adr-0021-index-title-editorial-vs-verbatim ([4439af6](https://github.com/Arggon/ArggonManager/commit/4439af61906b2f5c4bc22e15497e3b9d571c4791))
* **tasks:** created task-explore-agent-primary-role-model ([c959a9c](https://github.com/Arggon/ArggonManager/commit/c959a9c3e7542c87e8edf0a492931074fbbd6b32))
* **tasks:** created task-explore-autoharness-autocontext-autocompact ([5af8436](https://github.com/Arggon/ArggonManager/commit/5af843687dbe98df5f64f059070abd1068cfd936))
* **tasks:** created task-explore-harness-research-transfer ([b05f1a6](https://github.com/Arggon/ArggonManager/commit/b05f1a6d823caf0bf1d7542cf9d805a2ea37986b))
* **tasks:** created task-implement-decision-brief-kernel ([9df5143](https://github.com/Arggon/ArggonManager/commit/9df5143ad3f1b9114fd3e8792d1bc0ae5e3c2313))
* **tasks:** created task-measure-kernel-refusal-rate ([a8dce50](https://github.com/Arggon/ArggonManager/commit/a8dce5037f1ac2f47da52908f7a5d847340dad16))
* **tasks:** created task-migrate-7-leaves-with-no-live-acceptance-contract ([e0c7e78](https://github.com/Arggon/ArggonManager/commit/e0c7e7806dfc6069ff520defcadce195175708a5))
* **tasks:** created task-probe-native-seam-gate ([3c8412b](https://github.com/Arggon/ArggonManager/commit/3c8412bc5709bbac4f0a0c2d41659599f3bc1d51))
* **tasks:** created task-probe-seam-body-shape ([e1073f5](https://github.com/Arggon/ArggonManager/commit/e1073f5817c44bffa51e197814a8fe5d7bc4e104))
* **tasks:** created task-role-model-report-only-detector ([db68a9a](https://github.com/Arggon/ArggonManager/commit/db68a9ab898d2e772541b801f6c258f8dda658c8))
* **tasks:** created task-spec-agent-rename-migration ([261ec27](https://github.com/Arggon/ArggonManager/commit/261ec279e53b4cdaed284f0032ca19d79453fbbb))
* **tasks:** created task-spec-agent-role-contracts ([d503b33](https://github.com/Arggon/ArggonManager/commit/d503b33c488128a91d6b92fb4ae6b15fbcfa17eb))
* **tasks:** created task-spec-local-validation-pipeline ([9c9dae8](https://github.com/Arggon/ArggonManager/commit/9c9dae826e6101e25e724113ba439024b44268fc))
* **tasks:** created task-spec-owner-decision-brief ([8e6f8a6](https://github.com/Arggon/ArggonManager/commit/8e6f8a6c1173f200602087cd6435319424ae0490))
* **tasks:** created task-spec-promotion-policy-and-acceptance ([649b8db](https://github.com/Arggon/ArggonManager/commit/649b8db4a805322bb9b1d5d1cc25d17441866e76))
* **tasks:** created task-spike-cross-run-lesson-store ([fa8aa2e](https://github.com/Arggon/ArggonManager/commit/fa8aa2e032c039deaed81c0abf4479ede6ae5a0e))
* **tasks:** created task-state-exploration-stopping-rule ([96368e4](https://github.com/Arggon/ArggonManager/commit/96368e494336d6c81fa3bd91f4fa6df0ae739084))
* **tasks:** created task-validate-missing-frontmatter-command-surface-assertions ([ba65c64](https://github.com/Arggon/ArggonManager/commit/ba65c64e0853f8638aa19e0e99049e2e5ad6735b))
* **tasks:** created task-wire-decision-brief-carriers ([aed00e5](https://github.com/Arggon/ArggonManager/commit/aed00e5f5b30befe4b764faff036a88385c0403b))
* **tasks:** created task-wire-role-model-carriers ([46e7998](https://github.com/Arggon/ArggonManager/commit/46e79984b28e854588929cdfdc90329572b89079))
* **tasks:** demote the duplicated '## Acceptance' in task-adr-0026's lead comment ([d2b0059](https://github.com/Arggon/ArggonManager/commit/d2b0059c9be9b2048378e939071d1cf426558abc))
* **tasks:** done bug-adr-0021-s5-lists-retired-agent-ids ([2201114](https://github.com/Arggon/ArggonManager/commit/2201114f663f4f42fe5dc5d4bc50419fce2070b5))
* **tasks:** done bug-adr-0023-ships-unindexed-blocks-every-pr ([f4aab1d](https://github.com/Arggon/ArggonManager/commit/f4aab1d3a8c368e7ebfd33b9f8edecf6c225aa1a))
* **tasks:** done bug-docs-ts-stale-example-path ([437881b](https://github.com/Arggon/ArggonManager/commit/437881bbe795106e76e16d751f2d95cb164914d1))
* **tasks:** done bug-done-gate-counts-checkboxes-inside-comment-blocks ([4a25fe2](https://github.com/Arggon/ArggonManager/commit/4a25fe216bee55d6abf72d4b9e81de940a8520df))
* **tasks:** done bug-mcp-parity-branch-test-json-parse-of-human-stdout ([0df211e](https://github.com/Arggon/ArggonManager/commit/0df211e79b06bc03fb1d321d6b72736c73ad8c06))
* **tasks:** done bug-native-arggon-tools-resolve-tracker-root-to-session-cwd ([a74131d](https://github.com/Arggon/ArggonManager/commit/a74131d497897d22a3ef9f2d1127fb43564d43b2))
* **tasks:** done bug-parity-invariant-restated-outside-carriers ([4dcb54b](https://github.com/Arggon/ArggonManager/commit/4dcb54beb6d8dc452acb358ea309f8729d935750))
* **tasks:** done bug-test-suite-lib-dist-rebuild-race ([119def0](https://github.com/Arggon/ArggonManager/commit/119def057687df9781b8e81c2d4147617af8b234))
* **tasks:** done task-adapter-orphan-reaping ([5351d85](https://github.com/Arggon/ArggonManager/commit/5351d85af35b616eb9fb351662c8c61af876931e))
* **tasks:** done task-adr-0026-owner-decision-brief ([c1f289c](https://github.com/Arggon/ArggonManager/commit/c1f289c860fabe6e4f1ba4dc636b430118d71c16))
* **tasks:** done task-agent-identity-claim-discipline ([f2f5c56](https://github.com/Arggon/ArggonManager/commit/f2f5c5650fbcd2352a4f943095e3d8848c3e9afa))
* **tasks:** done task-agent-role-contracts-seam ([519d00e](https://github.com/Arggon/ArggonManager/commit/519d00e53d365fdc1a87a98832efe380f7912ee0))
* **tasks:** done task-cli-start-remediation-tail-clipped-on-human-channel ([b63d522](https://github.com/Arggon/ArggonManager/commit/b63d522aa72507c96a04a5bdf53e96ff9f71340a))
* **tasks:** done task-probe-native-seam-gate ([bf6b2d6](https://github.com/Arggon/ArggonManager/commit/bf6b2d6d8e122bfe143739a2713e9038a05f8440))
* **tasks:** done task-role-model-report-only-detector ([99e7048](https://github.com/Arggon/ArggonManager/commit/99e7048ee0cbc585816cba24fd945bb1c3e81702))
* **tasks:** done task-spec-agent-role-contracts ([99c7c85](https://github.com/Arggon/ArggonManager/commit/99c7c85697a12c26bf3f94f6d9528a60b8603d78))
* **tasks:** done task-wire-decision-brief-carriers ([321a82c](https://github.com/Arggon/ArggonManager/commit/321a82c82eee5f7dfe94a7baea17107ce4f0a42e))
* **tasks:** done task-wire-role-model-carriers ([50552da](https://github.com/Arggon/ArggonManager/commit/50552dab24510b4ea813e7ba83b48346f919c459))
* **tasks:** done task-zcode-goal-mode ([cba058a](https://github.com/Arggon/ArggonManager/commit/cba058a6dd202baec2f078f40e9467dc128795cd))
* **tasks:** drop the stale worktree_path on bug-convention-md-links-nonexistent-adr-0015 ([37a0d6a](https://github.com/Arggon/ArggonManager/commit/37a0d6a3879250c0ada98979d4b9881c1329c269))
* **tasks:** file pre-existing main-red twin-init determinism failure found verifying PR [#612](https://github.com/Arggon/ArggonManager/issues/612) ([2fc8633](https://github.com/Arggon/ArggonManager/commit/2fc8633a0960e185716cb305961f8deb16705e01))
* **tasks:** file that the claimable pool is computed from main and misses branch-resident claims ([195f496](https://github.com/Arggon/ArggonManager/commit/195f496f7518975c5b3c57eef00103cd4931fdce))
* **tasks:** file the native-seam kernel-bundle divergence found verifying ADR 0026 ([b3941ea](https://github.com/Arggon/ArggonManager/commit/b3941eaa4376259f11fb0f6768e5ebcd5a61ac32))
* **tasks:** file the non-hermetic goal-mode refusal assertions found by CI on release PR [#664](https://github.com/Arggon/ArggonManager/issues/664) ([ebffc65](https://github.com/Arggon/ArggonManager/commit/ebffc658a57fc184cae8bb9fd64ee80015279021))
* **tasks:** file the two release-pipeline defects 0.6.0 exposed ([bb3c73b](https://github.com/Arggon/ArggonManager/commit/bb3c73bbe2274b8440859e657b02b8870ab6a9ce))
* **tasks:** file the two residual defects surfaced by the native tracker-root fix ([6a86c5f](https://github.com/Arggon/ArggonManager/commit/6a86c5fb8899ef5ce388649d4ed78a61657a37c8))
* **tasks:** fix the exploration link depth on task-spec-promotion-policy-and-acceptance ([089013e](https://github.com/Arggon/ArggonManager/commit/089013e211ad89945e82ebe26088fd6c1bae3f96))
* **tasks:** generated init docs (37 files) ([2fde284](https://github.com/Arggon/ArggonManager/commit/2fde28462beeccb1d3dfd48eeb1944e3e3c63483))
* **tasks:** probe item for the native done-gate ([c82bca8](https://github.com/Arggon/ArggonManager/commit/c82bca8c04053b937f4f4a79ec9b4ca4575014cd))
* **tasks:** pruned bug-adr-0021-s5-lists-retired-agent-ids, bug-docs-ts-stale-example-path, bug-test-suite-lib-dist-rebuild-race, task-zcode-goal-mode ([e6a683d](https://github.com/Arggon/ArggonManager/commit/e6a683d70e6a50e64282dd2486a2eac0abba17f6))
* **tasks:** pruned bug-done-gate-counts-checkboxes-inside-comment-blocks, bug-engineering-doc-stale-adr-statuses, bug-validate-does-not-check-frontmatter-present, task-adr-0026-owner-decision-brief, task-explore-adopter-feedback-channel, task-spec-owner-decision-brief ([c228494](https://github.com/Arggon/ArggonManager/commit/c2284942de354fad4a142420665909f67eddebd2))
* **tasks:** pruned bug-native-arggon-tools-resolve-tracker-root-to-session-cwd ([db405fa](https://github.com/Arggon/ArggonManager/commit/db405faad28da327e166c4aac539d296f300342b))
* **tasks:** pruned bug-parity-invariant-restated-outside-carriers, task-adr-0021-supersede-6-2a, task-agent-role-contracts-seam, task-explore-autoharness-autocontext-autocompact, task-role-model-report-only-detector, task-spec-agent-rename-migration, task-spec-promotion-policy-and-acceptance, task-wire-role-model-carriers ([185ced2](https://github.com/Arggon/ArggonManager/commit/185ced236e51f05a9bfaa39e18ae58ed0c8b04f7))
* **tasks:** pruned task-adr-0021-role-model-amendment ([46122f0](https://github.com/Arggon/ArggonManager/commit/46122f05fddf8ea8dcff45ef581ac47e8de4b62c))
* **tasks:** pruned task-adr-0021-status-accepted ([72429f6](https://github.com/Arggon/ArggonManager/commit/72429f60eff0fcf7ff81eb06bba6262f56ac47ee))
* **tasks:** pruned task-adr-index-parity-does-not-check-titles ([9099c46](https://github.com/Arggon/ArggonManager/commit/9099c464bdd3c083e4ee8f01f829af545966c21a))
* **tasks:** pruned task-cli-start-remediation-tail-clipped-on-human-channel ([803c695](https://github.com/Arggon/ArggonManager/commit/803c69578d628408735bf973a129505613abbf12))
* **tasks:** pruned task-derive-cli-spawn-loader, task-explore-agent-primary-role-model, task-record-exploration-016-worktree-runtime-isolation, task-remove-diag-listener ([f221423](https://github.com/Arggon/ArggonManager/commit/f22142340c4f05a41fed8326928bf40254d524ef))
* **tasks:** pruned task-explore-harness-research-transfer ([e5de6d7](https://github.com/Arggon/ArggonManager/commit/e5de6d7710b3ae4a636f0b8b685903156c749d85))
* **tasks:** pruned task-implement-decision-brief-kernel, task-wire-decision-brief-carriers ([11505da](https://github.com/Arggon/ArggonManager/commit/11505da6a0654487ffac3b6e15d26c4cf626e81e))
* **tasks:** publish bug-adr-status-drift-merged-adr-proposed acceptance ([dd906d4](https://github.com/Arggon/ArggonManager/commit/dd906d475c05fff28b08bad442459220a9f0a51b))
* **tasks:** publish task-wire-decision-brief-carriers acceptance contract ([ff02842](https://github.com/Arggon/ArggonManager/commit/ff02842fbc9ec820270d013135caad67a04cdaf6))
* **tasks:** record acceptance evidence for bug-native-arggon-tools-resolve-tracker-root-to-session-cwd ([031e890](https://github.com/Arggon/ArggonManager/commit/031e890b02b17ba3905b4bb16950d71d0155ac8d))
* **tasks:** record bug-test-suite-lib-dist-rebuild-race evidence ([230cd4d](https://github.com/Arggon/ArggonManager/commit/230cd4d1e43c74c21f50e219d8a67aa4a5275db1))
* **tasks:** record delivery-lead merge verification on bug-mcp-parity-... ([3dc2e42](https://github.com/Arggon/ArggonManager/commit/3dc2e4250842407cafaf7002dd25f893e45acbc3))
* **tasks:** record delivery-lead merge verification on task-cli-start-remediation-tail-clipped ([0c1f58e](https://github.com/Arggon/ArggonManager/commit/0c1f58eac9b7fc66d69d8074a11ce12c035febbf))
* **tasks:** record delivery-lead review verdict on the native tracker-root fix ([0e42874](https://github.com/Arggon/ArggonManager/commit/0e4287402c07a2759c96142803c40bf204e90178))
* **tasks:** record the ADR 0026 section-5 routing decision on the three live cases ([42126a9](https://github.com/Arggon/ArggonManager/commit/42126a94dff57ad10f422b7575621dc9b5a4f788))
* **tasks:** record the spec/plan 009 decision on bug-engineering-doc-stale-adr-statuses ([8634c97](https://github.com/Arggon/ArggonManager/commit/8634c971c2afead802faeb8fb64bf26147efcd6c))
* **tasks:** resolve the item-file union and record that both merge blockers are resolved ([1cb9bd0](https://github.com/Arggon/ArggonManager/commit/1cb9bd0ef3b10a1cdb2d6f2925f54adcdb4af42f))
* **tasks:** restore 4 item files committed as 0-byte blobs ([d9ec815](https://github.com/Arggon/ArggonManager/commit/d9ec815ebc741d31ba9ac9dd3ebda0a65213f1d2))
* **tasks:** restore 4 item files committed as 0-byte blobs ([9c17ae6](https://github.com/Arggon/ArggonManager/commit/9c17ae6cef0367f1321b863111e70b0f848698d2))
* **tasks:** split the carriers item, and correct a false acceptance row ([1b4235f](https://github.com/Arggon/ArggonManager/commit/1b4235f16155f1f12a0058b96a324aad14a7d2eb))
* **tasks:** split the seam-stale-snapshot gate defect out of the divergence bug ([c000d4e](https://github.com/Arggon/ArggonManager/commit/c000d4ef58b16c7031f0ab1a1701b70ba02a78e8))
* **tasks:** tick task-wire-decision-brief-carriers' live acceptance ([7b05edb](https://github.com/Arggon/ArggonManager/commit/7b05edb2d4db238d04462e6117046bb62d3b4f9f))
* **tasks:** tick the PR acceptance box on task-explore-agent-primary-role-model ([4de79c8](https://github.com/Arggon/ArggonManager/commit/4de79c869d12a58095219ab8bd1a7a540ecc1ce8))
* **tasks:** ticked task-wire-role-model-carriers acceptance (2 rows reported, not met) ([e8e370f](https://github.com/Arggon/ArggonManager/commit/e8e370fcab5e0f6235de8ad3fd70cb779cbac363))
* **tasks:** updated bug-adr-0023-ships-unindexed-blocks-every-pr ([e167760](https://github.com/Arggon/ArggonManager/commit/e167760cebfde0950bacfff22e778fba7f8aa1e6))
* **tasks:** updated bug-bundle-update-tool-drops-waive-and-force ([2913887](https://github.com/Arggon/ArggonManager/commit/2913887526ca333763b9d7d61b6f120eda7af485))
* **tasks:** updated bug-convention-md-links-nonexistent-adr-0015 ([0a845a7](https://github.com/Arggon/ArggonManager/commit/0a845a7ddcf5be383602d2e94447f86ef18a90a7))
* **tasks:** updated bug-convention-md-links-nonexistent-adr-0015 ([6183fbe](https://github.com/Arggon/ArggonManager/commit/6183fbe4aafd910cf8399e81ad886dc43d474a20))
* **tasks:** updated bug-headless-ci-twin-init-nondeterministic ([837a953](https://github.com/Arggon/ArggonManager/commit/837a953579b30c634cb2a6c82dc297e881c000f5))
* **tasks:** updated bug-seam-bundle-stale-snapshot-gate ([90b301e](https://github.com/Arggon/ArggonManager/commit/90b301eaf92a5716e5f49b6e63b22de81f395b70))
* **tasks:** updated bug-zero-byte-item-files-committed-by-comment-autocommit ([3e4c77c](https://github.com/Arggon/ArggonManager/commit/3e4c77c8e3ac11f923a04c001eaecd39b5dbdc98))
* **tasks:** updated bug-zero-byte-item-files-committed-by-comment-autocommit ([f4678cb](https://github.com/Arggon/ArggonManager/commit/f4678cbeeb847f9fa6a38f1c859da01c26cea573))
* **tasks:** updated task-adapter-orphan-reaping ([ccf60c7](https://github.com/Arggon/ArggonManager/commit/ccf60c7e11a31b3d727396af8121a6f94c0aa0d1))
* **tasks:** updated task-adr-0026-owner-decision-brief ([19e0797](https://github.com/Arggon/ArggonManager/commit/19e07979904d858ee778c3a418eb7c99c2138cfa))
* **tasks:** updated task-agent-identity-claim-discipline ([59df8a3](https://github.com/Arggon/ArggonManager/commit/59df8a3fb45fc62710f162f0692bd8929d056587))
* **tasks:** updated task-agent-role-contracts-seam ([02ac573](https://github.com/Arggon/ArggonManager/commit/02ac5738c30dd93c24974288961f425ebb0165d8))
* **tasks:** updated task-agent-role-contracts-seam ([e32cfbc](https://github.com/Arggon/ArggonManager/commit/e32cfbc7610fcc5ad156afd99ab9e6a7f3ff4f59))
* **tasks:** updated task-agent-role-contracts-seam ([f691716](https://github.com/Arggon/ArggonManager/commit/f691716795ef4aec644008c90d417f7f011b2dfb))
* **tasks:** updated task-agent-role-contracts-seam ([51f4d31](https://github.com/Arggon/ArggonManager/commit/51f4d3104c773f95bca92ef32ec3f843f80a64c4))
* **tasks:** updated task-agent-role-contracts-seam ([966b028](https://github.com/Arggon/ArggonManager/commit/966b028f9465aedd88d281f86659e04613bfcbc9))
* **tasks:** updated task-implement-decision-brief-kernel ([6894ae4](https://github.com/Arggon/ArggonManager/commit/6894ae48c71d748860bbb7b49d25b4daa47f0785))
* **tasks:** updated task-probe-native-seam-gate ([13bbb6f](https://github.com/Arggon/ArggonManager/commit/13bbb6fb3d91b4e85992ab05732d82e896daf4a4))
* **tasks:** updated task-probe-seam-body-shape ([c17b9bc](https://github.com/Arggon/ArggonManager/commit/c17b9bc8e6e945bf8cd3240043fbb215bb93332d))
* **tasks:** updated task-role-model-report-only-detector ([d7da1a8](https://github.com/Arggon/ArggonManager/commit/d7da1a85b6366c1765b278649a620a7591dd2a49))
* **tasks:** updated task-spec-local-validation-pipeline ([db31d3e](https://github.com/Arggon/ArggonManager/commit/db31d3ed1754446203d36c27261eb53912053ae2))
* **tasks:** updated task-spec-owner-decision-brief ([93be8a4](https://github.com/Arggon/ArggonManager/commit/93be8a418200a45a313d17bbd264420e4ed81d46))
* **tasks:** updated task-spec-owner-decision-brief ([26f5158](https://github.com/Arggon/ArggonManager/commit/26f5158616820dcdbecf0d17e8acff9b3dd2838f))
* **tasks:** updated task-wire-decision-brief-carriers ([3f01c25](https://github.com/Arggon/ArggonManager/commit/3f01c251b182c7272935d534276600956306724b))
* **tasks:** updated task-wire-decision-brief-carriers ([f48c0bd](https://github.com/Arggon/ArggonManager/commit/f48c0bdaa7c0fb342d176672b6124517c79ff570))
* **tasks:** updated task-wire-role-model-carriers ([9abba61](https://github.com/Arggon/ArggonManager/commit/9abba61ee8e4847a288f0536ddcf5170c3f8a26b))
* **tasks:** updated task-wire-role-model-carriers ([80460e8](https://github.com/Arggon/ArggonManager/commit/80460e8ea2109ac12d75eef2f9053210c550c5fa))
* **tasks:** updated task-wire-role-model-carriers ([0a50512](https://github.com/Arggon/ArggonManager/commit/0a50512ed4cfa16d5dc51fccca8f1ad6106924c2))
* what the AutoHarness/AutoContext/AutoCompact papers change for us — supersede 020's evidence, retain its decision ([742ce41](https://github.com/Arggon/ArggonManager/commit/742ce4177eaaf5e4f1127633542c35de8c790775))
* **zcode-seam:** regenerate the vendored plugin manifest to match the template ([850feff](https://github.com/Arggon/ArggonManager/commit/850feff904614ef1853f5195158bd12e7bfcbb92))

## [0.5.0](https://github.com/Arggon/ArggonManager/compare/arggon-manager-v0.4.1...arggon-manager-v0.5.0) (2026-10-02)

### Added

- **Worktree env contract**: `start --worktree` writes a gitignored `.arggon.env`
  carrying the worktree identity (`ARGON_ITEM`, `ARGGON_WORKTREE_ID`,
  `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`) plus per-OS
  `ARGGON_STATE_DIR` / `ARGGON_CACHE_DIR`, seeds `.env` copy-if-absent, and
  reports the outcome in the additive `env` receipt — `written: false` with a
  warning never blocks the claim (#566, spec worktree-env-contract-016).
  **Adopter migration:** read the contract keys instead of hardcoding paths;
  `x-worktree.env: false` opts out, and `cleanup --prune` reaps a
  start-created env file.
- **Single-writer worktree enforcement**: every `start --worktree` stamps its
  ownership in `arggon-claim.json` inside the worktree's **git dir** (never the
  work tree, so it cannot dirty `git status` or block `git worktree remove`).
  An attach under a different identity with tracked files modified after that
  stamp reports `claim.foreignWrites` — bounded (one `git status --porcelain`
  plus one `stat` per dirty path, 10 names with an exact total), best-effort,
  and never a claim blocker by default. `x-tracker.strict-worktree-writes: true`
  turns the same observation into an attach refusal before any item mutation,
  and a fired detection never re-stamps the worktree, so a retry cannot unlock
  the gate itself (#568).
- **Dead-owner take-over**: `arggon start <id> --worktree --take-over-worktree`
  authorizes replacing a stamp whose owner is gone (a crashed session), naming
  who was replaced and when in a bounded chain persisted in the stamp. Default
  off; the manual `rm <git-dir>/arggon-claim.json` recovery stays documented for
  clients without the flag (#573).
- **Compose reaping on prune**: `x-worktree.services` in `.convention.yml`
  declares per-worktree Compose projects (`true` → `<repo>-<item-id>`, a base
  name → `<base>-<repo>-<item-id>`, lowercased). `cleanup --prune` runs
  `docker compose -p <project> down -v --remove-orphans` **before** the worktree
  removal for every removable entry — report-only (never a failure) without
  Docker, non-fatal with bounded detail on failure, tolerant of an
  already-gone project by exit code — and the plugin's native prune loop now
  matches the CLI byte for byte (#569, #574).
- **Gate-bin readiness**: `x-tracker.strict-gate-bins: true` refuses the claim
  when a declared project gate binary resolves outside the worktree, naming the
  offending bins with their observed source plus the `npm ci` remedy (#533) — the
  `gateBins` receipt that reports each resolution shipped in 0.4.1.
- **Board**: dark mode and a density toggle.
- **TUI**: vim motions, a help overlay and color control; kernel filter
  predicates with saved views; claim/move actions routed through the kernel
  update path instead of their own writes.
- **Release pipeline**: release-please proposes the version bump; `release.yml`
  runs an ordered guard, tags, publishes `@arggondev/lib` **before**
  `arggon-manager` (OIDC trusted publishing), and attaches both tarballs.
  `release.md` is now only the operator's exception manual — the manual
  bump/pack/publish runbook is retired (ADR 0018, spec release-pipeline-015).
- **Methodology**: the greenfield exploration protocol (exploration-015 +
  ADR 0017) is wired into the carriers, so a new area opens with an
  exploration gate instead of an implementation.

### Changed

- **Kernel-facing**: `cleanup --json` pins its exit-code contract — exit 0 with
  a `failures[]` payload, never a non-zero exit for a partial prune — and
  branch-delete failures land there with both catch surfaces bounded (#515,
  task-cleanup-json-exit-code).
- **Supply chain**: every `uses:` in the shipped workflows is pinned to a full
  commit SHA with a human-readable version comment, kept that way by a grep
  gate (#567); the release seam pin stays a literal and is now enforced against
  the regenerated seam by `cli/src/ci-seam-pin.test.ts`, so a stale pin is a
  red test rather than a silent outage (ADR 0018 amendment).
- **Kernel-facing**: comment authors resolve without `gh`, and a missing
  dependency is named instead of surfacing as an opaque failure (#558).
- **MCP**: the CLI spawn spec is derived for the `--import` loader form, so the
  stdio server and the CLI stay in step (#543).
- **Docs**: adopter pattern doc for per-worktree ephemeral service containers,
  a UI + `/api/item` documentation refresh, ADR index rows added with ADRs
  0014/0015 → Accepted, and ADR 0019 amended with the claim/concurrency layer
  (decision point 4) that `start`'s stamp/detection implements.
- **Machine hygiene**: per-machine `.zcode/` harness state is no longer tracked —
  it churned `git status` and blocked `start` (bug-harness-config-churn).

### Fixed

- **start**: a fresh `start --worktree` always leaves a gate-usable install, or
  refuses before the claim with the named binaries, the preparation log and the
  `npm ci` remedy (#551); a stale primary install is reported as
  `manifestCoverage: "stale"` with the missing dependencies named.
- **start**: the single-writer detection reads **raw** `git status --porcelain`.
  A trimming helper shifted porcelain's positional status column, so the parsed
  path lost its first character and the detection silently never fired against
  real git — the unit fakes had masked it; the regression is now pinned against
  real git and the real CLI (#573).
- **Board**: the live-reload e2e spec waits on the server's readiness signals
  instead of an evaluate poll, which raced the reload and produced a false
  failure (#521).
- **init**: the generated `opencode.jsonc` no longer emits bare
  `"formatter": true`. The built-in prettier runs as `<prettier> --write $FILE`
  with the session's project directory as cwd and resolves `.prettierignore`
  from that cwd, so a session rooted in the primary checkout that edited a file
  in a sibling `arggon start --worktree` worktree bypassed the ignore file and
  reformatted gitignored files into large style-only churn. The template ships a
  `formatter.prettier.command` override that anchors the same invocation at the
  edited file's own git root: non-ignored files format exactly as before, and
  the command exits 0 without formatting when no prettier resolves (e.g. a cold
  worktree before `start` links the install) (#541, #531).
  **Adopter migration:** `init` never rewrites an adopter-modified
  `opencode.jsonc`, so existing adopters must hand-apply the override — copy the
  `formatter` block from `templates/docs/opencode.jsonc` (or run a fresh
  `arggon init` on a scratch fixture) into their config.
- **Config**: this repo's own `opencode.jsonc` `permissions` block did not parse
  — the array closed early and one rule was stranded outside it, so the
  workflow gates were silently unenforced and agent sessions failed every shell
  call closed. Repaired, and pinned by `cli/src/opencode-permissions.test.ts`
  (#576).

## [0.4.1] - 2026-10-01

### Fixed

- **Board**: boards rendered through the tsx path embedded esbuild `keepNames`
  `__name(...)` calls into the page script, killing filter/drag/collapse/theme
  controls (`ReferenceError` at load); render now strips them, fails loudly on
  unknown shapes, and a tsx-path spawn gate + `@smoke` browser legs keep the
  class out (#510).
- **Frontmatter**: the writer quotes plain scalars the reader would decode as
  non-string (`0123`, `007`, `-0`, big ints, `null`, `~`, `true`, `false`) so
  titles/labels/extras keep their exact text on every rewrite (#509).
- **Validate**: dependency-cycle messages are canonical closed chains
  (`a -> b -> … -> a`), byte-identical under any traversal order (#506).
- **Done gate**: empty `- [ ] ` scaffold placeholders no longer wedge the
  auto-done flip; `create` scaffolds a comment placeholder instead (#507).
- **cleanup**: branch-delete failures are reported in `failures[]` (not only
  `pruned[]`), and both catch surfaces bound error text into the envelope
  (#515).
- **start --worktree**: readiness reports `gateBins` — which node_modules each
  gate binary resolves from (worktree/external/PATH/missing) — and both failure
  errors name the observed source + the `npm ci` remediation (#517).

### Changed

- All test spawn chains run `node --import <tsx loader>` directly instead of
  the tsx wrapper CLI (one process, no per-spawn IPC server — the root cause of
  the row-table CI flakes); test-only, enforced by a wrapper-reference gate
  (#513, #518).
- Packed tarball also excludes the compiled `dist/test-spawn.*` test
  helper, same class as `dist/test-tmp.*` (CI version guard demands the
  version move when the packaged `files` list changes;
  task-runcli-import-tsx-migration).
- `.zcode/` harness state is untracked and ignored — per-machine session churn
  no longer blocks `start`'s clean-tree precondition (#514).
- Kernel (`@arggondev/lib` 0.4.1): new `inspectGateBinResolution` /
  `GateBinResolution` exports and `gateBins` on the worktree dependency
  preparation (#517).

## [0.4.0] - 2026-09-22

### Added

- **Native-first OpenCode V2 surface** (`plan-native-first-011`, waves W0–W7;
  ADR 0011 + spec `spec-native-first-011`). OpenCode now drives the kernel
  through native surfaces instead of the CLI-driving seam:
  - **Native tool namespace** `tools.arggon.*` — the twelve kernel operations
    (`list`, `create`, `update`, `show`, `next`, `report`, `validate`,
    `comment`, `handoff`, `priority`, `sync`, `import_issues`) plus the worktree
    tools (`start`, `branch`, `cleanup`), each a thin in-process adapter
    returning the documented `--json` envelope; kernel failures surface as
    typed tool errors and the session continues.
  - **Eleven native commands** (`/arggon-next`, `-start`, `-done`, `-handoff`,
    `-review`, `-status`, `-spec`, `-adr`, `-explore`, `-playbook`, and the new
    `/arggon-adopt`) that drive the tools directly instead of shelling out to
    the adapter. Two of them keep sanctioned shell steps by design: `/arggon-adopt`
    runs the headless bootstrap (`npx arggon-manager init`, `adopt --ack`) and
    `/arggon-start` publishes the branch (`git push`, `gh pr create --draft`).
  - **Vendored single-file plugin** (`.opencode/plugins/arggon/index.ts`, the
    kernel inlined, no `node_modules` needed in the adopter tree) and the
    **TUI board/status panel** (`.opencode/plugins/arggon/tui.tsx`,
    `/arggon-board`).
  - **Worktree lifecycle** over the OpenCode worktree domain
    (`/arggon-start` records `branch` + `worktree_path`, `/arggon-done` and
    `cleanup` remove merged worktrees); the CLI (`arggon start --worktree`,
    `arggon cleanup --prune`) stays the documented fallback.
- **`ArggonManager/` tracker root** (ADR 0012): the tracker and all product
  docs live under `ArggonManager/`; legacy `tasks/` trees are still detected and
  migrate with `arggon migrate --layout` — no hard break.
- **Two-package distribution** (ADR 0013): `@arggondev/lib` (the kernel package)
  and `arggon-manager` (headless bin + templates + plugin). Pre-release they
  install from packed tarballs (both together — the root package alone cannot
  resolve the private kernel); after the release wave, one line:
  `npm install -g arggon-manager`.
- **Headless CI recipe** generated by `init`
  (`.github/workflows/arggon.yml`): install the packed bin →
  `arggon init --no-commit` → committed-seam drift gate →
  `arggon validate --json`, with no model, no MCP and no OpenCode. The fixture
  in `cli/src/headless-ci.test.ts` runs the recipe verbatim.
- **Skill progressive disclosure**: the `arggon-cli` skill ships as an umbrella
  `SKILL.md` plus `references/` (json-contract, methodology, orchestration,
  pitfalls), each read only when the task needs it, and a new `arggon-upgrade`
  skill walks adopters through template upgrades.

### Changed

- **OpenCode default path (W3): the plugin no longer auto-registers the MCP
  server.** The native tools are in-process and need no MCP client, so the
  generated `opencode.jsonc` carries no `mcp.servers.arggon` stanza and the
  plugin never touches `ctx.mcp` (ADR 0011 §5/§6). Consequence for existing
  adopters: re-running `arggon init` replaces the old plugin with the vendored
  bundle and **you lose MCP auto-registration** unless you configure
  `mcp.servers.arggon` yourself. `doctor` reports a present stanza as
  _optional_ (removal guidance) instead of recommending registration, and
  `.mcp.json` plus `arggon mcp` stay for non-OpenCode MCP clients that
  configure them explicitly.
- Generated seam: `.opencode/agents/*` and `.opencode/commands/*` are the
  native prompt templates, the config gains the minimal W4 shell gates (no
  `--no-verify`, no force-push; the base policy stays allow-all), and the
  vendored plugin + TUI entry are bundled with provenance as before.
- Upgrading: re-run `arggon init`. Untouched generated files refresh,
  adopter-modified ones are skipped (never overwritten) — `--backup` archives
  them to `backup/<date>/` before regenerating; `init --dry-run` previews the
  decisions and `init --propose` is the side-file channel for acked docs.

## [0.3.0] - 2026-09-17

### Added

- **Upgrade channel, complete**: `arggon init --dry-run` (plan-only preview), doctor `outdated` bucket, and `arggon init --propose` — section-level upgrade proposals for acked/modified docs (side files with anchors; originals untouched; `--propose-whole-file` for full renders). The bundled **arggon-upgrade skill** (delivered by init alongside the arggon-cli skill) walks adopters through the flow.
- **Convention v4: `priority` field** on every item type (`p0|p1|p2|p3`, optional): `create/update --priority`, `priority:` filter (`priority:none` = unprioritized), `arggon priority migrate` (moves legacy `pN` labels into the field), board chip. `arggon next` ranks the ready pool **priority-major** (ADR 0009) — priority first, downstream weight within a priority — with the cost of misprioritization visible in the reason.
- EOL-normalized provenance comparisons: `eol=crlf` working trees (`.gitattributes eol=crlf`, Windows checkouts) no longer produce false `acknowledgedDrifted`/inert proposals; `projectName` is recovered on re-runs (worktree/renamed-clone-safe renders); `init --dry-run`/`--propose` are worktree-safe.

### Fixed

- CRLF working trees no longer break doctor buckets, propose, or project-name recovery (bug-crlf-provenance-breakage).
- Project name no longer leaks from the working-directory basename into renders (bug-project-name-dir-derived).
- spawnSync e2e tests no longer flake at vitest's 5s default under load (bug-spawn-sync-test-timeout-flake).

## [0.2.0] - 2026-09-16

### Added

- Release discipline: every release bumps the version, gets a `vX.Y.Z` tag on the release commit in `main`, and a section here listing adopter-facing changes — so `arggonVersion` stamps in generated docs tell you which upgrades you missed. See `ArggonManager/docs/runbooks/release.md` (task-version-channel-discipline).
- Non-functional review bar and a blocking smoke gate in CI (ADR 0008).
- `spec import openspec` — import an existing OpenSpec tree.
- `spec analyze --baseline` / `--save-baseline` — diff spec analysis against a saved baseline.
- `spec audit` — audit a spec tree for convention violations.
- `arggon adopt` now injects task body content (corpus) into adopter context.
- Agent skill synced with the new command surface above.
- Self-hosted governance stack (story-dogfood-self-host): convention v3 with `branch_patterns` and `x-tracker.auto-commit` in the tracker `.convention.yml`; bundled agent skill at `.agents/skills/arggon-cli/SKILL.md`; generated adopter docs (`.editorconfig`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/copilot-instructions.md`, `SECURITY.md`, `SUPPORT.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `ArggonManager/docs/tracking.md`, `ArggonManager/docs/runbooks/README.md`); technology playbooks for node/typescript/vitest under `ArggonManager/docs/playbooks/`; a local pre-commit hook running `arggon validate`.

### Changed

- `cli/src/cli.test.ts`: the `hello` envelope test now reads the tree's convention version instead of hardcoding the default 0.

## [0.1.0] - 2026-09-14

### Added

- `doctor` now surfaces x-generated drift: modified/untouched generated docs are reported so agents can see ack drift.
- Comment lock: concurrent `arggon comment` runs on one item serialize instead of clobbering each other.
- Tracker autocommit retry + explicit reporting when the post-command commit fails.
- `ancestor:<id>` filter predicate for `arggon list`.
- `arggon update --parent <id>` reparenting.
- Version policy: package.json is bumped manually per release wave; `arggon --version` reads the package version; this changelog documents each wave.
- Init docs: `x-*` extensions section and an orchestration subsection in generated guidance.

### Fixed

- `board --serve --json` docs aligned with actual behavior.
- `arggon init` auto-commit fix.
