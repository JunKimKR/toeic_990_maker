# TOEIC 990 Adaptive Trainer

A mobile app (Expo / React Native / TypeScript) for a learner at ~900 who is aiming for 990. Each day it works out the biggest bottleneck between the learner and 990 and builds a ~30-minute session around it. It generates **new** questions for that session, keeps re-estimating the learner's skills, and changes the next session based on what it learns.

The app runs **fully offline**. The built-in engine generates new questions procedurally. An optional backend adds LLM-generated questions and neural TTS. API keys live only on that server.

---

## 1. What it does

| Loop step | Where |
|---|---|
| Learner performance → **skill model** (25 fine-grained skills, Elo/Glicko-lite) | `src/domain/skillModel.ts` |
| **Weakness detection** + time allocation (not hard-coded) | `src/domain/scheduler.ts` |
| **Today's blueprint**: time-budgeted slots, interleaved formats, challenge finale | `src/domain/planner.ts` |
| **Question generation** → critic → duplicate detector → difficulty calibrator | `src/generation/*` |
| **Training** (audio, 1-tap confidence submission, 3-step explanations) | `src/app/session.tsx` |
| **Error analysis** (mistake cause + trap type, hedged diagnosis) | `src/domain/errorAnalysis.ts` |
| **In-session adaptation** (3 fast correct → harder; 3 hard misses → easier + focus) | `src/domain/adaptation.ts` |
| Skill update → **next session** changes | `src/services/engine.ts` |

### Screens
Today (home) · Training · Result · Skill Map (radar, per-skill trend, readiness indicators) · Weakness (top 3 bottlenecks, mistake causes, traps) · Vocabulary · History · Settings · 오답 다시보기 (review mode) · hidden Developer Dashboard (Settings → tap the version line 7 times).

---

## 2. How the learner's score profile is used

The ETS score-report categories seed the 25 skills (`src/domain/skills.ts → SEED_MAP`):

| ETS category | Score | Seeds |
|---|---|---|
| extended_spoken_gist | 68 | extended_gist (+ purpose, next action, role/location as averages) |
| speaker_purpose_or_implied_meaning | 65 | speaker_intent, implied_meaning (+ indirect_response, purpose) |
| short_spoken_gist | 80 | short_gist |
| short / extended detail | 100 / 94 | short_detail (capped at 97), extended_detail |
| written vocabulary / grammar | 79 / 85 | vocabulary / grammar |
| inference / specific info / cross-sentence | 96 / 95 / 92 | reading skills |

Skills taken directly from the report start with lower uncertainty (σ 0.6) than derived ones (σ 0.8). The **detail 94 vs. gist 68** gap is preserved. The scheduler therefore spends Listening time on purpose, intent, implied meaning and next action, not on dictation or detail drills. It also adds a training-only **"flow" item** (purpose → problem → resolution) that trains integrating details into the overall gist.

The initial split that comes out of the formula (not hard-coded): **Intent ≈ 30–36%, Gist ≈ 22–25%, Vocabulary ≈ 12–15%, Grammar ≈ 8–10%, Maintenance ≈ 10–13%, Challenge 5%.** A test checks it (`tests/scheduler.test.ts`).

---

## 3. Adaptive algorithm (explainable)

**Skill model.** Each skill has an ability θ (logits) and an uncertainty σ.
`mastery = 100·σ(θ)` is the expected accuracy on a standard (difficulty-3 ≈ average TOEIC) item. After each answer:

```
p      = sigmoid(θ − b_item)           b_item = difficulty logit + learned family offset
θ     += K(σ,p) · f · (y − p)          y = 1 if correct
σ²     = 1/(1/σ² + p(1−p)) + noise     (never freezes; inactivity inflates σ)
```

`f` is a **fluency factor** from the performance credit. A first-listen, fast, confident correct answer moves mastery up more. A correct answer after 3 replays, or marked "확신 없음", moves it up less. A confident wrong answer (possible misconception) pulls it down harder and is flagged for priority correction. The estimate itself stays unbiased: a 14-day simulation checks that it tracks a hidden "true" ability (`tests/engine.test.ts`).

Each skill also tracks: attempts, recent / weighted / difficulty-adjusted accuracy, first-attempt accuracy, first-listen accuracy, median response time, last practised, and trend (slope over session snapshots).

