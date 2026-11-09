# Element Learn

A local, offline study app for all 118 elements. It has a color-coded interactive periodic table, continuous name/symbol learning, and a separate multiple-choice family game with mistake totals.

## Start

Double-click **start.cmd** in this folder. It opens **http://127.0.0.1:8767** in your default browser. Keep the terminal window open while studying; press Ctrl+C to stop the server. If the app is already running, the launcher reopens it.

Python 3 is already installed on this computer. There are no packages to install and no internet connection is needed. Alternatively, run `python server.py` from this folder. The server listens only on `127.0.0.1` and uses its own port, separate from the C++ and Android apps.

## GitHub Pages

Push this folder to a GitHub repository on its `main` branch. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source. The included workflow publishes `dist/` when `main` is pushed, and can also be run from the Actions tab. After it succeeds, the site is available at `https://USERNAME.github.io/REPOSITORY/`. The site does not require the Python server.

Each of the three activities saves its own progress in this browser's local storage. GitHub Pages and `127.0.0.1` are different origins, so existing localhost progress does not automatically appear on the hosted site. Hosted progress stays in that browser on that origin; private browsing, clearing site data, changing browser or device, or changing the site address creates separate or temporary progress.

## Study

1. Explore the table. Click an element to see its name, symbol, atomic number, family, atomic molar mass, neutral electron count, electron configuration, oxidation states, standard state, and progress. Mass is for a mole of atoms; a molecule can contain more than one atom. Elements without a standard atomic weight show an approximate isotope value. Oxidation states are formal values and do not always correspond to charges of individual ions. Click a family to select its elements, or add individual elements from the detail panel.
2. Choose **Practice all 118**, **Practice selection**, or **Practice this element**. The **Learn** tab resumes your current selection and question.
   For a custom set, click **Make new set**, then click element tiles one after another to add them. Click a selected tile again to remove it. You can also select whole families. **Done selecting** returns to normal exploration; **Practice selected** starts studying your chosen elements. Your selection and selection mode survive a refresh, and creating a set keeps your learning progress.
3. All 118 elements are initially in the study set and the **To learn** list. Each group contains ten elements (the last has eight), keeping similar-name and similar-symbol clusters together. Complete a shuffled multiple-choice pass with one question per element, then shuffled typing passes. Each element needs two correct typed recalls. Learn **symbol → name** first, then **name → symbol**; both directions make an element **Learned**. Missed multiple-choice items return in the typing passes. If a typed answer is missed, later passes continue cycling through the entire group, so a difficult element is always practiced among its peers.
4. Continue into new groups. After every four learning answers, an older learned element is mixed in for typed recall. Overdue checks come first; otherwise practice rotates through older elements. A missed check moves an element to **Needs review**, where two correct recalls in the missed direction restore Learned.
5. Use **Send to back** on a question if that element is a lower priority for your test. An unlearned element waits until the other unlearned elements in your study set are learned, then returns for practice. A learned element's review waits while other questions are answered. Sending an unanswered question back does not grade it, reset a streak, or count as an answer. Already answered questions keep their result. The sidebar shows how many elements were postponed, with **Bring postponed elements back** to restore normal priority.

Name answers ignore capitalization and surrounding spaces, accept aluminum/aluminium, cesium/caesium, and sulfur/sulphur, and accept one uniquely identifiable spelling error. An exact name belonging to another element or an ambiguous typo counts as wrong. Symbols require correct capitalization: **Co**, not **CO** or **co**.

Use **1–4** for multiple choice and **Enter** to check or continue. The table and answer-bearing collections are hidden during practice.

## Progress and retention

The shuffled pass, its position, and everything else are stored in this browser under `element-learn:session:v1`: your selected study set, active group and phase, current question and choices, typed draft, feedback, direction-specific progress, and review schedule. Reloading resumes the exact question, including an already graded answer. Changing the study set keeps your progress across the entire table.

Reviews use **questions answered**, not dates: the first scheduled check is 10 answers after learning an element, then successful scheduled checks extend the interval to 30, 60, and 120 answers. During new learning, an older element is inserted after four learning answers even when none are overdue. Early mixed reviews rotate through previously learned elements and alternate directions without moving their scheduled check farther away. After learning the whole selected set, practice continues with overdue or least recently reviewed elements. Failed checks return sooner; progress is never reset just because you close the app. Postponed priorities and review delays are saved with the session and survive a refresh or study-set change.

