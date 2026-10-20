# "Trust No Robot": Junction 3D: Saboteur Express trailer, 55 s, 1080×1920

## Concept

A thriller trailer cut like a hidden-role game reveal, built from real footage of the 3D game. The story is a single staged
game: four robots, one of them secretly sabotaging Europe's railway. You walk the rails, solve a landmark task that clears
Sandy, watch Rose black out München–Wien, call the emergency meeting, and vote out Mint, who turns out to be innocent.
In the dark, Rose's eye opens. The saboteur gets away with it. Smash to title.

**How it's made.** The 3D shots are rendered from `../junction3d-saboteur.html` itself in director mode (fixed 1/30 s steps,
scripted cameras, HUD hidden) by `tools/shoot.mjs`. The robots, routes, sabotage beacon, sparks and ejection are the game's own.
On top, the canvas layer adds a dusk and night grade, eyes that stay lit in the dark (re-lit from the footage at each robot's
projected eye position), alarms, titles and the game's real UI screens. Those screens come from the same game at phone size:
the Eiffel Tower task, the alibi, the ship log with its sightings, the red Meeting button, the vote, the verdict, and the end
screen. The overlays draw no game state of their own.

**References.** Hidden-role reveal trailers: a slow lineup, lights out, a hard hit on the reveal word, a power cut into alarms,
a heartbeat under the vote, silence on the verdict, and a final twist. No Among Us art, sounds, music or name are used;
the characters are Junction's own hex-bodied Sprocket robots.

## Voice direction

Kokoro-82M, a blend of 60 % `am_onyx` and 40 % `am_michael` (about 95 Hz median pitch), at 0.9× speed with a slower
0.80–0.86× on the cliffhanger lines. The read is low and deliberate, like a movie-trailer narrator. "But one of them…"
and "is a saboteur." are separate takes with 1 s of silence between them, as are "Choose wrong…" and "and the saboteur gets
away with it." The voice gets a warm low shelf, light compression and a darker room than the cheerful promos.

## Script and shot list

| time (s) | scene | narration | picture (3D footage unless noted) |
|---|---|---|---|
| 0.0–5.6 | Open | "Twenty trains. Four robots. One railway across Europe." | A dusk-graded aerial sweep over the 3D map while the robots wander between cities. Titles glitch in on the words: 20 TRAINS · 4 ROBOTS · 1 RAILWAY · ACROSS EUROPE. |
| 5.6–11.2 | Lineup | "But one of them…" / "is a saboteur." | The four robots in a row on open ground east of Warszawa, with a slow dolly. The lights flicker out until only their eyes are lit; three of them narrow. On "saboteur": a heavy brass-style hit, a red flash, and SABOTEUR. |
| 11.2–14.6 | Build | "Walk the rails. Claim the routes." | A chase cam as You walks out of Paris onto Paris–Zürich. The route claims mid-walk and its cars pop teal (the game's own claim). |
| 14.6–20.8 | Tasks | "Solve station tasks for locomotives… or check a robot's alibi." | Over a blurred orbit of You in Paris: the game's real Eiffel Tower task (the right answer gets ringed), then the reward choice, then "Sandy's alibi checks out" with a SANDY: CLEARED stamp. |
| 20.8–23.6 | Sabotage | "Then the signals fail." | A power cut: the picture flickers dark as Rose walks onto München–Wien. On "fail", the game's sabotage fires: sparks, the cars turn dark red, the warning beacon lights. Alarm lighting, ⚠ SABOTAGE, SIGNAL FAULT · MÜNCHEN – WIEN. |
| 23.6–28.8 | Sightings | "A route goes dark. And two robots were seen nearby." | Overhead on the beacon. Pings at Rose in München and Mint in Wien, with labels pinned to the 3D positions, and "Sandy was in Amsterdam · cleared ✓". The game's real ship-log entry slides up. |
| 28.8–36.0 | Meeting | "You get one emergency meeting. One vote." | The game's red Meeting button is pressed: EMERGENCY MEETING. Then the three suspects in close-up under a spotlight that follows the deliberation. Rose squints at Mint while Mint's eye darts. The real vote sheet, with the selection hopping Rose → Mint → Rose → Mint, then EJECT. |
| 36.0–42.2 | Eject | (silence, then text) | Mint, eyes wide, is flung off the map by the game's ejection animation in a long spinning arc into the Black Sea. "Mint was innocent. The saboteur is still out there. −5 pts" (the game's words). |
| 42.2–46.8 | Twist | "Choose wrong…" / "and the saboteur gets away with it." | Darkness. Rose's eye opens in close-up, glows, then narrows. The game's real end screen glitches in: "Rose wins. The saboteur was Rose. They were never caught and earned +10." |
| 46.8–55.0 | Title | "Junction. Saboteur Express." / "Pick a quick game. Trust no robot." | A white flash and a hit over the aerial map at night: JUNCTION · SABOTEUR EXPRESS · 3D · ACROSS EUROPE · TRUST NO ROBOT. Call to action in the game's button style: Quick game · 20 trains each, about 10 minutes. "You vs. three robots · plays in your browser". |

## Music and sound

The score is original and synthesized in `tools/make_audio.py`. Its 100 BPM ostinato runs exactly four bars across build and
tasks, and returns for the title.

- **Open and lineup:** a low drone, a muffled train rhythm that builds, a lonely piano motif, then a heartbeat and tremolo strings as the lights die. The music cuts to silence just before the hit on "saboteur", which is followed by a low dissonant cluster.
- **Build and tasks:** a driving D-minor ostinato (Dm–B♭–Gm–A) of staccato strings, pulse bass, kick and snap, a 16th-note train chug and a bell counter-line, with a tom fill.
- **Sabotage and sightings:** a hard power-cut, then distorted low pulses under an original two-tone klaxon, with a dissonant high cluster and a ticking clock.
- **Meeting:** low stabs on the button, then a heartbeat that speeds up toward the vote, under a rising cluster and a riser.
- **Eject and twist:** a slow, sad piano and a single low note on the verdict, then a sub drone with an eerie music-box line.
- **Title:** the ostinato returns, then a final hit that rings out.

The sound effects are all synthesized: the brass-style hit, booms, rail rumble, carriage clunks, light flicker, glitches, zaps,
UI blips, the power-down, klaxon, sparks, sighting pings, the button, door, thud, typewriter, low note and eye shimmer.
Every cue is placed from the narration's word timestamps.