**Scheduler.** For each skill:

```
priority = (importance × gap_to_97.5  +  0.06·σ·importance  +  staleness  +  misconception)
           × saturation(last 24h volume) × plateau(stagnating despite practice → ×1.3)
```

Weak skills share the focus budget ∝ priority^1.5 (capped at 32% each). Strong skills (≥ 90) get a small rotating **maintenance** budget. 5% (3–8%, depending on hard-item accuracy) goes to **difficulty-5 challenge** items. A greedy knapsack then turns target seconds into slots. Multi-item sets (Part 3/4/7) can cover several skills at once, and **estimated study time**, not question count, is what gets optimised (25–35 min for a 30-min setting).

**In session.** Difficulty offsets per skill: +0.5 after 3 fast correct answers, −0.75 after 3 misses at difficulty ≥ 4 (plus a remedial focus on the dominant mistake cause), and otherwise a smoothed EWMA drift, so a single miss never swings difficulty.

---

## 4. Why questions don't repeat

1. **No fixed question bank.** Questions are composed at run time from grammars (see §5). Every shown question is stored with metadata and an exposure record.
2. **The generator samples away from recent material.** Templates, reasoning paths, situations and lexical items get "freshness" weights.
3. **An independent 7-level duplicate detector** runs over the window *last 14 days ∪ last 200 items* (`src/generation/duplicate.ts`):

| Level | Check | Policy |
|---|---|---|
| L1 | exact duplicate (normalised text hash, **all-time**) | always reject |
| L2 | lexical similarity (content-word 3-shingle Jaccard ≥ 0.45; names/numbers masked) | reject |
| L3 | same template / sentence skeleton | cooldown per part |
| L4 | same grammar trick ("submitted ___ Friday" ≈ "received ___ Monday") | cooldown |
| L5 | same answer pattern (choice set) | reject in window |
| L6 | same situation back-to-back (LC) | soft |
| L7 | same semantic reasoning path (goal × complication × intent × next action) | 14-day cooldown |

If a slot's content space runs out, the pipeline relaxes only the *soft* levels, then falls back to another format for the same skill. It never relaxes L1/L2/L5. Previously shown questions come back **only** in 오답 다시보기.

**Measured** (`npm run simulate`, synthetic learner, 14 days × 30 min, offline engine only):
0 exact repeats, 0 unfilled slots (~325 units), and balanced answer positions (3-choice 35/35/35, 4-choice ≈130 each). After the strict pool runs out, **about 15% of Part 3/4 sets (≈13 of ≈87)** reuse a reasoning path with different wording, people and situation, and Part 2 reuses 0–15 of ≈114. Vocabulary shows 10–19 re-tests of the same weak word in a new sentence, which is by design (spaced repetition). See Limitations.

---

## 5. Question generation pipeline

```
SKILL SELECTOR → TRAINING BLUEPRINT → [pool of unseen AI questions] → GENERATOR
 → TOEIC STYLE CRITIC → ANSWER VALIDATOR → DISTRACTOR VALIDATOR     (src/generation/critic.ts)
 → DUPLICATE DETECTOR (src/generation/duplicate.ts)
 → DIFFICULTY CALIBRATOR (src/generation/difficulty.ts) → FINAL QUESTION
```

**Offline generators** (`src/generation/generators/`, content in `src/generation/content/`):

- **Part 2:** 62 frames with interchangeable fillers. Correct responses are graded by indirectness (1 direct → 3 indirect). Distractors are typed (similar sound, keyword overlap, wrong question type, …).
- **Part 3:** 16 conversation goals × situation instances × complications × intent lines × next actions. Opening "tiers" control how explicitly the purpose is stated, which drives gist difficulty.
- **Part 4:** 12 talk kits (voicemail, announcements, meeting, tour, workshop, broadcast, ad, orientation, recorded message, award speech, traffic).
- **Part 5:** 37 grammar "tricks", each with several frames + word families, graded by rule difficulty.
- **Vocabulary:** 111 TOEIC-900+ words, each met in rotating formats: cloze → meaning in context → paraphrase → listening recognition, always in a new context.
- **Part 6/7:** passage kits with purpose, detail, inference, vocabulary-in-context, connector and sentence-insertion items (maintenance only).

