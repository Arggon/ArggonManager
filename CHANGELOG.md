<!-- arggon:generated template="CHANGELOG.md" -->

# Changelog

All notable changes to ArggonManager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0](https://github.com/Arggon/ArggonManager/compare/v0.9.0...v0.10.0) (2026-10-13)


### Added

* **smoke:** hermetic HOME for the plugin smokes; onCompaction id read (task-plugin-smoke-home-isolation) ([0ecb600](https://github.com/Arggon/ArggonManager/commit/0ecb60076bf62d9bb5cdd702a112c41dfe20b55f))
* **smoke:** serve the plugin smokes under a hermetic HOME ([56e2317](https://github.com/Arggon/ArggonManager/commit/56e2317f69afa96905f14a17670f59b74508ff9d))


### Fixed

* **docs:** shipped doc samples name the shipped seam ids + live-doc guard (bug-retired-agent-ids-in-doc-samples) ([78ae2b3](https://github.com/Arggon/ArggonManager/commit/78ae2b305dc0472abdca2395787b2ab410eddc35))
* **docs:** shipped doc samples name the shipped seam ids + live-doc guard (bug-retired-agent-ids-in-doc-samples) ([b08f1b0](https://github.com/Arggon/ArggonManager/commit/b08f1b0579cfd812e7aa24ed513854c864095353))
* **plugin:** read onCompaction's item id like onContext ([1b4bdc7](https://github.com/Arggon/ArggonManager/commit/1b4bdc7f947eebc5c207d62ce81e88571a9d9879))
* **release:** guard the exact kernel pin (bug-kernel-pin-never-exact) ([838bb46](https://github.com/Arggon/ArggonManager/commit/838bb46fb910a2fe4e256a814396c35a41cbbf82))
* **release:** guard the exact kernel pin on the release PR and on main ([8264452](https://github.com/Arggon/ArggonManager/commit/8264452c3a74757661feb0e728a3931ad3dda051))
* **roles:** shipped role vocabulary in the goal contract and the capability matrix (task-retired-role-words-product-text) ([6b820cc](https://github.com/Arggon/ArggonManager/commit/6b820ccb7cc8d8957e55322a356d8fa3694ebd91))
* **roles:** shipped role vocabulary in the goal contract and the capability matrix (task-retired-role-words-product-text) ([6bbf2fd](https://github.com/Arggon/ArggonManager/commit/6bbf2fdccfb76b86c99c69ec3b2d7b952258ae8b))
* **seam:** emit one provenance marker per agent, warn the V1 schema (task-seam-nits-v1-schema-and-marker) ([9ef55be](https://github.com/Arggon/ArggonManager/commit/9ef55be936e03057b873fb534344d49c83d01493))
* **seam:** single provenance marker + V1-schema warning (task-seam-nits-v1-schema-and-marker) ([c311eb0](https://github.com/Arggon/ArggonManager/commit/c311eb074ce363e348476915aef96f45801df66e))


### Changed

* **auto:** mark items done (PR [#787](https://github.com/Arggon/ArggonManager/issues/787) merged) ([#791](https://github.com/Arggon/ArggonManager/issues/791)) ([f0f2843](https://github.com/Arggon/ArggonManager/commit/f0f284316340353f1c3e7c13b13e3b2eee7afb64))
* **auto:** mark items done (PR [#788](https://github.com/Arggon/ArggonManager/issues/788) merged) ([#792](https://github.com/Arggon/ArggonManager/issues/792)) ([c91f70b](https://github.com/Arggon/ArggonManager/commit/c91f70b866f1ee707f3adc7013fc1e0799fadac8))
* **auto:** mark items done (PR [#790](https://github.com/Arggon/ArggonManager/issues/790) merged) ([#793](https://github.com/Arggon/ArggonManager/issues/793)) ([b343070](https://github.com/Arggon/ArggonManager/commit/b34307062ad2d1db54ab288fb378e358c404a21a))
* **labs:** CI-log mining method + done-gate refusal classification (task-done-gate-refusal-rate-substrate) ([c6475d0](https://github.com/Arggon/ArggonManager/commit/c6475d0cb8b526eaba00fb97541d24e608fd5d94))
* **labs:** CI-log mining method + done-gate refusal classification (task-done-gate-refusal-rate-substrate) ([6b7a66f](https://github.com/Arggon/ArggonManager/commit/6b7a66f6c67486561e8652922527d0efcfe41045))
* **methodology:** promote lessons into their carriers (task-lesson-promotion-implementation) ([268d908](https://github.com/Arggon/ArggonManager/commit/268d9088919d15ca0c22789ec5213ef7857767aa))
* **methodology:** promote lessons into their carriers (task-lesson-promotion-implementation) ([2447188](https://github.com/Arggon/ArggonManager/commit/24471883b4cde4afb535436d9fb59b9c9ad6c923))
* **release:** 0.10.0 ([12178ba](https://github.com/Arggon/ArggonManager/commit/12178bad0a26c23d4385a6e21f3c9a36248dc646))
* **release:** state the expected red window on a non-lockstep release PR ([1efe5dd](https://github.com/Arggon/ArggonManager/commit/1efe5dd7755872f7b6848465ee2aedf8b796f776))
* **release:** state the expected red window on a non-lockstep release PR (task-nonlockstep-red-state-expectations) ([cf42c32](https://github.com/Arggon/ArggonManager/commit/cf42c329b6fba4ac8221bcf4cf049e2b7f7c1437))
* **tasks:** claimed bug-kernel-pin-never-exact ([e95b704](https://github.com/Arggon/ArggonManager/commit/e95b704eb9a9c29ca1600c05ec13b3be211c46ea))
* **tasks:** claimed bug-retired-agent-ids-in-doc-samples ([48f7ddd](https://github.com/Arggon/ArggonManager/commit/48f7ddd007bc725d97e5a6daeafb9527c1bc364e))
* **tasks:** claimed task-done-gate-refusal-rate-substrate ([7d98098](https://github.com/Arggon/ArggonManager/commit/7d98098a761619232f3adca4468de266986bf724))
* **tasks:** claimed task-lesson-promotion-implementation ([cf3ef58](https://github.com/Arggon/ArggonManager/commit/cf3ef5872cee9df8b3bf38160bfdb19d96e3fa43))
* **tasks:** claimed task-nonlockstep-red-state-expectations ([2452fd6](https://github.com/Arggon/ArggonManager/commit/2452fd6a6eaee3831a1f8f1b325cf706c9bd7e1b))
* **tasks:** claimed task-plugin-smoke-home-isolation ([038a1cb](https://github.com/Arggon/ArggonManager/commit/038a1cbf00fe4985c431478d08e9059843c61e1f))
* **tasks:** claimed task-retired-role-words-product-text ([a4c2da4](https://github.com/Arggon/ArggonManager/commit/a4c2da4cf0c3932a9dc3b2ffe918011a411eb57d))
* **tasks:** claimed task-seam-nits-v1-schema-and-marker ([fd61aa0](https://github.com/Arggon/ArggonManager/commit/fd61aa07250fcd9ebf82d25647fe6163f8f1189c))
* **tasks:** commented bug-kernel-pin-never-exact ([ab6becf](https://github.com/Arggon/ArggonManager/commit/ab6becf36a384d25fd1612d09e68e4c484fdce0b))
* **tasks:** commented bug-kernel-pin-never-exact ([c0da3e2](https://github.com/Arggon/ArggonManager/commit/c0da3e2a29c57dc15b030faa32f7b185f4a6ff14))
* **tasks:** commented bug-kernel-pin-never-exact ([0a308b2](https://github.com/Arggon/ArggonManager/commit/0a308b2357ebe40fd932dae4d4f900ecb338612a))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([c1b2380](https://github.com/Arggon/ArggonManager/commit/c1b23802ba183f8ebfab79ceab8d8afaec9b93ee))
* **tasks:** commented bug-retired-agent-ids-in-doc-samples ([b94a9ba](https://github.com/Arggon/ArggonManager/commit/b94a9ba2241f33bb791f943475bea5e5b11b993d))
* **tasks:** commented bug-retired-agent-ids-in-doc-samples ([378eb66](https://github.com/Arggon/ArggonManager/commit/378eb663e997028c955c38b602a0a94e01483419))
* **tasks:** commented task-done-gate-refusal-rate-substrate ([48bbbc2](https://github.com/Arggon/ArggonManager/commit/48bbbc20073865d869e293b6990abb4d071c1303))
* **tasks:** commented task-done-gate-refusal-rate-substrate ([675c000](https://github.com/Arggon/ArggonManager/commit/675c000caa9a0f2e70aa2d05502cf1b7f168c4b7))
* **tasks:** commented task-lesson-promotion-implementation ([0322f46](https://github.com/Arggon/ArggonManager/commit/0322f46757b4779ff3c8f3a283dbb2f3420f225e))
* **tasks:** commented task-lesson-promotion-implementation ([ae1d67e](https://github.com/Arggon/ArggonManager/commit/ae1d67ec7fb8a73d58aa4e71597d0f6f045af35b))
* **tasks:** commented task-nonlockstep-red-state-expectations ([c211e17](https://github.com/Arggon/ArggonManager/commit/c211e175895c1cc87e63696bdd69a7106b3fcc19))
* **tasks:** commented task-nonlockstep-red-state-expectations ([0222104](https://github.com/Arggon/ArggonManager/commit/022210474e0130b359c6173a973d7d2799b952fb))
* **tasks:** commented task-plugin-smoke-home-isolation ([7990949](https://github.com/Arggon/ArggonManager/commit/799094981c7d52ec27034b1d4abc57cd748d97c3))
* **tasks:** commented task-plugin-smoke-home-isolation ([557f93d](https://github.com/Arggon/ArggonManager/commit/557f93dd52b40dac45e1733f9dee67b0cad30b23))
* **tasks:** commented task-plugin-smoke-home-isolation ([ce3f14b](https://github.com/Arggon/ArggonManager/commit/ce3f14b76b1a1fbeb951b20bbaf4c0a58f449f83))
* **tasks:** commented task-plugin-smoke-home-isolation ([ab10b84](https://github.com/Arggon/ArggonManager/commit/ab10b842f7a4dddaa091a65485d30f66bb3a7a2d))
* **tasks:** commented task-plugin-smoke-home-isolation ([bc2290e](https://github.com/Arggon/ArggonManager/commit/bc2290e44335c59bd5965e471fbc0f13ad98f7d9))
* **tasks:** commented task-release-workflow ([238da50](https://github.com/Arggon/ArggonManager/commit/238da500697e8e4d0fe8fc3a56a1cf7d9fe01f3a))
* **tasks:** commented task-retired-role-words-product-text ([5e1642d](https://github.com/Arggon/ArggonManager/commit/5e1642df94bdeb43e960fcd831fa577be44e4911))
* **tasks:** commented task-retired-role-words-product-text ([996bbc2](https://github.com/Arggon/ArggonManager/commit/996bbc224cd1d4453da3f698027f49e82f1847e1))
* **tasks:** commented task-retired-role-words-product-text ([a26c67e](https://github.com/Arggon/ArggonManager/commit/a26c67ea1355b0d25f37b13332f521cf153bea20))
* **tasks:** commented task-retired-role-words-product-text ([f289258](https://github.com/Arggon/ArggonManager/commit/f28925819fa3528a302020560357e8829e098008))
* **tasks:** commented task-seam-nits-v1-schema-and-marker ([a2b451b](https://github.com/Arggon/ArggonManager/commit/a2b451b9465adffe0461d3516792603918a7bc85))
* **tasks:** commented task-seam-nits-v1-schema-and-marker ([b5aec8b](https://github.com/Arggon/ArggonManager/commit/b5aec8b6b45268c3c81f05e549a90b676196a8b2))
* **tasks:** commented task-seam-nits-v1-schema-and-marker ([c6024e1](https://github.com/Arggon/ArggonManager/commit/c6024e1f79f799a1eef2448df2c0a0a53c45eafa))
* **tasks:** done bug-kernel-pin-never-exact ([c2a1f9d](https://github.com/Arggon/ArggonManager/commit/c2a1f9d6822e5bdff680fefc606b9b526d3ff4d0))
* **tasks:** file bug-full-smoke-scenarios-precede-newer-gates (context + acceptance) ([fbc0e5d](https://github.com/Arggon/ArggonManager/commit/fbc0e5d438b7edc206a4b33dd7d18f90a3e3e715))
* **tasks:** file task-nonlockstep-red-state-expectations (guard's expected red window) ([a8801d8](https://github.com/Arggon/ArggonManager/commit/a8801d8a33641477c3b6d62db8c3d393d6f92602))
* **tasks:** file task-zcode-maker-lesson-trigger (ADR 0027 parity gap) ([d321efb](https://github.com/Arggon/ArggonManager/commit/d321efb03758d899c01d7088210cfcd02a060f81))
* **tasks:** pruned bug-kernel-pin-never-exact, task-plugin-smoke-home-isolation, task-retired-role-words-product-text, task-seam-nits-v1-schema-and-marker ([c43b907](https://github.com/Arggon/ArggonManager/commit/c43b907f27c46859efe1a03246fce4c4ad7c2a9a))
* **tasks:** tick acceptance on bug-kernel-pin-never-exact (lead verification: exact pin + guard + docs shipped) ([7797b86](https://github.com/Arggon/ArggonManager/commit/7797b865dd79560b893630e9b50d02906310ae29))
* **tasks:** tick task-plugin-smoke-home-isolation acceptance (hermetic smokes verified) ([eabf0fe](https://github.com/Arggon/ArggonManager/commit/eabf0fe7e6ffa3753d39566c790d7372b0f6b0b8))

## [0.9.0](https://github.com/Arggon/ArggonManager/compare/v0.8.0...v0.9.0) (2026-10-13)


### Added

* **opencode:** board panel event-driven refresh T4 (task-opencode-event-panel) ([cc2ccc4](https://github.com/Arggon/ArggonManager/commit/cc2ccc4ee68471ca6a235241975d8a4910ca23b6))
* **opencode:** board panel refreshes from the OpenCode event stream (task-opencode-event-panel) ([989fcfa](https://github.com/Arggon/ArggonManager/commit/989fcfaad73c9559453311992a456197a129e0d4))


### Fixed

* **bug-verifier-cannot-read-the-tracker-no-allow-side:** grant the verifier's tracker reads, deny every tracker write ([72ff9a7](https://github.com/Arggon/ArggonManager/commit/72ff9a7108f807067ae9fcbf001a37996f57a666))
* **bug-verifier-cannot-read-the-tracker-no-allow-side:** grant the verifier's tracker reads, deny every tracker write ([d58d850](https://github.com/Arggon/ArggonManager/commit/d58d85035d840d3c84c222e5d7d05a26ef0bab22))
* **release:** surface non-lockstep release PRs and gate the tag on lockstep ([cfded09](https://github.com/Arggon/ArggonManager/commit/cfded09af1a8a11b07c9da92e2f39ed452d5c789))
* **release:** surface non-lockstep release PRs, gate the tag on lockstep (bug-release-proposal-non-lockstep-undetected) ([e343229](https://github.com/Arggon/ArggonManager/commit/e3432290435a8b3b3d0cd1131968bfef381961ad))
* **templates:** seam-wide family guard, project-declared checks, goal-mode vocabulary (task-adopter-template-family-followups) ([52a6a70](https://github.com/Arggon/ArggonManager/commit/52a6a70247425c95299f2a61da95b1d5341988f4))
* **templates:** seam-wide family guard, project-declared checks, goal-mode vocabulary (task-adopter-template-family-followups) ([2d9650c](https://github.com/Arggon/ArggonManager/commit/2d9650c4e2de315a27cf27d3b62cc7daa30f4d55))
* **zcode-seam:** regenerate the committed goal command from the template (task-adopter-template-family-followups) ([55e40c4](https://github.com/Arggon/ArggonManager/commit/55e40c4ee298201a4b78f2393e12836a90b7cbcd))


### Changed

* **auto:** mark items done (PR [#771](https://github.com/Arggon/ArggonManager/issues/771) merged) ([#776](https://github.com/Arggon/ArggonManager/issues/776)) ([9f93fb4](https://github.com/Arggon/ArggonManager/commit/9f93fb46501ba2e0649386f8032a5a4068686ab5))
* **auto:** mark items done (PR [#772](https://github.com/Arggon/ArggonManager/issues/772) merged) ([#775](https://github.com/Arggon/ArggonManager/issues/775)) ([1122174](https://github.com/Arggon/ArggonManager/commit/11221749b3906bb2f72f053d19e7be5d1fc7a768))
* **auto:** mark items done (PR [#773](https://github.com/Arggon/ArggonManager/issues/773) merged) ([#777](https://github.com/Arggon/ArggonManager/issues/777)) ([b39c5f1](https://github.com/Arggon/ArggonManager/commit/b39c5f10ee19aa5ee2e1c3cfbd543a4074dfac33))
* **auto:** mark items done (PR [#774](https://github.com/Arggon/ArggonManager/issues/774) merged) ([#778](https://github.com/Arggon/ArggonManager/issues/778)) ([ac95324](https://github.com/Arggon/ArggonManager/commit/ac95324a4af0d016e163245b6fdea984c13f13cf))
* **auto:** mark items done (PR [#780](https://github.com/Arggon/ArggonManager/issues/780) merged) ([#784](https://github.com/Arggon/ArggonManager/issues/784)) ([5893192](https://github.com/Arggon/ArggonManager/commit/58931929bdbb97ba9af1ab4eb596423e8dc5101c))
* **auto:** mark items done (PR [#781](https://github.com/Arggon/ArggonManager/issues/781) merged) ([#783](https://github.com/Arggon/ArggonManager/issues/783)) ([92429bc](https://github.com/Arggon/ArggonManager/commit/92429bcb25bb7b35a872b73f4fea4173da316573))
* **auto:** mark items done (PR [#782](https://github.com/Arggon/ArggonManager/issues/782) merged) ([#785](https://github.com/Arggon/ArggonManager/issues/785)) ([875f370](https://github.com/Arggon/ArggonManager/commit/875f370d1694adda3ea484601967d4677c58913e))
* **exploration-021:** auto-done sweep refutes the zero — 16% done-gate refusal rate (task-sweep-auto-done-refusal-warnings) ([97a8ffc](https://github.com/Arggon/ArggonManager/commit/97a8ffcb0c1444a15f49af30cca53cbf0b509df2))
* **exploration-021:** auto-done sweep refutes the zero — 42/262 done-gate refusals in the parent window (task-sweep-auto-done-refusal-warnings) ([63752cc](https://github.com/Arggon/ArggonManager/commit/63752cc11ad4798c95b3bb931f10b862fc33d52f))
* **matrix:** credit the stale-seam collision to transcription, tighten gap criterion + lint scope (task-capability-matrix-followups-from-review) ([18d6423](https://github.com/Arggon/ArggonManager/commit/18d642397e1e975dbc10ca87bab9c6017a729600))
* **matrix:** credit the stale-seam collision to transcription, tighten gap criterion + lint scope (task-capability-matrix-followups-from-review) ([60e9e7b](https://github.com/Arggon/ArggonManager/commit/60e9e7b79c3541e71868fea1c7fb525530baab2b))
* **release:** 0.9.0 ([599ed27](https://github.com/Arggon/ArggonManager/commit/599ed27defe98e9cb4cd269cf8bd37c7c6dd8751))
* **seam:** refresh the goal-command x-generated record after the template edit (task-adopter-template-family-followups) ([baca2f4](https://github.com/Arggon/ArggonManager/commit/baca2f4e596d3abd79b5564220d528aebac918ce))
* **skill:** say "different checks" in the stopping rule ([d7dea8c](https://github.com/Arggon/ArggonManager/commit/d7dea8c53ced9ac2483d9aa477bc79468a8d718b))
* **skill:** write the ADR 0017 exploration stopping rule (task-state-exploration-stopping-rule) ([6b0db86](https://github.com/Arggon/ArggonManager/commit/6b0db866f7dfdc87ddc207bec9277886c968d246))
* **skill:** write the ADR 0017 exploration stopping rule (task-state-exploration-stopping-rule) ([fe81a08](https://github.com/Arggon/ArggonManager/commit/fe81a086874a7b724cfdb3294abb02710ac27fc4))
* **tasks:** claimed bug-release-proposal-non-lockstep-undetected ([c8c72b8](https://github.com/Arggon/ArggonManager/commit/c8c72b838a67c69d76df8d4c8cba0d7402972784))
* **tasks:** claimed bug-verifier-cannot-read-the-tracker-no-allow-side ([72a79a0](https://github.com/Arggon/ArggonManager/commit/72a79a0d6340ac8c08eb5a569ef5685f04340b29))
* **tasks:** claimed task-adopter-template-family-followups ([41de2e3](https://github.com/Arggon/ArggonManager/commit/41de2e31113f5fa8a18bfb3ba421385292b8f3ab))
* **tasks:** claimed task-capability-matrix-followups-from-review ([2ec0cf4](https://github.com/Arggon/ArggonManager/commit/2ec0cf4626136cdca3805d7bc15d303caa564d10))
* **tasks:** claimed task-convention-drift-guard-clarifications ([fb45394](https://github.com/Arggon/ArggonManager/commit/fb4539428f89de14fb59a3f34296bac245efec51))
* **tasks:** claimed task-opencode-event-panel ([ca533d9](https://github.com/Arggon/ArggonManager/commit/ca533d9cfda316f3415e935b655f045c501e0a46))
* **tasks:** claimed task-state-exploration-stopping-rule ([2cfcaaf](https://github.com/Arggon/ArggonManager/commit/2cfcaafb755baf0df9072473a14eea543c10f24e))
* **tasks:** claimed task-sweep-auto-done-refusal-warnings ([b1c8197](https://github.com/Arggon/ArggonManager/commit/b1c81972577d183daf4f9a1453a395c3a61dae54))
* **tasks:** commented bug-kernel-pin-never-exact ([8b254a6](https://github.com/Arggon/ArggonManager/commit/8b254a6080b8afecc01b45eec50757c34190f070))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([10a1b2c](https://github.com/Arggon/ArggonManager/commit/10a1b2cf251e31a5fd8d0b6b1567f33d99c0738b))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([8b66cf6](https://github.com/Arggon/ArggonManager/commit/8b66cf63463c6a9356e45c854cf1bfab8b9096d3))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([85d7592](https://github.com/Arggon/ArggonManager/commit/85d759299683016cdfe5a8581b989d4eb1829c39))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([035d2a4](https://github.com/Arggon/ArggonManager/commit/035d2a4b5603617d39086ac409138f125014cc4c))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([b96b526](https://github.com/Arggon/ArggonManager/commit/b96b526fd970380c9e7bf73f4476aad8c531b263))
* **tasks:** commented bug-release-proposal-non-lockstep-undetected ([56f3bce](https://github.com/Arggon/ArggonManager/commit/56f3bcec62914e9245d5fe2f4222e71b2e5d6e46))
* **tasks:** commented bug-skill-source-edit-leaves-ledger-stale ([f33459d](https://github.com/Arggon/ArggonManager/commit/f33459d5996f59407a61d22e797b89b058a48dee))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([87db3b2](https://github.com/Arggon/ArggonManager/commit/87db3b2e3b20155982b96beceac581e18bb27c04))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([7cb40df](https://github.com/Arggon/ArggonManager/commit/7cb40df597daa23604c2200d398b3204590be0db))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([4f0debc](https://github.com/Arggon/ArggonManager/commit/4f0debc8c9cf0eee95835bd394e983a7b5f83bbf))
* **tasks:** commented task-adopter-template-family-followups ([346165b](https://github.com/Arggon/ArggonManager/commit/346165bed08457a9fd2721c1bccc9d670c55fa6d))
* **tasks:** commented task-adopter-template-family-followups ([26288eb](https://github.com/Arggon/ArggonManager/commit/26288ebe8b8ec36ba42515713d61ed4eaaa1f081))
* **tasks:** commented task-adopter-template-family-followups ([0daf975](https://github.com/Arggon/ArggonManager/commit/0daf975a3e59048f25d2e2265d4d800e2fed77c4))
* **tasks:** commented task-adopter-template-family-followups ([e9b7e35](https://github.com/Arggon/ArggonManager/commit/e9b7e356c21be3d9bdf7da89d01c1ed3f92c9e1d))
* **tasks:** commented task-adopter-template-family-followups ([5ea30eb](https://github.com/Arggon/ArggonManager/commit/5ea30eba95d2eabd8c442da792c833d2e2277361))
* **tasks:** commented task-capability-matrix-followups-from-review ([38e8b25](https://github.com/Arggon/ArggonManager/commit/38e8b25ca8ebb1cd8e4c1ae13526d584d9e0f237))
* **tasks:** commented task-capability-matrix-followups-from-review ([e58193a](https://github.com/Arggon/ArggonManager/commit/e58193a22c7a245bf17e6a61d33f22830bc8bcc7))
* **tasks:** commented task-capability-matrix-followups-from-review ([c7ffacd](https://github.com/Arggon/ArggonManager/commit/c7ffacd1cc00d3088aaf177873194162631c0e99))
* **tasks:** commented task-convention-drift-guard-clarifications ([439acc4](https://github.com/Arggon/ArggonManager/commit/439acc41f6d8d3137afc456fa98ef700ba7f41d1))
* **tasks:** commented task-convention-drift-guard-clarifications ([cdc2ad9](https://github.com/Arggon/ArggonManager/commit/cdc2ad976f714ad5cdeec725399fdebc397a9392))
* **tasks:** commented task-convention-drift-guard-clarifications ([83789ba](https://github.com/Arggon/ArggonManager/commit/83789ba317af0d059200c890c6e4a70677b6552b))
* **tasks:** commented task-measure-kernel-refusal-rate ([f9b4dbc](https://github.com/Arggon/ArggonManager/commit/f9b4dbc8106ce28071735147def9ea09b56fcb29))
* **tasks:** commented task-opencode-event-panel ([5c14666](https://github.com/Arggon/ArggonManager/commit/5c146668214db0899c1e436b8d2230ad08c53a59))
* **tasks:** commented task-opencode-event-panel ([76c41d2](https://github.com/Arggon/ArggonManager/commit/76c41d2fdb4a6299a7ca701c5dae9ef1bd349bf4))
* **tasks:** commented task-opencode-event-panel ([3c696d6](https://github.com/Arggon/ArggonManager/commit/3c696d657ec8a853f206ace0ad59ce0d5e983eb2))
* **tasks:** commented task-state-exploration-stopping-rule ([a980b5c](https://github.com/Arggon/ArggonManager/commit/a980b5c9de185f29972e39a3d09ff7e536e1b4a4))
* **tasks:** commented task-state-exploration-stopping-rule ([afdadfb](https://github.com/Arggon/ArggonManager/commit/afdadfb891db73d6cc2ae29c1239c5dba92893b1))
* **tasks:** commented task-state-exploration-stopping-rule ([444c0ff](https://github.com/Arggon/ArggonManager/commit/444c0ffd1c84c0b03a520e01e142cf16f80669c4))
* **tasks:** commented task-state-exploration-stopping-rule ([30e9b97](https://github.com/Arggon/ArggonManager/commit/30e9b97710fa61f3414ab9ff2e755816ad91f85b))
* **tasks:** commented task-state-exploration-stopping-rule ([b926606](https://github.com/Arggon/ArggonManager/commit/b926606eb0546f4948c8ebec486638143be3fddc))
* **tasks:** commented task-state-exploration-stopping-rule ([44f12d0](https://github.com/Arggon/ArggonManager/commit/44f12d03dd8d0e672b666b8ca2a4c41788a85785))
* **tasks:** commented task-sweep-auto-done-refusal-warnings ([478ae74](https://github.com/Arggon/ArggonManager/commit/478ae74d45d366d2d5b0eccb5c2c921fe0a42601))
* **tasks:** commented task-sweep-auto-done-refusal-warnings ([848fd84](https://github.com/Arggon/ArggonManager/commit/848fd84ba5da1796a290ce760dfd9731998461d3))
* **tasks:** commented task-sweep-auto-done-refusal-warnings ([b783166](https://github.com/Arggon/ArggonManager/commit/b783166d399d345b974bc55fd840577890abeeaf))
* **tasks:** done task-sweep-auto-done-refusal-warnings ([aec4b71](https://github.com/Arggon/ArggonManager/commit/aec4b7121abe58b13d899e31d4257dde74225ed2))
* **tasks:** file wave-3 follow-ups (sweep substrate + retired role words) ([dbfc3e5](https://github.com/Arggon/ArggonManager/commit/dbfc3e5d99f4af142ab89353da54022fce2ef962))
* **tasks:** pruned bug-release-proposal-non-lockstep-undetected, task-adopter-template-family-followups, task-convention-drift-guard-clarifications ([23f9cc7](https://github.com/Arggon/ArggonManager/commit/23f9cc76bdc6451ac5eb246d57cd41afffe54cf6))
* **tasks:** pruned bug-verifier-cannot-read-the-tracker-no-allow-side, task-capability-matrix-followups-from-review, task-opencode-event-panel, task-state-exploration-stopping-rule ([8ebf160](https://github.com/Arggon/ArggonManager/commit/8ebf160cd1ebce95c713ef6756f0a4de417c82f8))
* **tasks:** pruned task-sweep-auto-done-refusal-warnings ([6a4f6c2](https://github.com/Arggon/ArggonManager/commit/6a4f6c2318b59fe2a6cc550220547d1a0734ff81))
* **tasks:** record released state on bug-release-proposal-non-lockstep-undetected ([3566fc5](https://github.com/Arggon/ArggonManager/commit/3566fc5164acf26d96d156c0dddbfdf995c9b0d5))
* **tasks:** strip leftover conflict markers on task-capability-matrix-followups-from-review ([978bc6c](https://github.com/Arggon/ArggonManager/commit/978bc6c468831d273d0404728f467fcffd13ed9c))
* **tasks:** tick acceptance checklist for task-state-exploration-stopping-rule ([cba3688](https://github.com/Arggon/ArggonManager/commit/cba3688af80f6e2871544acaf18daa7ba40f851a))
* **tasks:** tick acceptance on task-capability-matrix-followups-from-review ([15bf460](https://github.com/Arggon/ArggonManager/commit/15bf460d8a20733031b0f4b244a17d0ad758a664))
* **tasks:** tick acceptance on task-sweep-auto-done-refusal-warnings (lead merge verification; substrate follow-up filed) ([8c0eb9d](https://github.com/Arggon/ArggonManager/commit/8c0eb9dea4c1a3b3f03cb62d758db5d33e209d2a))
* **tasks:** tick the acceptance rows for task-adopter-template-family-followups ([d717241](https://github.com/Arggon/ArggonManager/commit/d7172414035e96b9923a3f569b592e792357cc7a))

## [0.8.0](https://github.com/Arggon/ArggonManager/compare/v0.7.1...v0.8.0) (2026-10-13)


### Added

* **init:** generate adapters/capability-matrix.json in adopter trees (task-matrix-reaches-adopters) ([7fe0e9b](https://github.com/Arggon/ArggonManager/commit/7fe0e9bb77ff72d17418e0f5ccf7728d50f58baa))
* **init:** ship adapters/capability-matrix.json to adopter trees (task-matrix-reaches-adopters) ([c1574da](https://github.com/Arggon/ArggonManager/commit/c1574daf1e322682b2690671572380c6ad1382e7))
* **opencode:** prompt-admission stamp + compaction retention T4 (task-opencode-prompt-stamp) ([8760414](https://github.com/Arggon/ArggonManager/commit/87604141932c3bc647232f1c475e1404de1b906c))


### Fixed

* **templates:** domain-neutral adopter doc templates + family drift guard (bug-adopter-engineering-template-software-locked) ([38b9142](https://github.com/Arggon/ArggonManager/commit/38b914263c79b3498eecf5e247c8e9908395f98f))


### Changed

* **adapters:** re-measure the doctor --agents sample (task-adapter-report-nits-from-review) ([29b083f](https://github.com/Arggon/ArggonManager/commit/29b083f6be3e9a80b0e7bf5d648c326f9b92e783))
* **adapters:** re-measure the doctor --agents sample against the live tree ([0bb45d6](https://github.com/Arggon/ArggonManager/commit/0bb45d642b11361a20c3f8ed5f6a2f1188de80d7))
* **adr:** accept ADR 0027 on landing (task-spike-cross-run-lesson-store) ([4d5b3c4](https://github.com/Arggon/ArggonManager/commit/4d5b3c4c70797ab22cea3efd5ecd362b7df41e11))
* **auto:** mark items done (PR [#758](https://github.com/Arggon/ArggonManager/issues/758) merged) ([#765](https://github.com/Arggon/ArggonManager/issues/765)) ([6990e55](https://github.com/Arggon/ArggonManager/commit/6990e55717c12ae276bb71e60220612aab03c6aa))
* **auto:** mark items done (PR [#759](https://github.com/Arggon/ArggonManager/issues/759) merged) ([#768](https://github.com/Arggon/ArggonManager/issues/768)) ([6a530dc](https://github.com/Arggon/ArggonManager/commit/6a530dc40eeaed23945055a10bf5cdeb7184f554))
* **auto:** mark items done (PR [#760](https://github.com/Arggon/ArggonManager/issues/760) merged) ([#767](https://github.com/Arggon/ArggonManager/issues/767)) ([4225038](https://github.com/Arggon/ArggonManager/commit/4225038ccd79edabb3e7e069c9c70bd96ab02b34))
* **auto:** mark items done (PR [#761](https://github.com/Arggon/ArggonManager/issues/761) merged) ([#769](https://github.com/Arggon/ArggonManager/issues/769)) ([3637ff7](https://github.com/Arggon/ArggonManager/commit/3637ff738cd46141bf1b9578b90b28ada5f86239))
* **auto:** mark items done (PR [#762](https://github.com/Arggon/ArggonManager/issues/762) merged) ([#766](https://github.com/Arggon/ArggonManager/issues/766)) ([cde862e](https://github.com/Arggon/ArggonManager/commit/cde862e7b15b809a37088ed4a620ed4fa8e80846))
* **release:** 0.8.0 ([7d972ed](https://github.com/Arggon/ArggonManager/commit/7d972ed5c97e5ec8bb5e46081c78756365e90f03))
* **spike:** cross-run lesson store — no store, promote into existing carriers (task-spike-cross-run-lesson-store) ([f01c1ed](https://github.com/Arggon/ArggonManager/commit/f01c1eddf40ad3976a343833a67de5fa0b9d06d1))
* **spike:** decide the cross-run lesson store — promote into existing carriers ([ecf4bc2](https://github.com/Arggon/ArggonManager/commit/ecf4bc259dba1249239d5f1f1a0e374ef2d9092a))
* **tasks:** claimed task-matrix-reaches-adopters ([57d1098](https://github.com/Arggon/ArggonManager/commit/57d109841c46b6817ba3e9bf9b3b0aad7c09a610))
* **tasks:** claimed task-spike-cross-run-lesson-store ([ddf23f1](https://github.com/Arggon/ArggonManager/commit/ddf23f104bdd17c23cf466cafff8d9da17ca25b9))
* **tasks:** commented bug-adopter-engineering-template-software-locked ([78f94c3](https://github.com/Arggon/ArggonManager/commit/78f94c3dc65dd1c9877822cdbe3a4c42b96627d7))
* **tasks:** commented bug-x-tracker-option-list-has-no-doc-drift-guard ([3290b89](https://github.com/Arggon/ArggonManager/commit/3290b899a337bb1c946a87a223e52b2ee3324e56))
* **tasks:** commented task-adapter-report-nits-from-review ([ba8c80c](https://github.com/Arggon/ArggonManager/commit/ba8c80c28a85862f48f11702d3789945a27a2389))
* **tasks:** commented task-adapter-report-nits-from-review ([d770775](https://github.com/Arggon/ArggonManager/commit/d770775fe4ddaab2b3d68775f798640605765828))
* **tasks:** commented task-adapter-report-nits-from-review ([346c78b](https://github.com/Arggon/ArggonManager/commit/346c78b08f41dbb991552a18b8b24a4eee80ec28))
* **tasks:** commented task-matrix-reaches-adopters ([fed486d](https://github.com/Arggon/ArggonManager/commit/fed486d6fd32da820ac3ac8325a9868f39266a03))
* **tasks:** commented task-matrix-reaches-adopters ([31729ac](https://github.com/Arggon/ArggonManager/commit/31729aca845942d65bacd32d5e0446a3e4cf9ba8))
* **tasks:** commented task-matrix-reaches-adopters ([6885b7b](https://github.com/Arggon/ArggonManager/commit/6885b7b58a49b6360c32e72742240dfbb3731d4b))
* **tasks:** commented task-opencode-prompt-stamp ([98db591](https://github.com/Arggon/ArggonManager/commit/98db59151d1284173d04c1a795bb604c6e491aeb))
* **tasks:** commented task-spike-cross-run-lesson-store ([e542058](https://github.com/Arggon/ArggonManager/commit/e542058cbebc890714c3e0168ef2ec34a73f2d1a))
* **tasks:** commented task-spike-cross-run-lesson-store ([445da38](https://github.com/Arggon/ArggonManager/commit/445da38f1e742003f147f7fc9e3d904f058adc8a))
* **tasks:** commented task-spike-cross-run-lesson-store ([5dd2081](https://github.com/Arggon/ArggonManager/commit/5dd20811a4a3e8f67c5beae81e6c834c6752e755))
* **tasks:** done task-matrix-reaches-adopters ([30c7dba](https://github.com/Arggon/ArggonManager/commit/30c7dbae135e08d56a0b71a945c4f35513aed2a9))
* **tasks:** file bug-kernel-pin-never-exact (context + acceptance) ([aec131e](https://github.com/Arggon/ArggonManager/commit/aec131ef292244433277d6cad0ff6c0a609205b0))
* **tasks:** file bug-release-proposal-non-lockstep-undetected (context + acceptance) ([5dd585e](https://github.com/Arggon/ArggonManager/commit/5dd585e0dcb74f8ed948c8ab0954a19df4048dd5))
* **tasks:** file wave-1 review follow-ups (8 items) under methodology-productization ([fdca507](https://github.com/Arggon/ArggonManager/commit/fdca5070386905ca7f0908987a0cae7c9b44f6a1))
* **tasks:** pruned bug-adopter-engineering-template-software-locked, bug-x-tracker-option-list-has-no-doc-drift-guard, task-adapter-report-nits-from-review, task-matrix-reaches-adopters, task-opencode-prompt-stamp, task-spike-cross-run-lesson-store ([06f0faf](https://github.com/Arggon/ArggonManager/commit/06f0faffd29b99d73420dd0cea550f9e9c537be0))
* **tasks:** tick acceptance on task-matrix-reaches-adopters (lead merge verification) ([654c055](https://github.com/Arggon/ArggonManager/commit/654c055f93746e4ec7a9dafa0003d3dfe9922c7e))

## [Unreleased]

### Changed

- **templates:** restate the adopter doc templates as what the project declares — the software case survives as a clearly-marked worked example, and every bar keeps its teeth (blocking, evidenced, owned) (bug-adopter-engineering-template-software-locked)
- **templates:** `docs/docs/convention.md` carries the two-axis rule (work-loop parity AND authority asymmetric and named) instead of the superseded parity sentence, and both it and `docs/docs/engineering.md` carry the carriers' byte-identical `- **Invariants:**` block
- **templates:** `AGENTS.md` names the shipped **delivery lead** role instead of the pre-rename "coordinator", and points at the carrier that declares the invariants (the 2 KB context budget rules out carrying the block inline)

### Fixed

- **test:** drift-guard the adopter template family against the carriers' invariant block, so a template that regains the superseded parity sentence, a retired agent id or the pre-rename role word — or that diverges from the carriers' `- **Invariants:**` / `- **Scope:**` statements — fails the suite instead of shipping green (cli/src/adopter-template-invariant-drift.test.ts)

### Adopter upgrade channel (ADR 0016)

**Methodology-affecting: this change corrects templates `arggon init` writes into every adopting repo.**

`init` **never overwrites an existing file**, and an `acknowledged` (`arggon adopt --ack`) or hand-edited generated doc is **skipped** on every re-run. So the corrected templates reach **new** trees only; an existing adopter's copies are untouched, and a corrected rule never reaches them by itself. Adopters must reconcile their own copies:

1. `arggon doctor` reports the `outdated` bucket — every managed doc whose current template render differs from what is on disk.
2. `arggon init --dry-run` previews the per-destination decision (`created` / `would-update` / `modified-skip` / `acked-skip`) without writing.
3. `arggon init --propose` writes the new render **beside** the original as `<dest>.proposed-<version>` (whole-file, or section-level with `spec-propose-section-backports-007`); absorb it as a normal work item and re-ack the merged result with `arggon adopt --ack`.

**`init --propose` is the intended carrier for this change and needs no new flag.** Every destination affected here — `AGENTS.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md` — is exactly an acked-or-modified doc in a fully adopted tree, which is the case `--propose` exists for. Nothing was added to `init` itself: the never-overwrite promise binds the fix exactly as it binds every other template change.

## [0.7.1](https://github.com/Arggon/ArggonManager/compare/v0.7.0...v0.7.1) (2026-10-13)


### Fixed

* **cleanup:** honest removal blockers + a force opt-in for prune (bug-cleanup-prune-untracked-artifacts-no-force) ([42e423d](https://github.com/Arggon/ArggonManager/commit/42e423db3c0fe8f7eb6edd25641e6f883781070a))
* **cleanup:** honest removal blockers + a force opt-in for prune (bug-cleanup-prune-untracked-artifacts-no-force) ([609266d](https://github.com/Arggon/ArggonManager/commit/609266d97981b1e6f053270ed53e996344e62bcc))
* **release:** verify each flipped label per PR, not via the lagging search index ([170b345](https://github.com/Arggon/ArggonManager/commit/170b345de804cc4f7be39c657984cf54be3e6b9a))
* **release:** verify each flipped label per PR, not via the lagging search index ([8bdbbcc](https://github.com/Arggon/ArggonManager/commit/8bdbbccf239d9b11492347be4fd9263505f880eb))


### Changed

* **auto:** mark items done (PR [#750](https://github.com/Arggon/ArggonManager/issues/750) merged) ([#755](https://github.com/Arggon/ArggonManager/issues/755)) ([d970803](https://github.com/Arggon/ArggonManager/commit/d97080360e5be0a22d826b67113c073237cd5b6c))
* **auto:** mark items done (PR [#751](https://github.com/Arggon/ArggonManager/issues/751) merged) ([#752](https://github.com/Arggon/ArggonManager/issues/752)) ([ac32ccf](https://github.com/Arggon/ArggonManager/commit/ac32ccf25b666fac82ce2c7bb163c3203f401654))
* **auto:** mark items done (PR [#753](https://github.com/Arggon/ArggonManager/issues/753) merged) ([#756](https://github.com/Arggon/ArggonManager/issues/756)) ([d4078a4](https://github.com/Arggon/ArggonManager/commit/d4078a42ab6c0f7fae0282f333c67f58c92db808))
* **auto:** mark items done (PR [#754](https://github.com/Arggon/ArggonManager/issues/754) merged) ([#757](https://github.com/Arggon/ArggonManager/issues/757)) ([fa97520](https://github.com/Arggon/ArggonManager/commit/fa9752078cde94e908caa584fed5959e832ed4ac))
* **cleanup:** correct the force-parameter carriers (bug-cleanup-prune-untracked-artifacts-no-force) ([9dae1a8](https://github.com/Arggon/ArggonManager/commit/9dae1a8a8c344716782cd853beb5eda0785a5c60))
* **deps-dev:** bump source-map-js from 1.2.1 to 1.2.2 ([#657](https://github.com/Arggon/ArggonManager/issues/657)) ([7ff0db3](https://github.com/Arggon/ArggonManager/commit/7ff0db3244545fe0deb1a4933f79fd9cb3081b6c))
* **eng:** correct auto-merge re-strand and merge-queue availability (task-merge-ergonomics-branch-updates) ([d069441](https://github.com/Arggon/ArggonManager/commit/d069441413a78388a5766f11a1a7ef5d721a34b8))
* **eng:** document the PR staleness refresh flow (task-merge-ergonomics-branch-updates) ([074addb](https://github.com/Arggon/ArggonManager/commit/074addbe29b71f6484706b49f5b48f3757a41d79))
* **eng:** document the PR staleness refresh flow (task-merge-ergonomics-branch-updates) ([6f6b3f8](https://github.com/Arggon/ArggonManager/commit/6f6b3f814c8a44d5615cf4828d9eedc0751ba5df))
* **release:** re-pin ARGGON_VERSION to 0.7.0 + regenerate the seam (release.md, The re-pin) ([5520c22](https://github.com/Arggon/ArggonManager/commit/5520c227414a5d6d23949b52f03250fca528d116))
* **seam:** correct box-4 precision sentence to the pinned discovery behavior (task-seam-footprint-config-inline-evaluation) ([e899cba](https://github.com/Arggon/ArggonManager/commit/e899cba4c15bb708bd857c8ade64959c70c028e0))
* **seam:** evaluate config-inline options; ignore machine-local .opencode artifacts (task-seam-footprint-config-inline-evaluation) ([9c11c93](https://github.com/Arggon/ArggonManager/commit/9c11c930174bcc6a448a7486c0f9a1197f316b30))
* **seam:** evaluate config-inline options; ignore machine-local .opencode artifacts (task-seam-footprint-config-inline-evaluation) ([42ab774](https://github.com/Arggon/ArggonManager/commit/42ab774cc6b830cbfba07cf2908316e29c9f31de))
* **seam:** re-record the json-contract skill copy checksum (source edited in [#751](https://github.com/Arggon/ArggonManager/issues/751); sync never updates the ledger) ([fd581f9](https://github.com/Arggon/ArggonManager/commit/fd581f9ae947cdd54c334215a32d5c414a75db3a))
* **seam:** restate inlining option in V2 shapes; record alias/drop probes (task-seam-footprint-config-inline-evaluation) ([0b5cf8b](https://github.com/Arggon/ArggonManager/commit/0b5cf8ba0f707ccd0428cd74a78d29e829d720ec))
* **tasks:** acceptance + evidence for bug-cleanup-prune-untracked-artifacts-no-force ([7fa4ce4](https://github.com/Arggon/ArggonManager/commit/7fa4ce45615d30fc7542938f800f884f63a7acba))
* **tasks:** claimed bug-cleanup-prune-untracked-artifacts-no-force ([9402b99](https://github.com/Arggon/ArggonManager/commit/9402b99419e3a0c8c2db8979d424331a23827e2d))
* **tasks:** claimed bug-release-label-flip-verification-index-lag ([de9eeeb](https://github.com/Arggon/ArggonManager/commit/de9eeeb8c55ec36b313db70cd8783901e982a96c))
* **tasks:** claimed task-merge-ergonomics-branch-updates ([bf8ea53](https://github.com/Arggon/ArggonManager/commit/bf8ea532f449b1a5fe3a51c00b9b0145f6a52fa8))
* **tasks:** claimed task-seam-footprint-config-inline-evaluation ([d296c32](https://github.com/Arggon/ArggonManager/commit/d296c32e77122958fa75a5c3c7fa150d37fe6c60))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([f7af94f](https://github.com/Arggon/ArggonManager/commit/f7af94f69cee872ffb6d4596920455e9de0606d0))
* **tasks:** commented bug-cleanup-prune-untracked-artifacts-no-force ([e67596f](https://github.com/Arggon/ArggonManager/commit/e67596f9000d9aa7790289a81358bce18329983d))
* **tasks:** commented bug-cleanup-prune-untracked-artifacts-no-force ([c6c7796](https://github.com/Arggon/ArggonManager/commit/c6c7796923cde3f5400ed6dccb69fc96ca2d857f))
* **tasks:** commented bug-native-guard-silent-without-worktree-declaration ([8ad8810](https://github.com/Arggon/ArggonManager/commit/8ad8810b62d0e8ca7b4bacec076c17e5db84a925))
* **tasks:** commented bug-release-label-flip-verification-index-lag ([04f996e](https://github.com/Arggon/ArggonManager/commit/04f996ed6666ef3509ed54af1db5539282f19a79))
* **tasks:** commented bug-release-label-flip-verification-index-lag ([2459b66](https://github.com/Arggon/ArggonManager/commit/2459b662b2ead85ed5614d09edf4e9c5df0b31ed))
* **tasks:** commented bug-release-label-flip-verification-index-lag ([a9fdd3d](https://github.com/Arggon/ArggonManager/commit/a9fdd3d87d34c9c1ef33d0950bbd1037e0dc26fd))
* **tasks:** commented bug-release-label-flip-verification-index-lag ([52b24ce](https://github.com/Arggon/ArggonManager/commit/52b24ce55012cfb57ff59419bfebab9b15fa4814))
* **tasks:** commented task-merge-ergonomics-branch-updates ([e683229](https://github.com/Arggon/ArggonManager/commit/e683229be7e63288a2494b4b1603d9681c7ab3b0))
* **tasks:** commented task-merge-ergonomics-branch-updates ([1ff607c](https://github.com/Arggon/ArggonManager/commit/1ff607c1cab8a124e689d05af24ac5a105eb3495))
* **tasks:** commented task-merge-ergonomics-branch-updates ([9abb950](https://github.com/Arggon/ArggonManager/commit/9abb950f3dfc220448b7e22ac72acfe1b78f0c24))
* **tasks:** commented task-merge-ergonomics-branch-updates ([cc90d89](https://github.com/Arggon/ArggonManager/commit/cc90d89614e5bcb63eeac9b0c2b3321908ed0b61))
* **tasks:** commented task-merge-ergonomics-branch-updates ([05edfb0](https://github.com/Arggon/ArggonManager/commit/05edfb09cc90e029097768078fcc9b148bb54fad))
* **tasks:** commented task-merge-ergonomics-branch-updates ([def69dd](https://github.com/Arggon/ArggonManager/commit/def69ddb071d18b4fe455378601864e9653bac1d))
* **tasks:** commented task-merge-ergonomics-branch-updates ([7bac35b](https://github.com/Arggon/ArggonManager/commit/7bac35bb9d0485a42606f5588d50dc408df87423))
* **tasks:** commented task-merge-ergonomics-branch-updates ([486206f](https://github.com/Arggon/ArggonManager/commit/486206f2c8ee5abb99b8f56aeffec7078cf50c15))
* **tasks:** commented task-merge-queue-availability-unrecorded ([c89259a](https://github.com/Arggon/ArggonManager/commit/c89259ab6bebd04c5fdecb0ef5c20654d7858a7b))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([4686a8e](https://github.com/Arggon/ArggonManager/commit/4686a8eadfd1f9752eb6f3714943e16262bbe0e9))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([d910673](https://github.com/Arggon/ArggonManager/commit/d9106731a6614a48049df5477f55ffeb242e93a6))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([2e0edf8](https://github.com/Arggon/ArggonManager/commit/2e0edf8e41fc1bb8329a89bb0711cb78b2643b80))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([ef44c61](https://github.com/Arggon/ArggonManager/commit/ef44c6162509dd2fbef8f2c572295d5b4d434c6c))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([fad59fb](https://github.com/Arggon/ArggonManager/commit/fad59fb83c728e29ef45f46ac1bc0f6b0768d6ba))
* **tasks:** commented task-seam-footprint-config-inline-evaluation ([f16878e](https://github.com/Arggon/ArggonManager/commit/f16878e6c2af157b3fb56e98d818a1d3f961b989))
* **tasks:** correct the budget-gate citations for bug-cleanup-prune-untracked-artifacts-no-force ([b8c7af9](https://github.com/Arggon/ArggonManager/commit/b8c7af981f6056cf07cf9c00ebbac5c6001b62fc))
* **tasks:** created bug-cleanup-prune-untracked-artifacts-no-force ([db68fba](https://github.com/Arggon/ArggonManager/commit/db68fba5096385626b645198760407fcd889775a))
* **tasks:** created bug-release-label-flip-verification-index-lag ([64801f4](https://github.com/Arggon/ArggonManager/commit/64801f4398206d57b54487e08c809cf9471628f8))
* **tasks:** created task-cleanup-probe-degradation-honesty ([f9f6f48](https://github.com/Arggon/ArggonManager/commit/f9f6f48abd434acb87f2b7fc2b7a010347d72d72))
* **tasks:** created task-merge-ergonomics-branch-updates ([2851212](https://github.com/Arggon/ArggonManager/commit/285121246126ec92cd19b9198c8250e754caa142))
* **tasks:** created task-merge-queue-availability-unrecorded ([a70fcbe](https://github.com/Arggon/ArggonManager/commit/a70fcbe3d3fbf08573692511da7f6499be411a65))
* **tasks:** created task-schema-budgets-near-exhaustion ([8d665e3](https://github.com/Arggon/ArggonManager/commit/8d665e382df1c387fb9349cc944316e0629ff391))
* **tasks:** created task-seam-footprint-config-inline-evaluation ([722ca0b](https://github.com/Arggon/ArggonManager/commit/722ca0bc811d7955a57bae76599d7763fc897981))
* **tasks:** created task-seam-nits-v1-schema-and-marker ([7fe8baf](https://github.com/Arggon/ArggonManager/commit/7fe8bafa0a516f6469a03975087931a339a73064))
* **tasks:** created task-tracker-append-shape-not-prettier-clean ([c631421](https://github.com/Arggon/ArggonManager/commit/c6314216051faab8945e7078190fae457bb4e028))
* **tasks:** handoff for bug-cleanup-prune-untracked-artifacts-no-force ([b9e088b](https://github.com/Arggon/ArggonManager/commit/b9e088bd3442bf45f3b9b0dc4e0cac168521c09b))
* **tasks:** pruned bug-cleanup-prune-untracked-artifacts-no-force, bug-release-label-flip-verification-index-lag, task-merge-ergonomics-branch-updates ([2012a16](https://github.com/Arggon/ArggonManager/commit/2012a16dbd7e5c8217b8d7fcc30a86f4910b3d41))
* **tasks:** pruned task-seam-footprint-config-inline-evaluation ([33e9001](https://github.com/Arggon/ArggonManager/commit/33e9001d832c021bbc68349a6a4c986b209f878a))
* **tasks:** review response for bug-cleanup-prune-untracked-artifacts-no-force ([e912c25](https://github.com/Arggon/ArggonManager/commit/e912c2560fdb74b2139fd1e00cb11faca5f0220e))
* **tracker:** context + acceptance for 3 review follow-ups (seam nits, tracker append shape, merge-queue constraint) ([8bba60b](https://github.com/Arggon/ArggonManager/commit/8bba60be7dcdfee881cf60a3c45df193dd9a7b2c))
* **tracker:** context + acceptance for 4 improvement findings (merge ergonomics, cleanup force, flip verification lag, seam footprint) ([52be821](https://github.com/Arggon/ArggonManager/commit/52be8213f09deed921cb1941a25279e6562bfa84))
* **tracker:** context + acceptance for cleanup probe-degradation honesty (N1 follow-up) ([76cd7fc](https://github.com/Arggon/ArggonManager/commit/76cd7fc4bc1f0e839174b044b47dc88c84e20582))
* **tracker:** context + acceptance for schema-budget near-exhaustion; fix measurement citation ([1ac2029](https://github.com/Arggon/ArggonManager/commit/1ac2029bc117bd0569ab76e08b282d8f4f1830d3))
* **tracker:** context + acceptance for the skill-source/ledger staleness bug ([bb9511a](https://github.com/Arggon/ArggonManager/commit/bb9511a22c0aa27607ec3246efd6d77260793a67))
* **tracker:** make the flip-lag acceptance offline-provable (live re-check is opportunistic) ([1bf36bc](https://github.com/Arggon/ArggonManager/commit/1bf36bccf6232299ed1b8768d5cc30f5783f5947))
* **tracker:** note the re-pin interaction on the ledger-staleness bug ([a2d26b7](https://github.com/Arggon/ArggonManager/commit/a2d26b762b49800a73a9837da634e3b1e57c46d3))

## [0.7.0](https://github.com/Arggon/ArggonManager/compare/v0.6.0...v0.7.0) (2026-10-12)


### Added

* **board:** link parent and list children in detail drawer ([3294f22](https://github.com/Arggon/ArggonManager/commit/3294f22fafc763a2e3bddd9cf4cff75e31e4e1df))
* **claude-adapter:** write the story body close the last acceptance box ([9ab03e3](https://github.com/Arggon/ArggonManager/commit/9ab03e3fbdbf265dabdcdc79b20bdff0afaec463))
* **friction:** arggon friction --report — fingerprint dedupe + report renderer (task-friction-dedupe-and-report) ([#712](https://github.com/Arggon/ArggonManager/issues/712)) ([4339e12](https://github.com/Arggon/ArggonManager/commit/4339e129a12868f01575d4728f3783312484fa19))
* **friction:** arggon friction capture and the local friction log (task-friction-capture-command) ([#695](https://github.com/Arggon/ArggonManager/issues/695)) ([c6acbfe](https://github.com/Arggon/ArggonManager/commit/c6acbfe9046de299e9b1b0e39e7977b2a770210a))
* **friction:** length-prefix the fingerprint pre-image (task-friction-fingerprint-separator-not-length-prefixed) ([#704](https://github.com/Arggon/ArggonManager/issues/704)) ([949d3e7](https://github.com/Arggon/ArggonManager/commit/949d3e784637d62cf35e27fce29fd90388b505ea))
* **friction:** redact friction records at write time, never at render (task-friction-redaction-at-write) ([#701](https://github.com/Arggon/ArggonManager/issues/701)) ([d5d5482](https://github.com/Arggon/ArggonManager/commit/d5d5482d54dd3665ccae25dc7baff66c39e147de))
* **friction:** tier-B prefilled publish URL, opt-out keys and --clear (task-friction-tier-b-url-and-optout) ([#724](https://github.com/Arggon/ArggonManager/issues/724)) ([7ec26dc](https://github.com/Arggon/ArggonManager/commit/7ec26dc3c42c4668b532a6bf34b66a7325b5db31))
* **panel:** parent and children navigation in OpenCode board panel (task-native-panel-hierarchy-links) ([b139246](https://github.com/Arggon/ArggonManager/commit/b139246ced3d3f7f54f50edfd27608db5943738e))
* **task-native-panel-hierarchy-links:** panel parent/children keyboard navigation ([04fe0ac](https://github.com/Arggon/ArggonManager/commit/04fe0ac584e242983bec61b6ed4d25940f5bc858))
* **task-tui-hierarchy-jump:** detail-pane parent jump and children listing ([73eda15](https://github.com/Arggon/ArggonManager/commit/73eda15111a008003298b82b5cc62b75362ff350))
* **task-validate-refuses-placeholder-bodies:** validate refuses placeholder bodies (blocking, decided A) ([ca46779](https://github.com/Arggon/ArggonManager/commit/ca467791b7b54d21608e391540be0f705f34513a))
* **task-web-board-hierarchy-links:** drawer parent link + children section ([12d84c1](https://github.com/Arggon/ArggonManager/commit/12d84c11a6d61b42e66e515b96d459f6ed62e50b))
* **tui:** detail-pane parent jump and children listing (task-tui-hierarchy-jump) ([dedb83c](https://github.com/Arggon/ArggonManager/commit/dedb83cea3eda606db691e75d73c3c0ddc76008e))
* **validate:** refuse placeholder bodies on open items (decided A, PLACEHOLDER_BODY) ([d7a7cee](https://github.com/Arggon/ArggonManager/commit/d7a7cee83d4124dc01df0b3390233ece1234e364))
* **zcode:** opt-in automation templates — daily spec-drift scan, weekly stale-claim sweep (task-zcode-automations) ([8fb0914](https://github.com/Arggon/ArggonManager/commit/8fb091444c0c662737aaca35d904171e0599361c))
* **zcode:** opt-in automation templates — spec-drift scan, stale-claim sweep (task-zcode-automations) ([fb9667f](https://github.com/Arggon/ArggonManager/commit/fb9667f8dd91064f93ca16fbc7d7c506eb6d71d6))


### Fixed

* **arggon:** declare the claim footprint for unsourced sessions (bug-native-guard-silent-without-worktree-declaration) ([fe0b9c8](https://github.com/Arggon/ArggonManager/commit/fe0b9c85501b3b547e55b80472b88b5e7001c606))
* **arggon:** declare the claim footprint for unsourced sessions (bug-native-guard-silent-without-worktree-declaration) ([5b37879](https://github.com/Arggon/ArggonManager/commit/5b378791b9ec3ddb62b4132e62496a11bca2b07b))
* **bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes:** gate deny-patterns match command words, not quoted text ([861cff8](https://github.com/Arggon/ArggonManager/commit/861cff8a810fa8cbc3788b8cffe85c671c232f11))
* **bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes:** gate deny-patterns match command words, not quoted text ([db9117d](https://github.com/Arggon/ArggonManager/commit/db9117d50ecfa682f3ea806bfadaa4495386d67a))
* **bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes:** review — unanchor the executed-quoted-text matcher, record the indirection residual ([b97f583](https://github.com/Arggon/ArggonManager/commit/b97f58346925b191d959ccb2e8445e6ece3ef3ba))
* **bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes:** review round 2 — payload flag may combine c with other shorts (bash -lc, sh -ec) ([da41cb7](https://github.com/Arggon/ArggonManager/commit/da41cb7863ac0cecaa16a70a89a5cc0ee02a7ba7))
* **bug-skill-exploration-reference-fails-prettier:** format exploration.md reference to pass prettier --check ([3fc0ccb](https://github.com/Arggon/ArggonManager/commit/3fc0ccb6095897910074c951557c8d28a1eaf7a1))
* **ci:** correct the lockfile-sync step's first-failure provenance ([3d2d64b](https://github.com/Arggon/ArggonManager/commit/3d2d64b1151904a8d6774975c83087f41605da35))
* **ci:** gate the release-please config against the tags release.yml creates ([306e2a6](https://github.com/Arggon/ArggonManager/commit/306e2a625469108ad0a25edd06c5701bb88720ae))
* **ci:** gate the release-please config against the tags release.yml creates ([37cbfba](https://github.com/Arggon/ArggonManager/commit/37cbfba5564998402dff6e6d8135ec7a8b2f438d))
* **ci:** name the paired implementation+test deletion, the shape that goes green (bug-no-gate-warns-on-paired-impl-and-test-deletion) ([#705](https://github.com/Arggon/ArggonManager/issues/705)) ([73fea71](https://github.com/Arggon/ArggonManager/commit/73fea71d62722fcf9ad888a3275019043878f031))
* **ci:** stage package-lock.json before the release-PR sync commit ([774eacf](https://github.com/Arggon/ArggonManager/commit/774eacfb77080e1e2fea1c80647686f692d7fb5c))
* **ci:** stage package-lock.json before the release-PR sync commit (bug-release-lockfile-sync-step-cannot-run) ([42048bf](https://github.com/Arggon/ArggonManager/commit/42048bf8ddad6363d99aff8d60a5e8fb9116eb4b))
* **ci:** sync the release PR lockfile with --ignore-scripts ([25ffddf](https://github.com/Arggon/ArggonManager/commit/25ffddfbe59ff5b6639715ea5c393c0aafa52a25))
* **ci:** sync the release PR lockfile with --ignore-scripts (bug-release-lockfile-sync-step-cannot-run) ([a27cd83](https://github.com/Arggon/ArggonManager/commit/a27cd83ae82e2b0e5130c3f05598a71df9415736))
* **cli:** preserve x-* extensions on init --force ([9d4413f](https://github.com/Arggon/ArggonManager/commit/9d4413f2d84e9ac195743dc67822230dde44062e))
* **cli:** preserve x-* extensions on init --force (bug-init-force-drops-x-tracker-block) ([3c7e62d](https://github.com/Arggon/ArggonManager/commit/3c7e62d53c24b0a0e12986186cd4523de6517bb9))
* **cli:** surface the convention keep/replace report on init's apply path ([1846379](https://github.com/Arggon/ArggonManager/commit/184637987088d5ca1cfb35578ec352e1ac02d04a))
* **cli:** widen ADR link-resolution rule to all three methodology carriers (bug-convention-md-links-nonexistent-adr-0015) ([#722](https://github.com/Arggon/ArggonManager/issues/722)) ([3aa706e](https://github.com/Arggon/ArggonManager/commit/3aa706e81c939544e2370afa14eebb4b7fc7a26c))
* **convention:** read the YAML an adopter writes, so `init --force` stops re-deriving it ([e0abb48](https://github.com/Arggon/ArggonManager/commit/e0abb489cbe5c97d5481258ed10968495ca4e7d8))
* **convention:** read the YAML an adopter writes, so `init --force` stops re-deriving it (bug-convention-parser-rejects-valid-yaml-force-rescaffolds) ([7b0343b](https://github.com/Arggon/ArggonManager/commit/7b0343b26408c9c72a6d2d93b67d4234becbc694))
* **done-gate:** exclude fenced code blocks from the acceptance scan (bug-done-gate-whole-body-scan-counts-fenced-repro-boxes) ([#713](https://github.com/Arggon/ArggonManager/issues/713)) ([1ff4ffa](https://github.com/Arggon/ArggonManager/commit/1ff4ffa20b62e639bcbdaba4e7fdb24310c18409))
* **plugin:** raise the bundle byte bound to 640 KiB past the friction chain (task-plugin-bundle-near-byte-ceiling) ([#716](https://github.com/Arggon/ArggonManager/issues/716)) ([81969cd](https://github.com/Arggon/ArggonManager/commit/81969cd86685673244b5773be28e565937847fc5))
* **release:** guard renderPending + correct the label-permission citation (bug-autorelease-label-lifecycle-unowned) ([cee4905](https://github.com/Arggon/ArggonManager/commit/cee4905afa4a25a16a273552a0a9374b5d642993))
* **release:** release.yml owns the autorelease label flip (bug-autorelease-label-lifecycle-unowned) ([3780327](https://github.com/Arggon/ArggonManager/commit/3780327e62c33a9c7f88dafa407c2bfeb01b3b72))
* **release:** release.yml owns the autorelease label flip (bug-autorelease-label-lifecycle-unowned) ([c67b26c](https://github.com/Arggon/ArggonManager/commit/c67b26cc304f129027a1c5a756c614b815f2c7a6))
* **release:** self-describing ENEEDAUTH on the release publish failure path (bug-release-needs-auth-self-describing) ([390768d](https://github.com/Arggon/ArggonManager/commit/390768dafedc4a35f722214a34aee2993ef86f42))
* **release:** self-describing ENEEDAUTH on the release publish failure path (bug-release-needs-auth-self-describing) ([3dba490](https://github.com/Arggon/ArggonManager/commit/3dba490ce8b2512d1afbb07eb8d47ece78f738ec))
* **seam:** audit the provenance ledger against the committed seam bytes; repair the goal-mode records (bug-stale-x-generated-records-goal-mode-seam-pair) ([2778e22](https://github.com/Arggon/ArggonManager/commit/2778e22eec3f793c16ac824fbdc5e014c4aa4cbe))
* **seam:** repair the goal-mode provenance records + audit the ledger against the committed seam bytes (bug-stale-x-generated-records-goal-mode-seam-pair) ([0c3003c](https://github.com/Arggon/ArggonManager/commit/0c3003c428146399b71662f1ec662574318fcb6e))
* **spec:** spec-deps-022 publishes its error/failure path (task-spec-deps-022-no-error-path) ([#686](https://github.com/Arggon/ArggonManager/issues/686)) ([46549ff](https://github.com/Arggon/ArggonManager/commit/46549ff126afc83a652bccddcf734a71e2c75709))
* task-stale-citations-to-renumbered-doc-stems — update stale citations to the 5 renumbered doc stems ([#688](https://github.com/Arggon/ArggonManager/issues/688)) ([decdbce](https://github.com/Arggon/ArggonManager/commit/decdbce692fa417ca52b77303b10c36bcf05edde))
* **validate-placeholder:** hoist seed leaf to module scope (lint unused-var + 3 failing refs) ([c778b7c](https://github.com/Arggon/ArggonManager/commit/c778b7c21155b4559f06b9ba37f2f8ca05adaadc))
* **zcode:** keep every code span on one line in the automation contracts (task-zcode-automations) ([68ce5f7](https://github.com/Arggon/ArggonManager/commit/68ce5f70fc4c04bad88e825057cb1fa848eb7be7))
* **zcode:** parseable no-story fallback in the spec-drift scan contract (task-zcode-automations) ([8d952b3](https://github.com/Arggon/ArggonManager/commit/8d952b37d010feefbef2506a2c718c2fbc914d33))


### Changed

* **adr:** mark 0022/0023/0025 Accepted and make the flip ride the landing commit ([97a6a6d](https://github.com/Arggon/ArggonManager/commit/97a6a6d007e02de59e88ec92a66cbe13e491e24a))
* **adr:** mark 0022/0023/0025 Accepted, and make the status flip ride the landing commit (bug-adr-status-drift-merged-adr-proposed) ([7765b11](https://github.com/Arggon/ArggonManager/commit/7765b11c4ee5d31060a4b8af3023bdb3a74c1b4b))
* **auto:** mark items done (PR [#670](https://github.com/Arggon/ArggonManager/issues/670) merged) ([#672](https://github.com/Arggon/ArggonManager/issues/672)) ([351dcc5](https://github.com/Arggon/ArggonManager/commit/351dcc52ad4faae670b017ddf728cbe7962ccb04))
* **auto:** mark items done (PR [#673](https://github.com/Arggon/ArggonManager/issues/673) merged) ([#674](https://github.com/Arggon/ArggonManager/issues/674)) ([71d0d45](https://github.com/Arggon/ArggonManager/commit/71d0d458b3a763545b8a7b0e579a742436733b3d))
* **auto:** mark items done (PR [#675](https://github.com/Arggon/ArggonManager/issues/675) merged) ([#676](https://github.com/Arggon/ArggonManager/issues/676)) ([5f10ea6](https://github.com/Arggon/ArggonManager/commit/5f10ea65e94b103da967f261123c70fe2dec634f))
* **auto:** mark items done (PR [#680](https://github.com/Arggon/ArggonManager/issues/680) merged) ([#684](https://github.com/Arggon/ArggonManager/issues/684)) ([dd48bb4](https://github.com/Arggon/ArggonManager/commit/dd48bb45f36e812bd7e2eb7cbaf75c508c6805bd))
* **auto:** mark items done (PR [#681](https://github.com/Arggon/ArggonManager/issues/681) merged) ([#693](https://github.com/Arggon/ArggonManager/issues/693)) ([8c26850](https://github.com/Arggon/ArggonManager/commit/8c268500925fcf1bf657e6cb1e97dc7d85badfe4))
* **auto:** mark items done (PR [#682](https://github.com/Arggon/ArggonManager/issues/682) merged) ([#685](https://github.com/Arggon/ArggonManager/issues/685)) ([ad89795](https://github.com/Arggon/ArggonManager/commit/ad89795b505c9101e6280a0aadac95aab8b90798))
* **auto:** mark items done (PR [#683](https://github.com/Arggon/ArggonManager/issues/683) merged) ([#692](https://github.com/Arggon/ArggonManager/issues/692)) ([3678fbd](https://github.com/Arggon/ArggonManager/commit/3678fbd27c922c883d644d8cf0cd10114a2bf65f))
* **auto:** mark items done (PR [#686](https://github.com/Arggon/ArggonManager/issues/686) merged) ([#689](https://github.com/Arggon/ArggonManager/issues/689)) ([41ba71b](https://github.com/Arggon/ArggonManager/commit/41ba71b5cbea11239eae34055acbd4e244e43355))
* **auto:** mark items done (PR [#687](https://github.com/Arggon/ArggonManager/issues/687) merged) ([#694](https://github.com/Arggon/ArggonManager/issues/694)) ([02cefb9](https://github.com/Arggon/ArggonManager/commit/02cefb9a612d3d430107cb06cc96d871fabefa42))
* **auto:** mark items done (PR [#690](https://github.com/Arggon/ArggonManager/issues/690) merged) ([#691](https://github.com/Arggon/ArggonManager/issues/691)) ([b96188a](https://github.com/Arggon/ArggonManager/commit/b96188ab3fbac54ee600e57ff40a4eb80ce8d3d2))
* **auto:** mark items done (PR [#695](https://github.com/Arggon/ArggonManager/issues/695) merged) ([#696](https://github.com/Arggon/ArggonManager/issues/696)) ([e3a465a](https://github.com/Arggon/ArggonManager/commit/e3a465a4e42f166d5fdf1b657321b5fdd268aad5))
* **auto:** mark items done (PR [#697](https://github.com/Arggon/ArggonManager/issues/697) merged) ([#702](https://github.com/Arggon/ArggonManager/issues/702)) ([cd9c215](https://github.com/Arggon/ArggonManager/commit/cd9c215fffecc6e350f861372c08c0ac3fd8b538))
* **auto:** mark items done (PR [#699](https://github.com/Arggon/ArggonManager/issues/699) merged) ([#700](https://github.com/Arggon/ArggonManager/issues/700)) ([7d74f80](https://github.com/Arggon/ArggonManager/commit/7d74f8000a31ab7955a4827b74ade8767b511b9f))
* **auto:** mark items done (PR [#701](https://github.com/Arggon/ArggonManager/issues/701) merged) ([#703](https://github.com/Arggon/ArggonManager/issues/703)) ([3081a24](https://github.com/Arggon/ArggonManager/commit/3081a24aac3b87f98af8c099a7a7cac9eb69b09f))
* **auto:** mark items done (PR [#704](https://github.com/Arggon/ArggonManager/issues/704) merged) ([#710](https://github.com/Arggon/ArggonManager/issues/710)) ([f648bdf](https://github.com/Arggon/ArggonManager/commit/f648bdfa2371a04f7690f827f875f8e48d809825))
* **auto:** mark items done (PR [#705](https://github.com/Arggon/ArggonManager/issues/705) merged) ([#708](https://github.com/Arggon/ArggonManager/issues/708)) ([fe73c95](https://github.com/Arggon/ArggonManager/commit/fe73c957b2a8fd1f056624e30cd8d44551f5922a))
* **auto:** mark items done (PR [#706](https://github.com/Arggon/ArggonManager/issues/706) merged) ([#711](https://github.com/Arggon/ArggonManager/issues/711)) ([cd4720a](https://github.com/Arggon/ArggonManager/commit/cd4720a6909747d8d8af8de95179d1749b42cf38))
* **auto:** mark items done (PR [#707](https://github.com/Arggon/ArggonManager/issues/707) merged) ([#709](https://github.com/Arggon/ArggonManager/issues/709)) ([17daa57](https://github.com/Arggon/ArggonManager/commit/17daa5782b6bafeb110ea9865f398b8ef86a072f))
* **auto:** mark items done (PR [#712](https://github.com/Arggon/ArggonManager/issues/712) merged) ([#714](https://github.com/Arggon/ArggonManager/issues/714)) ([fb2676b](https://github.com/Arggon/ArggonManager/commit/fb2676b54e3191e5895ceeb490bb187a520c6d54))
* **auto:** mark items done (PR [#713](https://github.com/Arggon/ArggonManager/issues/713) merged) ([#719](https://github.com/Arggon/ArggonManager/issues/719)) ([6fe01be](https://github.com/Arggon/ArggonManager/commit/6fe01be1f48a2269b7fbd4c3b66cdb777ed87e67))
* **auto:** mark items done (PR [#715](https://github.com/Arggon/ArggonManager/issues/715) merged) ([#717](https://github.com/Arggon/ArggonManager/issues/717)) ([4fb6e80](https://github.com/Arggon/ArggonManager/commit/4fb6e80b82885913a4839a29c87cdd30d0ad3b61))
* **auto:** mark items done (PR [#716](https://github.com/Arggon/ArggonManager/issues/716) merged) ([#718](https://github.com/Arggon/ArggonManager/issues/718)) ([a4980d9](https://github.com/Arggon/ArggonManager/commit/a4980d93c1f569ed752c2d7af3ada7401eb3091b))
* **auto:** mark items done (PR [#720](https://github.com/Arggon/ArggonManager/issues/720) merged) ([#721](https://github.com/Arggon/ArggonManager/issues/721)) ([bf13a04](https://github.com/Arggon/ArggonManager/commit/bf13a04ba9babc328d7894a2f39f38b89f6d2ee8))
* **auto:** mark items done (PR [#724](https://github.com/Arggon/ArggonManager/issues/724) merged) ([#725](https://github.com/Arggon/ArggonManager/issues/725)) ([94a4459](https://github.com/Arggon/ArggonManager/commit/94a4459c49b6bb1cc79e3c1ee500cd2ce77438ea))
* **auto:** mark items done (PR [#740](https://github.com/Arggon/ArggonManager/issues/740) merged) ([#743](https://github.com/Arggon/ArggonManager/issues/743)) ([43d19f4](https://github.com/Arggon/ArggonManager/commit/43d19f4632196baa3dc50fdda823d767e656ce9b))
* **auto:** mark items done (PR [#741](https://github.com/Arggon/ArggonManager/issues/741) merged) ([#742](https://github.com/Arggon/ArggonManager/issues/742)) ([3dc2144](https://github.com/Arggon/ArggonManager/commit/3dc21443999b96e02f1835bf26faed519d0ef09b))
* **auto:** mark items done (PR [#746](https://github.com/Arggon/ArggonManager/issues/746) merged) ([#748](https://github.com/Arggon/ArggonManager/issues/748)) ([9fdb257](https://github.com/Arggon/ArggonManager/commit/9fdb257e711bcd67e5452794c7f75f54f43cfa9b))
* **claude-adapter:** spec 024 + live acceptance (task-claude-adapter-spec) ([9ae4f1e](https://github.com/Arggon/ArggonManager/commit/9ae4f1e0c53574672a73b85e33ea86646b7b5c85))
* **convention:** name the `.convention.yml` syntax arggon reads ([36ba488](https://github.com/Arggon/ArggonManager/commit/36ba488acfe59f5ede0c57fe2d731b89026981a6))
* **exploration-021:** link kernel-refusal closure from Recommendation (task-measure-kernel-refusal-rate) ([ffed6c1](https://github.com/Arggon/ArggonManager/commit/ffed6c1486aa9371dab9715d4efcf1318cd6cc73))
* **item:** correct the machine-check tick's forensic record to four rows (bug-stale-x-generated-records-goal-mode-seam-pair) ([2ca3b23](https://github.com/Arggon/ArggonManager/commit/2ca3b235963c65a80f2633569d81b26c9bdc154d))
* **opencode2:** record the claim-footprint declaration and its report decision (bug-native-guard-silent-without-worktree-declaration) ([e6fb077](https://github.com/Arggon/ArggonManager/commit/e6fb077abb6b822727cc77de3da6410f52f8b032))
* **plugin:** regenerate the vendored bundle for the widened convention parser ([8143082](https://github.com/Arggon/ArggonManager/commit/814308229679827d311ddb9e87e461f7280ff299))
* **skill:** format exploration.md reference table to pass prettier --check ([6fd0a9b](https://github.com/Arggon/ArggonManager/commit/6fd0a9b21fcf62adf6984ded59cbbaf5379caff1))
* **skill:** format the three remaining skills/ prettier failures ([8eaa825](https://github.com/Arggon/ArggonManager/commit/8eaa825800391b5e3abc38c6e596ca481704cedf))
* **state:** refresh x-generated checksum for the arggon-upgrade skill ([6164449](https://github.com/Arggon/ArggonManager/commit/61644492ee45c48e3a62a080989c3400bd14b757))
* **state:** refresh x-generated checksum for the formatted exploration reference ([d157442](https://github.com/Arggon/ArggonManager/commit/d15744244c56e5a24dea2e5d7078f6844b2b6f06))
* **task-author-ci-wall-clock-bodies:** Context and Acceptance for ci-wall-clock story + 2 tasks ([82fc365](https://github.com/Arggon/ArggonManager/commit/82fc365e668b6fd3b1a748f59985b22cfcdc9f69))
* **task-author-harness-transfer-bodies:** Context and Acceptance for 3 harness-transfer tasks ([6d06045](https://github.com/Arggon/ArggonManager/commit/6d060455e6ca7f3540ad22335e9bd113fe84bd30))
* **task-author-methodology-improvements-bodies:** Context and Acceptance for 12 methodology-improvements tasks ([54fb225](https://github.com/Arggon/ArggonManager/commit/54fb225cbd530c4b4c39ae5464e942bb95ca3a74))
* **task-author-methodology-productization-bodies:** Context and Acceptance for 10 methodology-productization containers ([7f00a2a](https://github.com/Arggon/ArggonManager/commit/7f00a2af4e8935a5a0da2c7c94fbc9b033552b65))
* **task-author-parallel-worktree-bodies:** Context and Acceptance for worktree story + 4 tasks ([28ec051](https://github.com/Arggon/ArggonManager/commit/28ec051b9826d4772beeea37c71b41fb572aba73))
* **task-author-spec-pipeline-body:** Context and Acceptance for spec-analyze naming task ([8710f50](https://github.com/Arggon/ArggonManager/commit/8710f5081430fd261a2311010d9ad3dac68240db))
* **task-author-tooling-env-bodies:** Context and Acceptance for 3 tooling-and-environment tasks ([d1d03c0](https://github.com/Arggon/ArggonManager/commit/d1d03c04cd5e20520d6882c280ae207ef28e4719))
* **task-measure-kernel-refusal-rate:** full 497-run auto-done sweep — 0 refusals / 220 flips (task-measure-kernel-refusal-rate) ([c6fd5c2](https://github.com/Arggon/ArggonManager/commit/c6fd5c2e3277fe5ae85aa258ad9af28ef2826352))
* **task-measure-kernel-refusal-rate:** kernel-refusal measurement report ([54b27f6](https://github.com/Arggon/ArggonManager/commit/54b27f60c66e0944072b5c0a65204b1e8aa688a5))
* **task-measure-kernel-refusal-rate:** kernel-refusal measurement report — 0 recorded refusals per 1,224 transitions, no event-level source (task-measure-kernel-refusal-rate) ([8512f73](https://github.com/Arggon/ArggonManager/commit/8512f7340eb77d7b3dccb8f88a3892ee78f02410))
* **task-playbook-panel-hierarchy-keys:** context + acceptance (follow-up to panel review N1) ([7314b20](https://github.com/Arggon/ArggonManager/commit/7314b202a0239abcc28ca2f5306abef92a4569cb))
* **task-sweep-auto-done-refusal-warnings:** context + acceptance (follow-up to PR [#726](https://github.com/Arggon/ArggonManager/issues/726)) ([54ffa29](https://github.com/Arggon/ArggonManager/commit/54ffa29bcfd3cad6a033b986376c0c5d9e76a110))
* **task-wave1b-agent-native-bodies:** Context and Acceptance for 12 agent-native bugs ([5d4467b](https://github.com/Arggon/ArggonManager/commit/5d4467b59fab6a23590c9296431cfb5067143aba))
* **task-wave1b-mixed-bodies:** Context and Acceptance for 12 mixed-area items ([#738](https://github.com/Arggon/ArggonManager/issues/738)) ([0ba15ea](https://github.com/Arggon/ArggonManager/commit/0ba15ea2e7ee6c83cdd0d59692982412ec61a746))
* **tasks:** author live acceptance contracts for the 6 Wave-1 review findings ([dbcaf32](https://github.com/Arggon/ArggonManager/commit/dbcaf325eee8f04bbfde234007f981c912a3cd97))
* **tasks:** claimed bug-adr-status-drift-merged-adr-proposed ([0b63415](https://github.com/Arggon/ArggonManager/commit/0b634154b7a72a36c57234d848f4ab30b2e849d7))
* **tasks:** claimed bug-autorelease-label-lifecycle-unowned ([8784109](https://github.com/Arggon/ArggonManager/commit/878410929a3ff22abbdc0a999d35d12d01b849d5))
* **tasks:** claimed bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([f621cd3](https://github.com/Arggon/ArggonManager/commit/f621cd3a9f542f3dfddc01ebbc9c5beb4481184c))
* **tasks:** claimed bug-init-force-drops-x-tracker-block ([9d088d5](https://github.com/Arggon/ArggonManager/commit/9d088d5538dcf7ee93829c2a214ad15c82759d86))
* **tasks:** claimed bug-native-guard-silent-without-worktree-declaration ([5ddc5fb](https://github.com/Arggon/ArggonManager/commit/5ddc5fb87927ec566ade39f89d9be6e0afbdbf47))
* **tasks:** claimed bug-release-config-workflow-agreement-ungated ([9e8bc75](https://github.com/Arggon/ArggonManager/commit/9e8bc75ea82c3444f67472c0032ee21cf6f5187e))
* **tasks:** claimed bug-release-lockfile-sync-step-cannot-run ([0c5aff6](https://github.com/Arggon/ArggonManager/commit/0c5aff68758be863ee3a3e78f97fbcc9fb94d4aa))
* **tasks:** claimed bug-release-needs-auth-self-describing ([6f2d826](https://github.com/Arggon/ArggonManager/commit/6f2d8266b46e0f3c05883b6721998734c0ba0b54))
* **tasks:** claimed bug-skill-exploration-reference-fails-prettier ([26c3c84](https://github.com/Arggon/ArggonManager/commit/26c3c84de99b8f886d3fcf9be5d8142659b85007))
* **tasks:** claimed bug-template-only-bodies-ship-green ([d8e341a](https://github.com/Arggon/ArggonManager/commit/d8e341acffc1a5b51172d1a31efcb0d74e664cfb))
* **tasks:** claimed task-author-ci-wall-clock-bodies ([a1805cd](https://github.com/Arggon/ArggonManager/commit/a1805cdc46a975b6e59c0b75326002f295578330))
* **tasks:** claimed task-author-harness-transfer-bodies ([5d3b5d0](https://github.com/Arggon/ArggonManager/commit/5d3b5d05060e3ed67b6933763cb6cd32909af288))
* **tasks:** claimed task-author-methodology-improvements-bodies ([bccd081](https://github.com/Arggon/ArggonManager/commit/bccd08137575d8c2adcb60fb31df2d3e971f9156))
* **tasks:** claimed task-author-methodology-productization-bodies ([141d1b0](https://github.com/Arggon/ArggonManager/commit/141d1b0ab027ec760282d77116d3b6319574057b))
* **tasks:** claimed task-author-parallel-worktree-bodies ([f9cae0b](https://github.com/Arggon/ArggonManager/commit/f9cae0bee89b331350be170a3aaf2e3a91162431))
* **tasks:** claimed task-author-spec-pipeline-body ([389df63](https://github.com/Arggon/ArggonManager/commit/389df634c7c54e7f3d440890756ecb53c693c9a9))
* **tasks:** claimed task-author-tooling-env-bodies ([127e063](https://github.com/Arggon/ArggonManager/commit/127e063aee97573885eb7f8e12ab46bb3e682386))
* **tasks:** claimed task-claude-adapter-spec ([28537a4](https://github.com/Arggon/ArggonManager/commit/28537a455f9e73450ad2f7cb799a9c1fb94c0e43))
* **tasks:** claimed task-measure-kernel-refusal-rate ([8fb826e](https://github.com/Arggon/ArggonManager/commit/8fb826e9f7d1e4da9e8e1e7fa66925b3effeb71e))
* **tasks:** claimed task-native-panel-hierarchy-links ([16411f7](https://github.com/Arggon/ArggonManager/commit/16411f766033ebbef01927c7ac196cceebbabfde))
* **tasks:** claimed task-tui-hierarchy-jump ([e195b14](https://github.com/Arggon/ArggonManager/commit/e195b14825c8490496000951b76569fc6d4861ef))
* **tasks:** claimed task-validate-refuses-placeholder-bodies ([096a050](https://github.com/Arggon/ArggonManager/commit/096a0503bcac05848c2bb3ed0f34f97a8306f9dc))
* **tasks:** claimed task-wave1b-agent-native-bodies ([3d48d8e](https://github.com/Arggon/ArggonManager/commit/3d48d8e39ac7ef5a9814614d9421baf39bac363d))
* **tasks:** claimed task-web-board-hierarchy-links ([877c85d](https://github.com/Arggon/ArggonManager/commit/877c85dc4da1dd5b9bc0d61bc7390a6b4748776e))
* **tasks:** closed zcode-native-arggonmanager-mcp-parity-plugin-seam epic acceptance (subtree terminal) ([c0b3921](https://github.com/Arggon/ArggonManager/commit/c0b392156b60a2eded6b6d7e148f9fce15239245))
* **tasks:** commented bug-adopter-engineering-template-software-locked ([a2eb686](https://github.com/Arggon/ArggonManager/commit/a2eb6868e2452b98366da7779352781b454e709b))
* **tasks:** commented bug-adr-status-drift-merged-adr-proposed ([c82a7e5](https://github.com/Arggon/ArggonManager/commit/c82a7e5f7f3296bb2d4b2400e8a2232ea03958c5))
* **tasks:** commented bug-adr-status-drift-merged-adr-proposed ([fb16406](https://github.com/Arggon/ArggonManager/commit/fb16406268b541bf2e95f6b4e2fa3124e248fc1f))
* **tasks:** commented bug-adr-status-drift-merged-adr-proposed ([c72d8ae](https://github.com/Arggon/ArggonManager/commit/c72d8ae502bed909ef3fc56333d9a65199ce2b92))
* **tasks:** commented bug-adr-status-drift-merged-adr-proposed ([4828027](https://github.com/Arggon/ArggonManager/commit/4828027df906626fa1e7637e653f29d743fd0de6))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([1331f4f](https://github.com/Arggon/ArggonManager/commit/1331f4f1fccc32c5440ae874ec7981e506bff9db))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([e3610b2](https://github.com/Arggon/ArggonManager/commit/e3610b228f5b1f2d315729785b05b681d214439a))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([32f45a4](https://github.com/Arggon/ArggonManager/commit/32f45a45bba9447f7eddf0966b77e74b54455ab1))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([e826d5e](https://github.com/Arggon/ArggonManager/commit/e826d5e0671d4a3e1f4b0496ac7dc2e66bce4450))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([aeb7b7b](https://github.com/Arggon/ArggonManager/commit/aeb7b7b36e339359e42b475c5a5ba683671e42dd))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([1773e9d](https://github.com/Arggon/ArggonManager/commit/1773e9d8226f65c310936788c6c26c8bac74e1f8))
* **tasks:** commented bug-autorelease-label-lifecycle-unowned ([254bf14](https://github.com/Arggon/ArggonManager/commit/254bf1490c7fb71fbd0591335ece768bc79e4db4))
* **tasks:** commented bug-convention-md-links-nonexistent-adr-0015 ([b025847](https://github.com/Arggon/ArggonManager/commit/b025847340a102c8ebd8e597981ad4bfecd3148c))
* **tasks:** commented bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([363a27e](https://github.com/Arggon/ArggonManager/commit/363a27e9d1f05c68f612e96afa0459d728fda88a))
* **tasks:** commented bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([1a2d28f](https://github.com/Arggon/ArggonManager/commit/1a2d28f8bc352315992083d4324d9447cafd0453))
* **tasks:** commented bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([3e26ee1](https://github.com/Arggon/ArggonManager/commit/3e26ee14945f8ff94a25a6706aa278af248f0518))
* **tasks:** commented bug-done-gate-whole-body-scan-counts-fenced-repro-boxes ([ec47afb](https://github.com/Arggon/ArggonManager/commit/ec47afb17fd79ea31cc04b4ebd1365316f7ff350))
* **tasks:** commented bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use ([792882b](https://github.com/Arggon/ArggonManager/commit/792882ba81588649ef7c656ee01f83bb58bbdfcf))
* **tasks:** commented bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([17bb004](https://github.com/Arggon/ArggonManager/commit/17bb004c7ebb6c6b78f525c5609fa1bef60a4902))
* **tasks:** commented bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([d2e2a23](https://github.com/Arggon/ArggonManager/commit/d2e2a23bade12610660d2eacf978782bb0a03ee3))
* **tasks:** commented bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([6273a90](https://github.com/Arggon/ArggonManager/commit/6273a903302419d3a2ab60d715356c9da5bc4158))
* **tasks:** commented bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([ed0f20c](https://github.com/Arggon/ArggonManager/commit/ed0f20cd0bedb22dd90b2c7b6583daab3f5c1bbc))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([9c69d84](https://github.com/Arggon/ArggonManager/commit/9c69d84459db9486575323b24e44ac7089fc1a87))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([e2ea824](https://github.com/Arggon/ArggonManager/commit/e2ea824ddbbd42c8ed0e6e1213cf7301174550e9))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([253f445](https://github.com/Arggon/ArggonManager/commit/253f445c0d6106d2b2369a4eed7c3f23440c73c8))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([ff54bd2](https://github.com/Arggon/ArggonManager/commit/ff54bd293cc97055475d44f7448507b266137dbf))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([c7705cf](https://github.com/Arggon/ArggonManager/commit/c7705cf33a60a614cc512ba06ab88dae7390f50d))
* **tasks:** commented bug-init-force-drops-x-tracker-block ([f926bc9](https://github.com/Arggon/ArggonManager/commit/f926bc9582e3a2b8f5f82de809dd47827853d224))
* **tasks:** commented bug-native-guard-silent-without-worktree-declaration ([8defba1](https://github.com/Arggon/ArggonManager/commit/8defba11707e320eca32ce6b92a9d859119e47ca))
* **tasks:** commented bug-native-guard-silent-without-worktree-declaration ([76135e1](https://github.com/Arggon/ArggonManager/commit/76135e1dc47729c3b07ec3a8274ab03a8f79cb79))
* **tasks:** commented bug-native-guard-silent-without-worktree-declaration ([cc4b8f4](https://github.com/Arggon/ArggonManager/commit/cc4b8f4f2539f4e2074f125d3d46aedef771fab6))
* **tasks:** commented bug-no-gate-warns-on-paired-impl-and-test-deletion ([53890f4](https://github.com/Arggon/ArggonManager/commit/53890f4cf232148b2b9c18fefe0de04ac4a5564d))
* **tasks:** commented bug-no-gate-warns-on-paired-impl-and-test-deletion ([20a5386](https://github.com/Arggon/ArggonManager/commit/20a5386582600ba6e4d00a4276915b56252393a1))
* **tasks:** commented bug-prettier-glues-split-inline-code-span ([4f5a928](https://github.com/Arggon/ArggonManager/commit/4f5a928a7a69bd2b14f3a3f310cdef254b297888))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([7ffaadc](https://github.com/Arggon/ArggonManager/commit/7ffaadc56980e2963909e5c6cbf9bd7581312d5a))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([55a18ee](https://github.com/Arggon/ArggonManager/commit/55a18ee2385d8e3419f1e539604f6e6b4ad52088))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([7a57143](https://github.com/Arggon/ArggonManager/commit/7a57143395afd35c143e3a138ab34c9317a93ccb))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([70d95fb](https://github.com/Arggon/ArggonManager/commit/70d95fb025cd71b7c329fa70659e6d99a300dc51))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([75dcbb6](https://github.com/Arggon/ArggonManager/commit/75dcbb677e5b26271b6965bb105db60a0c70cf40))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([313a9de](https://github.com/Arggon/ArggonManager/commit/313a9deb906937b7c4b5e321a5aee40ba0865bb8))
* **tasks:** commented bug-release-config-workflow-agreement-ungated ([ee42eda](https://github.com/Arggon/ArggonManager/commit/ee42edac06d8a4666b83017dc22cb2903f69ca7c))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([60f5c7e](https://github.com/Arggon/ArggonManager/commit/60f5c7ef4b0f9f04da179a41ed2caa86858b4f7a))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([14075d3](https://github.com/Arggon/ArggonManager/commit/14075d306c8c687077d8bf9df906ede8bbbaf8ce))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([80ddd0b](https://github.com/Arggon/ArggonManager/commit/80ddd0bafa4b728e8f4898c4e72580bfed193b92))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([3394134](https://github.com/Arggon/ArggonManager/commit/33941346015854a7ba5ad69e49339a90b2b8c0f2))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([2f2ab18](https://github.com/Arggon/ArggonManager/commit/2f2ab18a11381ae0cd6f3135a21b1b72d94cc3f4))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([3e2e3fc](https://github.com/Arggon/ArggonManager/commit/3e2e3fc54364be8f041a961176b561c4202a364f))
* **tasks:** commented bug-release-lockfile-sync-step-cannot-run ([9ad3939](https://github.com/Arggon/ArggonManager/commit/9ad3939521b78093cadd006ec59b463e8d9616be))
* **tasks:** commented bug-release-needs-auth-self-describing ([05b26ae](https://github.com/Arggon/ArggonManager/commit/05b26aebc1d954488f60f7968fffb1a09da4e702))
* **tasks:** commented bug-release-needs-auth-self-describing ([aa60ec1](https://github.com/Arggon/ArggonManager/commit/aa60ec17303817cc7137bbaf7c774f6ffa007db0))
* **tasks:** commented bug-release-needs-auth-self-describing ([3731eca](https://github.com/Arggon/ArggonManager/commit/3731ecaa2698108c95d5c9f0fe8c677224d94c1c))
* **tasks:** commented bug-release-needs-auth-self-describing ([00d636b](https://github.com/Arggon/ArggonManager/commit/00d636b7aca479fc64073f5d2e593a781566483c))
* **tasks:** commented bug-release-needs-auth-self-describing ([a434fad](https://github.com/Arggon/ArggonManager/commit/a434fad04794bc3ec5cbefc768f1f6b7197d4941))
* **tasks:** commented bug-release-needs-auth-self-describing ([9640dd1](https://github.com/Arggon/ArggonManager/commit/9640dd1f71d6347f448964cd0fdd25c73d8d7771))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([f29e610](https://github.com/Arggon/ArggonManager/commit/f29e610909d2dde980ec688594d29aa485b5e1d0))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([b044122](https://github.com/Arggon/ArggonManager/commit/b044122a19aa330f67fa16f08c059c9cc2d2debd))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([f46e166](https://github.com/Arggon/ArggonManager/commit/f46e1662ad5adf664fd3a3165065a50a12f3c498))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([1dc4c48](https://github.com/Arggon/ArggonManager/commit/1dc4c48a5d17ad8308291c03a2c277d82b7a5933))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([712844c](https://github.com/Arggon/ArggonManager/commit/712844c8a9a43c3377f2bff8240709c15613eb3f))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([845b5a2](https://github.com/Arggon/ArggonManager/commit/845b5a252849205f7a85b6782bb463420cce3e53))
* **tasks:** commented bug-skill-exploration-reference-fails-prettier ([7a70a8e](https://github.com/Arggon/ArggonManager/commit/7a70a8ef8a9f86e5959ef6c2ebe6a4792baa7103))
* **tasks:** commented bug-stale-x-generated-records-goal-mode-seam-pair ([c46b6f0](https://github.com/Arggon/ArggonManager/commit/c46b6f0a22877af6a94144e5e1f5c2e6d0d7ce3e))
* **tasks:** commented bug-template-only-bodies-ship-green ([900f706](https://github.com/Arggon/ArggonManager/commit/900f70673f67551153713c0097b5e54ff98d8a43))
* **tasks:** commented bug-template-only-bodies-ship-green ([79a6ff0](https://github.com/Arggon/ArggonManager/commit/79a6ff04da76d8d041995d7bea054a7b68999eff))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([e3c6326](https://github.com/Arggon/ArggonManager/commit/e3c6326ce06bc65f0863f563313aa3569a373fc9))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([d455e52](https://github.com/Arggon/ArggonManager/commit/d455e52bf625dc2a736153eb4abb368dec9bafb7))
* **tasks:** commented bug-verifier-cannot-read-the-tracker-no-allow-side ([821d902](https://github.com/Arggon/ArggonManager/commit/821d902766eb0c261a85c4fc6fb293cbda4679e9))
* **tasks:** commented bug-x-tracker-option-list-has-no-doc-drift-guard ([040b8a7](https://github.com/Arggon/ArggonManager/commit/040b8a7a2206c8f4bc82e6ffc1a5de80d9a56ae5))
* **tasks:** commented task-adapter-report-nits-from-review ([7259a8f](https://github.com/Arggon/ArggonManager/commit/7259a8f4fd58a5fd15b42e341e2ddcd0a533b710))
* **tasks:** commented task-author-ci-wall-clock-bodies ([ab0967a](https://github.com/Arggon/ArggonManager/commit/ab0967a6a4d1b3c98e66189158493168664af80b))
* **tasks:** commented task-author-ci-wall-clock-bodies ([f3f3b31](https://github.com/Arggon/ArggonManager/commit/f3f3b31d4565586a8a7a4f44794aca3050c7bd8c))
* **tasks:** commented task-author-ci-wall-clock-bodies ([84d26cc](https://github.com/Arggon/ArggonManager/commit/84d26ccc2cad044d4871d26fc2b5dd213993a3e1))
* **tasks:** commented task-author-harness-transfer-bodies ([45f488b](https://github.com/Arggon/ArggonManager/commit/45f488b31b90bfab7408a293cac65b1652ed36b0))
* **tasks:** commented task-author-harness-transfer-bodies ([fb739d6](https://github.com/Arggon/ArggonManager/commit/fb739d6d4ec1f920e17171fa7b9ec351bd139604))
* **tasks:** commented task-author-harness-transfer-bodies ([71f817e](https://github.com/Arggon/ArggonManager/commit/71f817e9e0fdf282b247066bdb09743a574e3185))
* **tasks:** commented task-author-methodology-improvements-bodies ([cb169b4](https://github.com/Arggon/ArggonManager/commit/cb169b40704b49b33fc3ede6275c8b54e879af78))
* **tasks:** commented task-author-methodology-improvements-bodies ([46c6464](https://github.com/Arggon/ArggonManager/commit/46c64642dd9e7d86dddcd1730a97d54f825e3af6))
* **tasks:** commented task-author-methodology-improvements-bodies ([432fe4e](https://github.com/Arggon/ArggonManager/commit/432fe4ec28206ee2b69a549a4a8d3cb1f0ba847e))
* **tasks:** commented task-author-methodology-productization-bodies ([0a4efd7](https://github.com/Arggon/ArggonManager/commit/0a4efd75d766abf96d5689cf2321f3f65517ebd2))
* **tasks:** commented task-author-methodology-productization-bodies ([f4232cf](https://github.com/Arggon/ArggonManager/commit/f4232cf036f0062af36fae6d22e6d2d15885c197))
* **tasks:** commented task-author-methodology-productization-bodies ([36dbcdd](https://github.com/Arggon/ArggonManager/commit/36dbcdd646d4868b281dcae5f064fd3c992c6cf1))
* **tasks:** commented task-author-parallel-worktree-bodies ([6ee4252](https://github.com/Arggon/ArggonManager/commit/6ee4252e687e850d84c6928fa4cd143bf1d343c9))
* **tasks:** commented task-author-parallel-worktree-bodies ([5bbeb97](https://github.com/Arggon/ArggonManager/commit/5bbeb97e77bffd745a26732b8d840a2426964bea))
* **tasks:** commented task-author-parallel-worktree-bodies ([7409fe1](https://github.com/Arggon/ArggonManager/commit/7409fe1e70e68b92511a1b5fdfe306c7cde8b48f))
* **tasks:** commented task-author-spec-pipeline-body ([693d2d5](https://github.com/Arggon/ArggonManager/commit/693d2d571661bfe34b504849ea0958e07c564ea7))
* **tasks:** commented task-author-spec-pipeline-body ([a77e603](https://github.com/Arggon/ArggonManager/commit/a77e603c2281298b6172e3df818a36899fa42ab0))
* **tasks:** commented task-author-spec-pipeline-body ([8534c38](https://github.com/Arggon/ArggonManager/commit/8534c3894d975c9a2ac797c678e1ef1d9465d53e))
* **tasks:** commented task-author-tooling-env-bodies ([87b9809](https://github.com/Arggon/ArggonManager/commit/87b9809eeb9f4d4714cfa583bed80bb6662084d0))
* **tasks:** commented task-author-tooling-env-bodies ([f0cc3b2](https://github.com/Arggon/ArggonManager/commit/f0cc3b23d189733d86a34e5caae34927baa9ecfb))
* **tasks:** commented task-author-tooling-env-bodies ([f0c9835](https://github.com/Arggon/ArggonManager/commit/f0c983592653541b1f6279c66286b8a011b703f6))
* **tasks:** commented task-ci-required-check-missing-spec-analyze-baseline ([24daaa5](https://github.com/Arggon/ArggonManager/commit/24daaa592e7e67b2e77712d0bb8cc37377fd9c40))
* **tasks:** commented task-ci-required-check-missing-spec-analyze-baseline ([e8dc792](https://github.com/Arggon/ArggonManager/commit/e8dc79292d7792d2e131a10ecac22c53330b04f2))
* **tasks:** commented task-claude-adapter-spec ([8698cf7](https://github.com/Arggon/ArggonManager/commit/8698cf73d9c285fa548c2298adbcbd1b3ea30a0b))
* **tasks:** commented task-claude-adapter-spec ([97f43b3](https://github.com/Arggon/ArggonManager/commit/97f43b3836c951e8ad1b57b5f881d8a1e54f5a7b))
* **tasks:** commented task-claude-adapter-spec ([2c998db](https://github.com/Arggon/ArggonManager/commit/2c998db8ae4991093db7314b26b6a40a8d1b744b))
* **tasks:** commented task-claude-adapter-spec ([5cfb595](https://github.com/Arggon/ArggonManager/commit/5cfb595bdc5177687b0317bf56c9236d7abd5aef))
* **tasks:** commented task-code-span-repair-sweep ([28a372d](https://github.com/Arggon/ArggonManager/commit/28a372d92672db165a79d1f65383aa31f910a0d6))
* **tasks:** commented task-decision-pending-methodology-improvements-014 ([2c4cc63](https://github.com/Arggon/ArggonManager/commit/2c4cc63731ac1d47df54b58be32b8993fced69e5))
* **tasks:** commented task-decision-pending-methodology-improvements-014 ([119b51c](https://github.com/Arggon/ArggonManager/commit/119b51cd91c458d946851b8bfe3af9479e9fc86b))
* **tasks:** commented task-friction-capture-command ([7b8b7ba](https://github.com/Arggon/ArggonManager/commit/7b8b7ba1a9a46a40440cca91e2b51dcaf3c7bc9f))
* **tasks:** commented task-friction-capture-command ([d5b0660](https://github.com/Arggon/ArggonManager/commit/d5b0660c8995f73701941bac87cb73a6c00828b0))
* **tasks:** commented task-friction-capture-command ([0eeff69](https://github.com/Arggon/ArggonManager/commit/0eeff69628886c52e0367d8babe1c4d657eb8d05))
* **tasks:** commented task-friction-dedupe-and-report ([6f67254](https://github.com/Arggon/ArggonManager/commit/6f672549d0770737c1dc8d2f8e42aa582591de0c))
* **tasks:** commented task-friction-fingerprint-separator-not-length-prefixed ([d41a7fb](https://github.com/Arggon/ArggonManager/commit/d41a7fb7e0589c10405758296aaa1068d558a5b7))
* **tasks:** commented task-friction-fingerprint-separator-not-length-prefixed ([14d2abc](https://github.com/Arggon/ArggonManager/commit/14d2abc9be329bc54c05c139c17ae3c68900295e))
* **tasks:** commented task-friction-redaction-at-write ([c5b7e18](https://github.com/Arggon/ArggonManager/commit/c5b7e18c73c6f810dabfd2d4ca5dfc45d8f5c84c))
* **tasks:** commented task-friction-tier-b-url-and-optout ([4ab30fb](https://github.com/Arggon/ArggonManager/commit/4ab30fbe8093cfb7b103e173b0ded2b1901215e4))
* **tasks:** commented task-measure-kernel-refusal-rate ([39a2a51](https://github.com/Arggon/ArggonManager/commit/39a2a51785d18088b9df792960ad145acfdd6ee6))
* **tasks:** commented task-measure-kernel-refusal-rate ([ce409a1](https://github.com/Arggon/ArggonManager/commit/ce409a1642e943a9ff4c9b98b7b3556f22e24a5b))
* **tasks:** commented task-measure-kernel-refusal-rate ([4dc0e33](https://github.com/Arggon/ArggonManager/commit/4dc0e33093e72f426fe44bd9278dcf2ddf63d5be))
* **tasks:** commented task-measure-kernel-refusal-rate ([0784b03](https://github.com/Arggon/ArggonManager/commit/0784b030ad15f964b7ecac6cfbce5524770909ee))
* **tasks:** commented task-measure-kernel-refusal-rate ([f38ea8d](https://github.com/Arggon/ArggonManager/commit/f38ea8d48e130824ce77fa7878f7734f811f3308))
* **tasks:** commented task-native-panel-hierarchy-links ([556ac77](https://github.com/Arggon/ArggonManager/commit/556ac77c5e91963c43289e09e48595340c11391a))
* **tasks:** commented task-native-panel-hierarchy-links ([836e7a2](https://github.com/Arggon/ArggonManager/commit/836e7a2f07379a61b2a2ff77f339b5d3141cc2ff))
* **tasks:** commented task-native-panel-hierarchy-links ([2c139ea](https://github.com/Arggon/ArggonManager/commit/2c139ea27106208ef047b629d350448995cf282c))
* **tasks:** commented task-opencode-prompt-stamp ([5801a9c](https://github.com/Arggon/ArggonManager/commit/5801a9c6a1f19fd0d08b251de7ba0e886f271c0d))
* **tasks:** commented task-plugin-bundle-near-byte-ceiling ([1e03dda](https://github.com/Arggon/ArggonManager/commit/1e03ddafa55067ddf436a76b1b06eaa1ba916bec))
* **tasks:** commented task-plugin-test-type-coverage ([7439981](https://github.com/Arggon/ArggonManager/commit/74399810d36e511ba2cefa96697ce972df9c9808))
* **tasks:** commented task-plugin-test-type-coverage ([9bfda29](https://github.com/Arggon/ArggonManager/commit/9bfda29b66e58a7607b85b4b73052a4e48ebeb2a))
* **tasks:** commented task-release-pipeline-baseline-new-collisions ([52fd2e2](https://github.com/Arggon/ArggonManager/commit/52fd2e2bb5e1114cf4d359ca8f977059177a5335))
* **tasks:** commented task-renumber-colliding-doc-numbers ([b351670](https://github.com/Arggon/ArggonManager/commit/b351670d9f9dd46f25af21151d5648b689b0de39))
* **tasks:** commented task-scratch-comment-persistence-probe ([36eca42](https://github.com/Arggon/ArggonManager/commit/36eca42341d8adeffb748f888972c92f827f293b))
* **tasks:** commented task-scratch-comment-persistence-probe ([166a18d](https://github.com/Arggon/ArggonManager/commit/166a18df6ae67b650d57bd9ec20c1c8a87c68ae1))
* **tasks:** commented task-skill-json-contract-names-claude-code ([242dec4](https://github.com/Arggon/ArggonManager/commit/242dec49c07d245078e3a2fb458a3fc198809531))
* **tasks:** commented task-skill-json-contract-names-claude-code ([a6a68d8](https://github.com/Arggon/ArggonManager/commit/a6a68d813e1af50042c5f7eb242e8b9ac4e83eab))
* **tasks:** commented task-spec-deps-022-no-error-path ([5f57a95](https://github.com/Arggon/ArggonManager/commit/5f57a9516132e98831afa7835cd5af2ddc8a51a6))
* **tasks:** commented task-stale-citations-to-renumbered-doc-stems ([1ef80db](https://github.com/Arggon/ArggonManager/commit/1ef80dbf21988069b76a110e3256bb05974a28ec))
* **tasks:** commented task-tui-hierarchy-jump ([8a0616f](https://github.com/Arggon/ArggonManager/commit/8a0616faddf310b13f39e3aacd58610cf0d3ba69))
* **tasks:** commented task-tui-hierarchy-jump ([901ec05](https://github.com/Arggon/ArggonManager/commit/901ec0593ece5c2d3b86b8a8f161694adcb58935))
* **tasks:** commented task-tui-hierarchy-jump ([b7d7a4e](https://github.com/Arggon/ArggonManager/commit/b7d7a4e7d7a7fc03443d347d716fdb2a932eae49))
* **tasks:** commented task-validate-refuses-placeholder-bodies ([a6900db](https://github.com/Arggon/ArggonManager/commit/a6900dbdb2ddaeb41c90b53707915d7c510b9f1f))
* **tasks:** commented task-validate-refuses-placeholder-bodies ([18c3308](https://github.com/Arggon/ArggonManager/commit/18c330897c0eec7c5a5cae70516fb9663537124f))
* **tasks:** commented task-wave1b-agent-native-bodies ([908cdae](https://github.com/Arggon/ArggonManager/commit/908cdaeb8127b6576f5d35472bde1136d9ee5dbd))
* **tasks:** commented task-wave1b-agent-native-bodies ([de99fb7](https://github.com/Arggon/ArggonManager/commit/de99fb7f6a6b79bea8b05ad6083ee844cb81eedf))
* **tasks:** commented task-wave1b-agent-native-bodies ([b2c5189](https://github.com/Arggon/ArggonManager/commit/b2c51897f826e6ff0ab7162eb9b2f47542730fa1))
* **tasks:** commented task-wave1b-mixed-bodies ([20ec05c](https://github.com/Arggon/ArggonManager/commit/20ec05c67688e541607c360c579aa55a6aa1028f))
* **tasks:** commented task-web-board-hierarchy-links ([899c424](https://github.com/Arggon/ArggonManager/commit/899c42445f8e7b6aca5ef7be266531e26b24f340))
* **tasks:** commented task-web-board-hierarchy-links ([2d3e3f3](https://github.com/Arggon/ArggonManager/commit/2d3e3f37b7dfedb937bcf87818991fdeeac32d23))
* **tasks:** commented task-web-board-hierarchy-links ([6aa23b8](https://github.com/Arggon/ArggonManager/commit/6aa23b87c81739d28ce58ba20a085daa64d91c53))
* **tasks:** commented task-zcode-automations ([1e943ce](https://github.com/Arggon/ArggonManager/commit/1e943ce37e24b4df6e58a88e914ec81148dde7b1))
* **tasks:** commented task-zcode-automations ([f100196](https://github.com/Arggon/ArggonManager/commit/f1001962c08cfc8a1c3d11f4d050b3adf088d4cb))
* **tasks:** commented task-zcode-lead-role-belongs-to-the-main-session ([169cba5](https://github.com/Arggon/ArggonManager/commit/169cba53f411d5c0d8d9d704a6f8d4e06791f392))
* **tasks:** commented task-zcode-lead-role-belongs-to-the-main-session ([65ee06e](https://github.com/Arggon/ArggonManager/commit/65ee06ef451e9d61dfe20640d21ff83a4bfc06d7))
* **tasks:** commented task-zcode-lead-role-belongs-to-the-main-session ([1ce1949](https://github.com/Arggon/ArggonManager/commit/1ce19497df1c2b872891db1f5d4f3fec963a0459))
* **tasks:** commented task-zcode-lead-role-belongs-to-the-main-session ([5e3aa2c](https://github.com/Arggon/ArggonManager/commit/5e3aa2c69e8fecf348e93f25d1b46917a6b80c53))
* **tasks:** commented task-zcode-live-verification ([9442822](https://github.com/Arggon/ArggonManager/commit/94428228547c8152c1a4fdb66961d3400e56dd11))
* **tasks:** commented task-zcode-live-verification ([4e7b51a](https://github.com/Arggon/ArggonManager/commit/4e7b51ab344644a0a9cceb9a995a80c420f2513b))
* **tasks:** commented task-zcode-live-verification ([489b362](https://github.com/Arggon/ArggonManager/commit/489b36211873a68d179be12f87877fa4a41a9e4b))
* **tasks:** commented task-zcode-live-verification ([3841b69](https://github.com/Arggon/ArggonManager/commit/3841b69529a08bbc59f461db4ed2a3c11f58d3eb))
* **tasks:** commented task-zcode-live-verification ([a189143](https://github.com/Arggon/ArggonManager/commit/a189143c7f2fcc6b4d5dfb3237b36c917dbd841d))
* **tasks:** commented task-zcode-live-verification ([c972bd2](https://github.com/Arggon/ArggonManager/commit/c972bd224bf4718a03982fe84c86e76e57c70429))
* **tasks:** commented task-zcode-live-verification ([e429568](https://github.com/Arggon/ArggonManager/commit/e429568636696dcfe579087dc6cfddcbd8b85d5f))
* **tasks:** commented task-zcode-live-verification ([a741ade](https://github.com/Arggon/ArggonManager/commit/a741adee3bc4d304f88b930da4ea1f408b47196e))
* **tasks:** created bug-auto-merge-armed-not-merged ([2feeb5a](https://github.com/Arggon/ArggonManager/commit/2feeb5abf6a609e24ecab9d5b6e5227ecaad8ab2))
* **tasks:** created bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([e496623](https://github.com/Arggon/ArggonManager/commit/e4966231c614a991f6636b15ba9b216582c92efe))
* **tasks:** created bug-done-gate-whole-body-scan-counts-fenced-repro-boxes ([2c6719a](https://github.com/Arggon/ArggonManager/commit/2c6719a3973cd07187a289d8bef487c9924feb7d))
* **tasks:** created bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use ([305b0f2](https://github.com/Arggon/ArggonManager/commit/305b0f27b25d72d907d1a7824005e0f9768fc6b5))
* **tasks:** created bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([c5401cb](https://github.com/Arggon/ArggonManager/commit/c5401cb4cba0378e47865aa4f13e4191b0dd8f1f))
* **tasks:** created bug-goal-contract-unreadable-for-agent-held-claim ([11f293b](https://github.com/Arggon/ArggonManager/commit/11f293b6530d99dbf0c43b386184c8ac6164a9ab))
* **tasks:** created bug-release-lockfile-sync-step-cannot-run ([25558bf](https://github.com/Arggon/ArggonManager/commit/25558bfe1f12189dbeb2dc973c9dd8d905e2b4fc))
* **tasks:** created bug-renumber-680-prettier-scope-creep ([aae0706](https://github.com/Arggon/ArggonManager/commit/aae0706332803d14febfba1337ebd25d708e94e4))
* **tasks:** created bug-session-formatter-normalizes-tracker-item-files ([dcc12b8](https://github.com/Arggon/ArggonManager/commit/dcc12b8e2d1a68611f4044672627ff9221c22073))
* **tasks:** created bug-stale-x-generated-records-goal-mode-seam-pair ([e8c1f71](https://github.com/Arggon/ArggonManager/commit/e8c1f7153633039bc65089789626b226dfc9e2f5))
* **tasks:** created bug-start-claim-branch-inherits-unpushed-tracker-commits ([7765e4c](https://github.com/Arggon/ArggonManager/commit/7765e4c7873d6c4e11151be7a24bddc6c67f0e09))
* **tasks:** created bug-start-claim-commit-frontmatter-fails-prettier ([85c8e89](https://github.com/Arggon/ArggonManager/commit/85c8e899e026416711203e0caddbe866661340dc))
* **tasks:** created bug-template-only-bodies-ship-green ([cdb336a](https://github.com/Arggon/ArggonManager/commit/cdb336af6133a4379847d48f2e784267ae9a36a3))
* **tasks:** created bug-update-depends-on-multiline-rejected ([e39f6d5](https://github.com/Arggon/ArggonManager/commit/e39f6d55117977a1b344b6817db256c48ad3e681))
* **tasks:** created bug-verifier-cannot-read-the-tracker-no-allow-side ([eb55c80](https://github.com/Arggon/ArggonManager/commit/eb55c80e776045b75872bbd44ef71b0fd44b5a3d))
* **tasks:** created story-hierarchy-navigation ([6f5f4fe](https://github.com/Arggon/ArggonManager/commit/6f5f4fed22761943ed5d50627cbac14019596332))
* **tasks:** created task-author-ci-wall-clock-bodies ([9387b29](https://github.com/Arggon/ArggonManager/commit/9387b2959ed3f1e178a84f4426070b07f1090261))
* **tasks:** created task-author-harness-transfer-bodies ([1ff424b](https://github.com/Arggon/ArggonManager/commit/1ff424b33d5e48e305802f474581a1ffe5e36733))
* **tasks:** created task-author-methodology-improvements-bodies ([532fde0](https://github.com/Arggon/ArggonManager/commit/532fde04d83987a269dbb62096d32f8e15907a19))
* **tasks:** created task-author-methodology-productization-bodies ([c6442dd](https://github.com/Arggon/ArggonManager/commit/c6442dd06568e03d4f80a9f2f64a369267cbd365))
* **tasks:** created task-author-parallel-worktree-bodies ([4b9920c](https://github.com/Arggon/ArggonManager/commit/4b9920c17ad1f0becd995f135662e1cf4ffe836e))
* **tasks:** created task-author-spec-pipeline-body ([c7be8e0](https://github.com/Arggon/ArggonManager/commit/c7be8e0d1f00f2bc41955649303190711dac18f6))
* **tasks:** created task-author-tooling-env-bodies ([5337f3d](https://github.com/Arggon/ArggonManager/commit/5337f3d6d77047e6a76ac4ad274dd034e93fc358))
* **tasks:** created task-board-build-stamp ([1c00f25](https://github.com/Arggon/ArggonManager/commit/1c00f2523e23cbd6422ccdcd76cbc84de93113b2))
* **tasks:** created task-ci-required-check-missing-spec-analyze-baseline ([83ada62](https://github.com/Arggon/ArggonManager/commit/83ada62c7ed95b497c75891bf7417c2d585c9109))
* **tasks:** created task-decision-pending-methodology-improvements-014 ([a88a799](https://github.com/Arggon/ArggonManager/commit/a88a79910c649066cf234c43983d469ad0502ea6))
* **tasks:** created task-friction-fingerprint-separator-not-length-prefixed ([9f1f31b](https://github.com/Arggon/ArggonManager/commit/9f1f31b5b58ec191e66bd4042cb7f7492a199438))
* **tasks:** created task-init-force-residual-followups ([90829c8](https://github.com/Arggon/ArggonManager/commit/90829c8ca9ea536863bf9be2a290823ba777965c))
* **tasks:** created task-native-panel-hierarchy-links ([1613579](https://github.com/Arggon/ArggonManager/commit/1613579f8ef13a1e15a2812558bcea02aac6fb80))
* **tasks:** created task-playbook-panel-hierarchy-keys ([f73d0f4](https://github.com/Arggon/ArggonManager/commit/f73d0f4036a9f59c34d2097b5974cdff64e12b3e))
* **tasks:** created task-plugin-bundle-near-byte-ceiling ([d03e547](https://github.com/Arggon/ArggonManager/commit/d03e547b124bbbc3eb5be6c25a650baea78e7c6a))
* **tasks:** created task-publish-auth-hint-review-observations ([1fef1b6](https://github.com/Arggon/ArggonManager/commit/1fef1b6c384610036d7ddb3f4275453e164a3a52))
* **tasks:** created task-scratch-comment-persistence-probe ([efc6b76](https://github.com/Arggon/ArggonManager/commit/efc6b76447f0a884b6d5bc3558a4d2be4779c8c7))
* **tasks:** created task-spec-plan-pairing-vs-shared-number-sequence ([c6064af](https://github.com/Arggon/ArggonManager/commit/c6064af431fd6c5ddc7cf031b3caa6e01f1f68a2))
* **tasks:** created task-stale-citations-to-renumbered-doc-stems ([33c08af](https://github.com/Arggon/ArggonManager/commit/33c08afe4df5f76136ae24031341cffe4bc69c75))
* **tasks:** created task-sweep-auto-done-refusal-warnings ([e3b66e1](https://github.com/Arggon/ArggonManager/commit/e3b66e1114646ef3ac197f6a25308ca039baff5e))
* **tasks:** created task-tui-hierarchy-jump ([aaec733](https://github.com/Arggon/ArggonManager/commit/aaec7333229d88ae920568d3a065e545930aa456))
* **tasks:** created task-validate-refuses-placeholder-bodies ([6c790bd](https://github.com/Arggon/ArggonManager/commit/6c790bd120f32df99ebfb1eae198b1fa8685c337))
* **tasks:** created task-wave1b-agent-native-bodies ([8e4622f](https://github.com/Arggon/ArggonManager/commit/8e4622f60bba75432b736549fa277c106a58bff7))
* **tasks:** created task-wave1b-mixed-bodies ([d05f42d](https://github.com/Arggon/ArggonManager/commit/d05f42d05707730ea270b61105104b2595d8c15a))
* **tasks:** created task-web-board-hierarchy-links ([6a3c6ae](https://github.com/Arggon/ArggonManager/commit/6a3c6ae13de39403f846d6be5e5e3282e2b74d52))
* **tasks:** created task-zcode-lead-role-belongs-to-the-main-session ([fbb45c7](https://github.com/Arggon/ArggonManager/commit/fbb45c74f2229609c4fc68b02670b7d80bb7de65))
* **tasks:** done bug-convention-md-links-nonexistent-adr-0015 ([c008f6f](https://github.com/Arggon/ArggonManager/commit/c008f6fe3c8e1edeef199c06b765195b0a084c8e))
* **tasks:** done bug-release-lockfile-sync-step-cannot-run ([8b1a10b](https://github.com/Arggon/ArggonManager/commit/8b1a10b8603728b6df5b630b01c938ce171bc529))
* **tasks:** done bug-template-only-bodies-ship-green ([bc5c2bc](https://github.com/Arggon/ArggonManager/commit/bc5c2bcb5521fc01628328f70712f07e41c55930))
* **tasks:** done task-author-ci-wall-clock-bodies ([ecf183d](https://github.com/Arggon/ArggonManager/commit/ecf183db25035ae162747869c307d026973b8058))
* **tasks:** done task-author-harness-transfer-bodies ([b5e8ceb](https://github.com/Arggon/ArggonManager/commit/b5e8cebb5674a9f068d92dfdbeede9d29ff818b8))
* **tasks:** done task-author-methodology-improvements-bodies ([02c063b](https://github.com/Arggon/ArggonManager/commit/02c063b0c30d35627ce36f7a660aaff0277cbb53))
* **tasks:** done task-author-methodology-productization-bodies ([9185aae](https://github.com/Arggon/ArggonManager/commit/9185aae676e8005db33a256cb5960d2e1b3de2cd))
* **tasks:** done task-author-parallel-worktree-bodies ([ce20e4e](https://github.com/Arggon/ArggonManager/commit/ce20e4e32af7d36ebd7072e1a0bce24f53859a22))
* **tasks:** done task-author-spec-pipeline-body ([548518d](https://github.com/Arggon/ArggonManager/commit/548518db476b151cb93ef3a04a6512d5de2c6107))
* **tasks:** done task-author-tooling-env-bodies ([831478a](https://github.com/Arggon/ArggonManager/commit/831478ac5184e90b2d862d96f688658e8a043e2a))
* **tasks:** done task-friction-tier-b-url-and-optout ([8665850](https://github.com/Arggon/ArggonManager/commit/8665850f9693c57db201f035b168b3d3628b86d0))
* **tasks:** done task-measure-kernel-refusal-rate ([fe2ec44](https://github.com/Arggon/ArggonManager/commit/fe2ec448062599255d467b59228ec997a3fb750c))
* **tasks:** done task-native-panel-hierarchy-links ([aa3eb77](https://github.com/Arggon/ArggonManager/commit/aa3eb773584240b51c327cd87a7eae3a40f8b832))
* **tasks:** done task-plugin-test-type-coverage ([fcd9d06](https://github.com/Arggon/ArggonManager/commit/fcd9d06d8948b81a3057ab88e8f2b253b95c2a3f))
* **tasks:** done task-release-pipeline-baseline-new-collisions ([49e09d5](https://github.com/Arggon/ArggonManager/commit/49e09d5621d18689ad9c33f1ccbf04ec6541c7bb))
* **tasks:** done task-scratch-comment-persistence-probe ([48d9685](https://github.com/Arggon/ArggonManager/commit/48d9685d5e449684e0e42ef51b9573634140aa96))
* **tasks:** done task-skill-json-contract-names-claude-code ([7a5892a](https://github.com/Arggon/ArggonManager/commit/7a5892aa3d0f682a34dfabc8e12421481b6d52ee))
* **tasks:** done task-tui-hierarchy-jump ([31f0538](https://github.com/Arggon/ArggonManager/commit/31f0538f29aa1e0e3eeca069775c157c4e49ecc3))
* **tasks:** done task-validate-refuses-placeholder-bodies ([e8824e0](https://github.com/Arggon/ArggonManager/commit/e8824e0b787730e20743de587a393fdad4f4e1da))
* **tasks:** done task-wave1b-agent-native-bodies ([b2edeb8](https://github.com/Arggon/ArggonManager/commit/b2edeb812b17959fc6a9cb4c13d5a73b0a059148))
* **tasks:** done task-wave1b-mixed-bodies ([3846d37](https://github.com/Arggon/ArggonManager/commit/3846d3745f61dbc731bef48b3cebe57ab177303a))
* **tasks:** done task-web-board-hierarchy-links ([a01a588](https://github.com/Arggon/ArggonManager/commit/a01a588380ecbd13372cad582df03e76ff2d3b1a))
* **tasks:** done task-zcode-automations ([4bf04a9](https://github.com/Arggon/ArggonManager/commit/4bf04a9b870dc4c53a04ea035d7daf6244e1b6e4))
* **tasks:** done task-zcode-lead-role-belongs-to-the-main-session ([f403107](https://github.com/Arggon/ArggonManager/commit/f4031079f04f8335c34a04f8c76c0eebb9910a1f))
* **tasks:** done task-zcode-live-verification (cascade: native-zcode-integration) ([df0d1d1](https://github.com/Arggon/ArggonManager/commit/df0d1d12b917bbd4a59487f42be8e1229296c5d1))
* **tasks:** done zcode-native-arggonmanager-mcp-parity-plugin-seam ([cc9af32](https://github.com/Arggon/ArggonManager/commit/cc9af32e0c96f90aedc1f8b2b67abc31d04ac179))
* **tasks:** filled live Acceptance of task-decision-pending-methodology-improvements-014 (ADR 0025 live-section gate) ([77a1441](https://github.com/Arggon/ArggonManager/commit/77a1441b4c69f3d8804a3fd08058e16933a83579))
* **tasks:** generated init docs (46 files) ([8adbf88](https://github.com/Arggon/ArggonManager/commit/8adbf88e327c5faead153fef7db8397a75371043))
* **tasks:** generated init docs (46 files) ([953d299](https://github.com/Arggon/ArggonManager/commit/953d299c77abe265ef0c09f589f6575dd013e40f))
* **tasks:** generated init docs (46 files) ([7be1828](https://github.com/Arggon/ArggonManager/commit/7be1828b38f821d81dad2176e479ea02fcd2686e))
* **tasks:** generated init docs (49 files) ([9ee83dd](https://github.com/Arggon/ArggonManager/commit/9ee83ddc1b522e0bf9bb980afc397551ffc35a2f))
* **tasks:** generated init docs (49 files) ([8d953b2](https://github.com/Arggon/ArggonManager/commit/8d953b233c560566144ce1f1d77fd39aa23fe64f))
* **tasks:** generated init docs (49 files) ([382aee9](https://github.com/Arggon/ArggonManager/commit/382aee9caff30020af7c1a5668643d2e08b204ba))
* **tasks:** generated init docs (49 files) ([b095051](https://github.com/Arggon/ArggonManager/commit/b0950510789a0062d647c90d2f88e7b2d4b51eb1))
* **tasks:** generated init docs (50 files) ([553fb2f](https://github.com/Arggon/ArggonManager/commit/553fb2ff5d9f0b77f2fa89a07b3dd27e60c7cfb9))
* **tasks:** implemented spec/plan zcode-native-seam-012 + closed native-zcode-integration acceptance (full pass on task-zcode-live-verification) ([b331ccc](https://github.com/Arggon/ArggonManager/commit/b331ccc700b222752608d6a984851e6d53c4127f))
* **tasks:** prettier bug-release-lockfile-sync-step-cannot-run after the tracker appends ([cfcdf48](https://github.com/Arggon/ArggonManager/commit/cfcdf483e527590b091c2cbceb6c28edb1c58d7e))
* **tasks:** prettier the correction comment on bug-release-lockfile-sync-step-cannot-run ([cc8dd04](https://github.com/Arggon/ArggonManager/commit/cc8dd0431fe1c09ddf5b9c059c05b73d59a0a4d7))
* **tasks:** prettier the second-defect records on bug-release-lockfile-sync-step-cannot-run ([7fe8966](https://github.com/Arggon/ArggonManager/commit/7fe896692d30ed7144f23b5512af2e9f87aa6aaf))
* **tasks:** pruned bug-adr-status-drift-merged-adr-proposed, bug-init-force-drops-x-tracker-block, bug-skill-exploration-reference-fails-prettier, task-decision-pending-methodology-improvements-014, task-release-pipeline-baseline-new-collisions, task-renumber-colliding-doc-numbers, task-spec-deps-022-no-error-path, task-spike-friction-tier-b-surface, task-stale-citations-to-renumbered-doc-stems ([8f23385](https://github.com/Arggon/ArggonManager/commit/8f233858b170074933f4fb2601b59a9b56c8381f))
* **tasks:** pruned bug-autorelease-label-lifecycle-unowned, bug-release-config-workflow-agreement-ungated, bug-release-lockfile-sync-step-cannot-run, bug-release-needs-auth-self-describing ([00eaf37](https://github.com/Arggon/ArggonManager/commit/00eaf373b827ed08a3b289d011b0a87c5588048f))
* **tasks:** pruned bug-convention-md-links-nonexistent-adr-0015, bug-done-gate-whole-body-scan-counts-fenced-repro-boxes, bug-prettier-indented-list-continuation-grows-2-spaces-per-write, task-claude-adapter-spec, task-friction-dedupe-and-report, task-plugin-bundle-near-byte-ceiling ([7886978](https://github.com/Arggon/ArggonManager/commit/78869788c3f8db15c371f8f77e0f2ef7b23c72d7))
* **tasks:** pruned bug-convention-parser-rejects-valid-yaml-force-rescaffolds, bug-native-guard-silent-without-worktree-declaration, bug-no-gate-warns-on-paired-impl-and-test-deletion, bug-prettier-glues-split-inline-code-span, task-ci-required-check-missing-spec-analyze-baseline, task-friction-capture-command, task-friction-fingerprint-separator-not-length-prefixed, task-friction-redaction-at-write ([bc17695](https://github.com/Arggon/ArggonManager/commit/bc17695de93d116ea1a9a90ee4e2e3f4aad55446))
* **tasks:** pruned bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes, bug-stale-x-generated-records-goal-mode-seam-pair ([27b8400](https://github.com/Arggon/ArggonManager/commit/27b8400052276501e41fc15d45df63f1bdf88e56))
* **tasks:** pruned task-author-ci-wall-clock-bodies, task-author-harness-transfer-bodies, task-author-tooling-env-bodies ([3db009d](https://github.com/Arggon/ArggonManager/commit/3db009d349126531b954a0a66235bcc6e733634f))
* **tasks:** pruned task-author-methodology-improvements-bodies ([9938e86](https://github.com/Arggon/ArggonManager/commit/9938e8644ac70ca24107920571cf20f49f2f9f92))
* **tasks:** pruned task-author-methodology-productization-bodies, task-measure-kernel-refusal-rate ([93c9a5e](https://github.com/Arggon/ArggonManager/commit/93c9a5ec5701a40f3a91f1ab25b164cdb69d385e))
* **tasks:** pruned task-author-parallel-worktree-bodies ([0cb3f94](https://github.com/Arggon/ArggonManager/commit/0cb3f94dfc0b4718229f001bd3b64c83d7c885a9))
* **tasks:** pruned task-author-spec-pipeline-body ([d439748](https://github.com/Arggon/ArggonManager/commit/d439748c678e3d6ae6743d08c1e2704ad0bc9080))
* **tasks:** pruned task-friction-tier-b-url-and-optout, task-native-panel-hierarchy-links, task-tui-hierarchy-jump, task-web-board-hierarchy-links ([5033360](https://github.com/Arggon/ArggonManager/commit/5033360f712f2a547bb566364bc5e0cfafd8f27a))
* **tasks:** pruned task-plugin-test-type-coverage, task-skill-json-contract-names-claude-code, task-zcode-automations ([31cb07b](https://github.com/Arggon/ArggonManager/commit/31cb07b192fa56218b72dbe13e4f3224248d7dd6))
* **tasks:** pruned task-wave1b-agent-native-bodies, task-wave1b-mixed-bodies ([056d29e](https://github.com/Arggon/ArggonManager/commit/056d29e7e3205822a57996fb9ae31790c3eedcb0))
* **tasks:** pruned task-zcode-lead-role-belongs-to-the-main-session, task-zcode-live-verification ([eb005ea](https://github.com/Arggon/ArggonManager/commit/eb005ea64de1ec4350f6f673a2414b9fc77341da))
* **tasks:** resolve the tracker item merge in task-claude-adapter-spec ([79ee66a](https://github.com/Arggon/ArggonManager/commit/79ee66a43c17bb7bf3bae73d0b496e08b06705e3))
* **tasks:** restart leg verified on task-zcode-live-verification (boxes 1,2,4,5 + restart box) ([1963a2e](https://github.com/Arggon/ArggonManager/commit/1963a2e2fcb1615d3b0da707fcc913a6ead0bdab))
* **tasks:** scoped bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes ([315d5cf](https://github.com/Arggon/ArggonManager/commit/315d5cf610165fb7f027191eb8a8e93e131b4bf3))
* **tasks:** scoped bug-stale-x-generated-records-goal-mode-seam-pair ([70c2134](https://github.com/Arggon/ArggonManager/commit/70c2134536229fff617ed3151072de3904c71695))
* **tasks:** scoped task-zcode-lead-role-belongs-to-the-main-session ([668b278](https://github.com/Arggon/ArggonManager/commit/668b278265fbfc7e7ab9c449cd70b73013890851))
* **tasks:** tick acceptance for bug-adr-status-drift-merged-adr-proposed ([3a6e443](https://github.com/Arggon/ArggonManager/commit/3a6e4436f45b4cc62c9a7cabd0fc3ba27adaa9ef))
* **tasks:** tick acceptance for bug-convention-parser-rejects-valid-yaml-force-rescaffolds ([096fae2](https://github.com/Arggon/ArggonManager/commit/096fae24b1bdc5b6aa35113a89a968c251859b9f))
* **tasks:** tick acceptance for bug-native-guard-silent-without-worktree-declaration ([1802e75](https://github.com/Arggon/ArggonManager/commit/1802e75e5a98fbfbbb2e51f9d7143f389bf88ef8))
* **tasks:** tick criterion 4 on bug-skill-exploration-reference-fails-prettier ([728d9a6](https://github.com/Arggon/ArggonManager/commit/728d9a62e78f513609aa9180ba9d847bdf68bde1))
* **tasks:** tick task-zcode-automations acceptance (all three met) ([5781e01](https://github.com/Arggon/ArggonManager/commit/5781e0186fd87e7fc7e14dc613c4f43dafcd6df2))
* **tasks:** tick the acceptance checklist for bug-init-force-drops-x-tracker-block ([e66f3ca](https://github.com/Arggon/ArggonManager/commit/e66f3cad43ea1dcd849f252fcd6ad52b12551a6e))
* **tasks:** tick the acceptance checklist for bug-skill-exploration-reference-fails-prettier ([53bff1a](https://github.com/Arggon/ArggonManager/commit/53bff1ac6ba67a2b162d46b18e0f62b1ed8f2a3b))
* **tasks:** ticked 2026-10-06 acceptance-addition boxes of task-release-pipeline-baseline-new-collisions (all five verified landed) ([f68ffb3](https://github.com/Arggon/ArggonManager/commit/f68ffb351cfa7a225fb90ce8d6e8b4ca204834e8))
* **tasks:** ticked AC 1-3 of task-zcode-lead-role-belongs-to-the-main-session (AC 4 pending CI, AC 5 live) ([d1c16d1](https://github.com/Arggon/ArggonManager/commit/d1c16d1c7ec0e90487c098962c023bd804a64575))
* **tasks:** ticked AC 4 of task-zcode-lead-role-belongs-to-the-main-session (CI green on [#677](https://github.com/Arggon/ArggonManager/issues/677); AC 5 live left open) ([0ad02a9](https://github.com/Arggon/ArggonManager/commit/0ad02a9db370e02660375b4755d2f4f571f91b49))
* **tasks:** ticked AC 6 of task-zcode-live-verification (PostToolUse(Agent) errored-dispatch box — Stop/TTL sufficiency confirmed, TTL 2h) ([0bf387b](https://github.com/Arggon/ArggonManager/commit/0bf387be7c40ad2276008ebcdfbae99f71d68351))
* **tasks:** ticked acceptance boxes of task-friction-redaction-at-write + task-ci-required-check-missing-spec-analyze-baseline (work merged with evidence in PRs [#701](https://github.com/Arggon/ArggonManager/issues/701)/[#697](https://github.com/Arggon/ArggonManager/issues/697)) ([62b67dc](https://github.com/Arggon/ArggonManager/commit/62b67dc6696691946d2509e35ebce6809876b267))
* **tasks:** ticked criteria comment of task-spec-deps-022-no-error-path (live section + comment now agree; ADR 0015 done gate scans the whole body) ([5a6321b](https://github.com/Arggon/ArggonManager/commit/5a6321b45ee37409ab4bce4f203d3e3902688373))
* **tasks:** ticked filing-comment criteria of task-friction-fingerprint-separator-not-length-prefixed (all five landed with evidence in PR [#704](https://github.com/Arggon/ArggonManager/issues/704)) ([cccd82f](https://github.com/Arggon/ArggonManager/commit/cccd82f2d7f207bd03c4cf11b52647349f01099c))
* **tasks:** ticked live box of task-zcode-lead-role-belongs-to-the-main-session (reinstall + restart verified) ([b553eff](https://github.com/Arggon/ArggonManager/commit/b553eff468e6e31254908dbda845ca7c57e090f8))
* **tasks:** transcribe live acceptance criteria (done-gate live-section contract) ([ccdca23](https://github.com/Arggon/ArggonManager/commit/ccdca23a554de0f3fe4ef3f7c69651b33ffb3921))
* **tasks:** transcribe the live acceptance contract for bug-init-force-drops-x-tracker-block ([12cf94f](https://github.com/Arggon/ArggonManager/commit/12cf94fc45f84dd2cd678336daf0b8049a227fea))
* **tasks:** transcribe the live acceptance contract for bug-skill-exploration-reference-fails-prettier ([03cce3b](https://github.com/Arggon/ArggonManager/commit/03cce3be0b1904845bddb2a735dabd756879a153))
* **tasks:** updated bug-release-lockfile-sync-step-cannot-run ([3b48811](https://github.com/Arggon/ArggonManager/commit/3b488116010074d8e85260bc6b922a5287f925c7))
* **tasks:** updated task-friction-dedupe-and-report ([a738f60](https://github.com/Arggon/ArggonManager/commit/a738f60eab956dfa1d5758f3aef8c60e5b8c96a8))
* **tasks:** updated task-validate-refuses-placeholder-bodies ([114aa96](https://github.com/Arggon/ArggonManager/commit/114aa9695bafc577f8c3431ce9e4d3cd6cda529b))
* **tasks:** verdicts for [#715](https://github.com/Arggon/ArggonManager/issues/715) and the bundle item ([27e295c](https://github.com/Arggon/ArggonManager/commit/27e295c1fbf389f79eff455f1478352ea1d17a24))
* **tracker:** author bodies for ci-wall-clock story + 2 placeholder tasks ([9ad90ac](https://github.com/Arggon/ArggonManager/commit/9ad90acc0d6b2bfde77420b8673f1f2e6168e898))
* **tracker:** author bodies for harness-transfer + lesson-store placeholder tasks ([8d07381](https://github.com/Arggon/ArggonManager/commit/8d07381fa06d27781746b151ae5fe38f2b0a7abe))
* **tracker:** author bodies for parallel-worktree story + 4 placeholder tasks ([1ae8bb2](https://github.com/Arggon/ArggonManager/commit/1ae8bb2f0d8d2f4dcf69e8624ea6dcc0b599d46d))
* **tracker:** author Context and Acceptance for 10 methodology-productization containers (task-author-methodology-productization-bodies) ([525d289](https://github.com/Arggon/ArggonManager/commit/525d289395f76193a889366f6f1b5e33bffcb1be))
* **tracker:** author live bodies for 12 methodology-improvement placeholders ([808e7f6](https://github.com/Arggon/ArggonManager/commit/808e7f6f55a46ec836ca95b81515ebf8aef3e8e0))
* **tracker:** author live bodies for 3 tooling-and-environment placeholders ([556c707](https://github.com/Arggon/ArggonManager/commit/556c70744c1228b88ab5f8bfc2b01e85db8f9fee))
* **tracker:** author live body for task-spec-analyze-naming-and-skill-mirror ([613a9c4](https://github.com/Arggon/ArggonManager/commit/613a9c4ceffef378510ad6d90cb7cb7823309f5e))
* **tracker:** board build-stamp task (stale-drawer report) ([01e32f7](https://github.com/Arggon/ArggonManager/commit/01e32f78a141c30c686c1cbca633432606d0a947))
* **tracker:** context + acceptance for lockfile-sync step failure (release-please.yml) ([f26ecb7](https://github.com/Arggon/ArggonManager/commit/f26ecb7960ec2095f8febe220419a6989158f428))
* **tracker:** context + acceptance for publish-auth-hint review observations ([#741](https://github.com/Arggon/ArggonManager/issues/741)) ([0ee0833](https://github.com/Arggon/ArggonManager/commit/0ee0833d5fa5a1e775aaf544073da147e04c3a4e))
* **tracker:** context + acceptance for renumber-wave review findings (pairing rule, prettier scope creep) ([19594a8](https://github.com/Arggon/ArggonManager/commit/19594a89c3d7ddffbd5e71451e73595a91b161a4))
* **tracker:** context+acceptance for template-guard bug, container-body task, hierarchy-navigation story ([35c8979](https://github.com/Arggon/ArggonManager/commit/35c8979183494e11ec8fb20bdeca6b7bf81b2c14))
* **tracker:** dated Notes on the auth-vs-404 classification decision ([8300383](https://github.com/Arggon/ArggonManager/commit/8300383538da1e28e32c00ef04938cd1929a4470))
* **tracker:** depends-on serialization bug (decided-A wave fallout) ([6895f97](https://github.com/Arggon/ArggonManager/commit/6895f976c7a6c78a24fdfa0dbee408af15a8254b))
* **tracker:** guard-bug acceptance tracks decided A (blocking) ([a910834](https://github.com/Arggon/ArggonManager/commit/a91083469aaf9b030d5545a214f0dc1738207da9))
* **tracker:** merge-ownership methodology bug (owner prompt, PR [#731](https://github.com/Arggon/ArggonManager/issues/731) dwell) ([853c36b](https://github.com/Arggon/ArggonManager/commit/853c36b81ce55ec3525b5ac31f3f7a55a4170bc2))
* **tracker:** prettier-canonical formatting for the item body's comment blocks ([9299717](https://github.com/Arggon/ArggonManager/commit/92997170d416aabbdfcb90eb9fbd87aa0b2af255))
* **tracker:** tick bug-release-needs-auth-self-describing acceptance (gates green, evidence on the item) ([132e369](https://github.com/Arggon/ArggonManager/commit/132e369b85f34fffa47c82a1111ebd01a20e9a28))
* **tracker:** tick real-run box for lockfile-sync fix (run 38294418386 green, push 4f2febb) ([8aa8f8c](https://github.com/Arggon/ArggonManager/commit/8aa8f8c45187e9d1bbed3bdce3c06b56d3612aee))
* **tracker:** wave-1 body tasks + wave-2 blocking-guard task (decided A) ([547c98b](https://github.com/Arggon/ArggonManager/commit/547c98b2e5fc69cbc4123003adc3cc57414ee089))
* **tracker:** wave-1b agent-native bodies for 12 placeholder bugs ([11663e3](https://github.com/Arggon/ArggonManager/commit/11663e36017a9506ea0dafc0855c453dbf04a020))
* **tracker:** wave-1b body tasks (guard commit gate) ([68238f0](https://github.com/Arggon/ArggonManager/commit/68238f0d243aaa0d11114ac612e0a8e14c6bb0dc))

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