Use the same browser and **http://127.0.0.1:8767** each time. A different browser, a different port, `localhost` instead of `127.0.0.1`, private browsing, or cleared browser storage has separate or temporary progress. If saving fails, the app displays a warning and keeps the current session working in memory. **Reset progress** requires confirmation. Existing version-1 saves migrate to the full 118-element study set; version-2 saves keep their current selection. Both upgrade without erasing answers, learned elements, review schedules, drafts, or pending feedback. An unreadable save is backed up in browser storage when possible.

## Element-family game

The **Polyatomic ions** tab practices the 32 ions in the supplied class table. Four groups of eight use multiple-choice recognition in both directions followed by typed recall of names and formulas. Include the charge when typing formulas, for example `SO4^2-` or `NH4+`. Acetate accepts `C2H3O2-` or `CH3COO-`, and hydrogen carbonate accepts bicarbonate. **Study missed** temporarily reviews previously missed ions and then returns to the saved question. Ion progress is stored independently in this browser. **Ion chart** shows every name, formula, and charge in one place.

The **Metal or nonmetal** tab opens a separate two-choice game with independently saved totals and Study missed. It uses the same batches of up to 50 elements and three passes. The bundled dataset's metalloids are excluded because they have properties of both metals and nonmetals.

Open **Families** in the header, or visit **http://127.0.0.1:8767/families.html**. This game has its own progress and works independently of the name/symbol study set.

- **Start a batch of 50** picks 50 different elements. Each appears in three shuffled passes, for 150 multiple-choice questions. Subsequent batches cover another 50, then the remaining 18, before the full 118-element cycle starts again. Even wrong answers move on after feedback; there are no streak requirements or extra repetitions.
- The quiz shows a neutral periodic table with the current element outlined. Names, symbols, atomic numbers and positions are visible, but family colors and answer-bearing family labels are absent. **Locate on table** brings the highlighted element into view on a smaller screen. Choose a family with **1–4**, then use **Enter** to continue.
- Correct answers, missed answers and accuracy accumulate for each element and across the whole game. **Study missed** includes any element with a historical mistake, placing elements with the most misses in the first batch. It also uses at most 50 elements and three passes. A long missed list is covered across successive batches, and lifetime mistakes remain available after successful practice.
- **Study table** pauses the quiz. Use **Show colors / Hide colors** to study the family sections, and click an element for its family and running totals. Return to **Play** to resume the exact question. The quiz table always stays neutral, even if study colors are enabled.
- Normal and missed batches pause independently. Switching between them preserves their questions, options and feedback. All totals and both batches are saved under `element-learn:families:v1`. **Reset family stats** requires confirmation and clears only this game; name/symbol progress stays saved.

## Data and implementation

The bundled element names, symbols, atomic numbers, and classifications come from the [PubChem periodic table JSON dataset](https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON), retrieved September 30, 2026. Category colors follow its ten families; classifications can differ between periodic tables. Positions use the conventional 18-column layout, with elements 57–71 and 89–103 in detached rows.

The app uses static HTML/CSS/JavaScript in `dist/`, pure engines in `dist/engine.mjs` and `dist/family-engine.mjs`, and a Python standard-library server. The 12 stored name/symbol groups combine pairs of the original five-element confusion clusters, starting with the A-symbol and H-symbol clusters. Each pass of new learning is shuffled and asks each element once; mixed reviews appear between those questions. A new pass avoids immediately repeating the last question when other elements are available. Postponed elements keep their original confusion groups when they return. No live AI service or internet fetch is used while studying.

Browsers supporting `document.modelContext` can use two optional WebMCP tools: `read_study_progress` and `set_study_selection`. Both use the same state as the interface. Other browsers work normally. Browser/WebMCP and visual validation were unavailable in this build session because local browser access was declined.

To choose another port, set `PORT` before launching. Set `OPEN_BROWSER=0` to suppress automatic browser opening. The local `/health` endpoint identifies the running app; only explicitly allowed app files are served.

## Verification

Run from this folder:

```powershell
node tools/test_engine.mjs
node tools/test_app.mjs
node tools/test_family_engine.mjs
node tools/test_family_app.mjs
node tools/test_ions.mjs
node tools/test_pages.mjs
python tools/check_server.py
```

The checks cover element data and positions, confusion-group coverage, grading and ambiguity, both learning phases, continuous review and relearning, selections, family-game batches and missed-element coverage, neutral quiz markup, color toggling, exact save recovery, simulated application events and storage failures, and both games' local routes and MIME types. The application tests use isolated mock DOMs; they do not replace visual browser testing.