Every item carries metadata: part, skill, subskill, difficulty, script, choices with distractor types, Korean explanation (short + detail), evidence lines, grammar point, vocabulary targets, situation, topic, question structure, reasoning path, template id, timestamp, source type and semantic fingerprint.

**Critic rules** (reject or penalise): unfilled slots, not exactly one key, untyped second option (possible second answer), duplicate or near-copy options, a key conspicuously longer than the distractors, a/an errors, doubled words, a quoted intent line that isn't in the script, TOEIC set size and script length, and an explanation that doesn't match the key. The pass threshold is score ≥ 70 with no hard failures.

**Answer-position balancing:** the key goes into the least-used position in the recent window.

---

## 6. Listening & audio

- `src/audio/tts.ts` holds the provider abstraction:
  - **Device TTS** (expo-speech, offline). It picks gendered and accent voices (US/UK/AU/CA) when the phone has them, otherwise it separates speakers by pitch.
  - **Remote neural TTS** via the backend `/v1/tts` (OpenAI or ElevenLabs). If a line fails, it falls back to the device voice for that line.
  - **Mock** for tests.
- Every line has a safety timeout, so an engine that never reports "done" can't freeze a session.
- Training mode: 1 play recommended, play count shown, speed 0.9/1.0/1.1×, script hidden until you answer, then shown with evidence lines highlighted. Part 2 options are audio-only (letters only) until you answer.
- Exam mode: plays once automatically, no replay or speed control, no script, time limit, feedback at the end.
- Tracked per answer: plays, first-listen correct, response time (counted from end of audio for LC), confidence and answer changes.

---

## 7. Data model (local-first SQLite)

`src/data/db.native.ts` (web preview: `db.web.ts`, localStorage):

| table | contents |
|---|---|
| `kv` | profile & settings, skill states (SkillState incl. history), family difficulty offsets, generation stats |
| `questions` | every generated question (`status = shown \| pool`) |
| `exposures` | QuestionExposure records (fingerprints for the detector) |
| `exact_hashes` | all-time exact hashes (never re-served) |
| `attempts` | Attempt (choice, correctness, response ms, plays, first-listen, confidence, answer changes, trap type, mistake causes, expected p, credit) |
| `sessions` | TrainingSession (blueprint, mastery before/after, summary) |
| `vocab` | VocabularyItem (meaning, context, collocations, encounters, mastery, formats seen) |
| `jobs`, `decisions` | GenerationJob log and adaptive decision log (dev dashboard) |

Writes go through a sequential write-behind queue. A storage error is logged, and the in-memory session keeps working.

---

## 8. Setup & running

Requirements: Node 20+ and npm. For a phone, install **Expo Go** (all native modules used are included in Expo Go).

```bash
npm install
npm start            # scan the QR code with Expo Go (Android) or the Camera app (iOS)
npm run android      # Android emulator / device via Expo
npm run ios          # iOS simulator (macOS)
npm run web          # browser preview (uses localStorage + Web Speech)
```

**Installable Android APK** (no store): `npx eas-cli@latest build -p android --profile preview` (the profile is in `eas.json`, and you need a free Expo account). **Store builds:** `--profile production` (AAB); iOS: `npx eas-cli@latest build -p ios`.

**Quality gates**

```bash
npm run typecheck    # tsc --noEmit
npm test             # jest: 80 tests (skill model, scheduler, planner, adaptation, duplicate
                     # detection, critic, bulk generation of 400+ questions, full sessions,
                     # 14-day simulation, backend pipeline with a scripted LLM)
npm run simulate -- 14 7   # offline 14-day novelty/distribution/tracking report
```

---

## 9. Optional backend (AI generation + neural TTS)

`server/` is a portable Fetch-API handler (`server/index.ts`) with a Node adapter (`server/dev.ts`).

```bash
cp .env.example server/.env    # fill ANTHROPIC_API_KEY and optionally OPENAI_API_KEY
npm run server                 # http://localhost:8787
```

In the app, go to **Settings → AI 문제 생성 서버** and enter the URL (use your LAN IP for a phone, e.g. `http://192.168.0.10:8787`). Choose **서버 뉴럴 음성** for TTS.

| Endpoint | Purpose |
|---|---|
| `GET /v1/health` | shows the configured providers |
| `POST /v1/generate` | `{specs, avoid}` → validated questions |
| `GET /v1/tts?voice=M-gb&rate=1&text=…` | `audio/mpeg` (LRU-cached) |

**Environment variables** (see `.env.example`): `LLM_PROVIDER` (`anthropic`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5`), `ANTHROPIC_FALLBACKS` (server-side refusal fallback, on by default), `TTS_PROVIDER` (`openai` / `elevenlabs`), `OPENAI_API_KEY`, `OPENAI_TTS_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_IDS`, `APP_TOKEN`, `RATE_PER_MINUTE`, `MAX_SPECS_PER_REQUEST`, `PORT`.

**How AI questions are produced** (`server/generate.ts`):

1. The **generator** call returns a draft as schema-constrained JSON (structured outputs), built from blueprint specs plus recently used reasoning paths and topics to avoid.
2. The server reshuffles answer positions and runs the **same local critic** the app uses.
3. A **separate critic call** solves the item **blind** (no key) and rates naturalness, TOEIC-likeness and difficulty.
4. The item is accepted only if the blind answer matches the key, no alternative is defensible, and naturalness ≥ 7. Difficulty = average of the generator's label and the critic's estimate.
5. The app **re-validates** every received question and stores it in a local pool. Sessions draw from the pool first. The pool is refilled in the background, only for today's deficits, in batches of up to 6.

The learner never waits on the network.

**Adding a provider:** implement `LlmProvider` (`server/llm.ts`) or `ServerTts` (`server/tts.ts`) and select it with the env vars.

**Cost:** each accepted AI question takes 2 LLM calls (generator + critic). With `claude-opus-5` that is roughly a few cents per question. Set `ANTHROPIC_MODEL` to a cheaper model if you prefer, since generation quality is re-checked by the critic anyway.

**Deployment:** any Node host (Render, Fly.io, Railway, a VPS): `npm ci && npx tsx server/dev.ts` behind HTTPS. The handler is also usable from serverless platforms that accept a `Request → Response` function.

**Security:** no key ever ships in the app bundle. The app stores only the backend URL. `APP_TOKEN` (sent as `?token=` in the URL you enter) is only a light abuse guard, because anything in an app can be extracted. For multi-user production, put real auth in front (e.g. Supabase Auth or JWT) and keep the per-IP rate limit.

---

## 10. Project layout

```
src/app/            screens (expo-router)
src/ui/             design system, charts (react-native-svg), audio player, question parts
src/store/          zustand store (wires engine ↔ storage ↔ AI pool)
src/services/       engine (learning loop), AI client, simulator
src/domain/         skills, skill model, scheduler, planner, adaptation, error analysis, vocab, insights
src/generation/     generators, content grammars, critic, duplicate detector, calibrator, pipeline
src/data/           SQLite / web storage + repository
src/audio/          TTS providers
server/             optional backend (LLM + TTS proxies)
tests/              jest suites        scripts/simulate.ts  offline simulator
```

---

## 11. Known limitations (honest)

- **Offline content is large but finite.** At ~30 min/day, the offline engine keeps exact and lexical repeats at zero and fills almost every slot for about two weeks. Beyond that, reasoning patterns (not wording) start to recur more often, especially in Part 2/4. The AI backend is the route to unlimited novelty.
- **Not verified on a physical phone in this environment.** The Android JS bundle builds (Hermes), and the full flow was driven end to end in a headless browser. Device TTS voice quality depends on the phone's installed voices.
- **The AI path was tested with a scripted LLM, not live keys** (no key was available here). Prompt quality with a real model should be spot-checked in the Developer Dashboard.
- No Part 1 (photos) and no "look at the graphic" Part 3/4 items yet. `visual_information_linking` is tracked but not trained.
- Readiness shows objective indicators only; there is deliberately no predicted TOEIC score.
- Single-user, local-first: no cloud sync yet. Data lives on the device, and "reset" wipes it.
- A session interrupted by killing the app is not resumable mid-way. Its answers are kept, and it is summarised into History on the next launch.
- "Multi-passage" (Part 7 double/triple passages) is tracked as a skill but only trained through single-passage inference items.
