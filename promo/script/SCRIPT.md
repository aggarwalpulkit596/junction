# "One Ticket": Junction: Europe promo, 52 s, 1080×1920

## Concept

Every game of Junction starts with a destination ticket. The film follows one real long ticket from
the game, **Edinburgh to Athína** (21 points; its shortest line takes 18 trains, inside a 20-train
Quick game), from the moment it's dealt to the moment it's scored. Each rule is shown at the point
on that journey where you'd actually run into it: draw cards, claim London–Edinburgh, cross the
Channel by ferry, dig the Zürich–Venezia tunnel, get blocked by a rival at Venezia–Roma and build a
station to borrow her line, collect landmark postcards along the way, then finish the ticket, take
the longest line and win. The story stays inside the game's real rules and data.

Style: hand-made paper collage in Junction's own palette (sky #bfe4f6, sea, sand-yellow land
#f3df9f, amber #ffc933, ink #1c1d33). The map is the game's own coastline and route data, re-cut
from torn paper. Train cards, tickets and the hex-bodied **Sprocket** robots (You, Rose, Sandy,
Mint) are rebuilt as paper cut-outs. Real screens from the game are printed and taped in. Motion is
stop-motion "on twos" (15 fps) with a gentle boil, over a smooth camera. Type is the game's own
Fredoka and Nunito, plus Caveat for hand-written notes.

## Voice direction

Kokoro-82M, voice `af_bella` (bright, warm American English, female), speed 1.0. The read is an
excited friend explaining a game they love, not a trailer announcer. The hook is three short
beats ("Edinburgh to Athens. / Twenty trains. / And three robots…"). "Blocked?" is played as a
question with a little stop-time in the music under it. The narration says "Athens" (what viewers
know); the screen shows "Athína", as the game does. One line per file, so each line can be redone
on its own (`tools/make_vo.py --only L06`).

## Script and shot list

| time (s) | scene | narration | picture |
|---|---|---|---|
| 0.0–6.4 | Hook | "Edinburgh to Athens. Twenty trains. And three robots, racing you for the track." | On a kraft-paper desk over a faint sketched map, the ticket *Edinburgh to Athína · Long · 21* slides in, gets taped down and punched. "Athína" is underlined in red pencil, and a note reads "21 points · 18 trains of track". Twenty teal paper train cars clatter into two rows while an amber counter runs to 20. Rose, Sandy and Mint pop up from the bottom, look at the ticket, lean in and scowl. Speed lines appear on "track". |
| 6.4–11.6 | Title | "This is Junction: Europe. A rail race across twenty-eight cities." | A torn disc opens on sky paper. On the music's drop (bar 3), with a whistle, the paper map slams down and its nine land pieces snap into place. The teal Sprocket logo drops in, **Junction** stamps in, and an amber **Europe** banner follows. On "rail race", all 50 routes ripple in from west to east. On "twenty-eight cities", the 28 city pins pop, a "28 cities!" note points at Moskva, and a "50 routes" note sits below. |
| 11.6–15.35 | Cards | "Draw two train cards a turn. Locomotives are wild." | Paper versions of the game's *Train cards* and *Your hand* panels. Five face-up cards flip in beside the deck. On "two" and "turn" a white card lifts out and flies into the hand, with pencil "1" and "2" marks and a replacement card flipping in each time. The hand count goes 2 → 4. On "Locomotives" the rainbow loco card jumps to centre stage, spins and throws rainbow rays. "wild = any colour" is pinned on. |
| 15.35–20.45 | Claim + ferry | "Match a route's colour, and the line is yours." / "Ferries need a locomotive." | The map, close in on Britain, with the ticket taped along the top. London–Edinburgh (4 white) glows. Four white cards drop onto its four cars, which flip to You's teal. A green tick appears, the tag reads "4 white = 7 pts", and Edinburgh and London stamp amber. The camera drifts to the Channel. A paper ferry bobs there, and a loco plus a white card drop onto London–Paris, whose first car carries the ferry dot. Tag: "ferry: needs a loco". |
| 20.45–24.4 | Tunnel | "Tunnels flip three cards, and every match costs you more." | Paper Alps with a tunnel mouth: a dashed green track runs in from Zürich and out to Venezia, and a teal train rolls into the tunnel. The real **tunnel sheet from the game** ("Tunnel: Zürich to Venezia · Flipping 3 cards") is printed and taped below. Its three cards start face down and flip one by one: orange, **green**, blue. The green match is ringed ("a match!"), and "Pay 1 green" is ringed with a "+1 card" tag. |
| 24.4–30.8 | Rivals + station | "Rose, Sandy and Mint want those routes too. Blocked? Build a station, and borrow their line." | The map over central Europe, with You's teal Paris–Zürich–Venezia line in place. Each robot pops up as it is named and its cars snap onto a route: Rose takes **Venezia–Roma**, which is on our path; Sandy takes München–Wien; Mint takes Zagreb–Sofia. On "Blocked?" the music stops, a buzzer sounds, a red pencil X goes over Rose's line, a "blocked!" note appears, and Rose waves smugly. On "station" a teal station house drops into Roma ("station: 1 card"). On "borrow" a dotted teal pencil line traces along Rose's route ("borrowed ✓"), and Rose's eye goes wide. |
| 30.8–35.6 | Postcards | "Every city has a landmark postcard. Connect it, and it's stamped." | On kraft paper, four collage postcards fly in, using the game's own landmark facts: Edinburgh Castle ("On the plug of an extinct volcano"), the Eiffel Tower ("Built for the 1889 World's Fair"), the Colosseum ("Opened in AD 80") and the Parthenon ("Completed in 432 BC"). The real **Roma / Colosseum postcard sheet** from the game is taped below ("in the game: tap any city"), and its *Stamped* badge is ringed on "Connect it". On "stamped", an amber STAMPED rubber stamp hits each card in turn. |
| 35.6–42.67 | Score | "Finish your tickets, build the longest line, and take the continent." | The whole map: You's line runs Edinburgh → London → Paris → Zürich → Venezia, with the station in Roma, then Roma → Brindisi → Athína, among rival routes. The ticket turns green and gets a tick and "+21". Red pencil traces the longest line, Edinburgh to Venezia ("+10 longest line"). The cities stamp amber down to Athína. Then the real **final-scores sheet** ("You win! … held by you for +10", total 58) slides up, "You win!" and 58 are ringed, confetti flies, and You bounces with both arms up. |
| 42.67–52.0 | End card | "Junction: Europe." / "Pick a quick game. About ten minutes, right in your browser." | Amber paper. The Sprocket logo drops in, then **Junction** and a **Europe** banner. The game's real first-screen buttons (*Quick game · 20 trains each, about 10 minutes* / *Long game*) are taped in, Quick game is ringed, and a note reads "≈ 10 minutes". A dark paper pill pops in: **Play a Quick game**. Small print: "Runs in your browser · You vs. three robot rivals". You, Rose, Sandy and Mint pop up at the bottom and wave. |

## Music and sound

The score is original and synthesized in `tools/make_audio.py` at 112.5 BPM. The title drop lands
exactly on bar 3 (6.4 s) and the end card on bar 20 (42.67 s).

- **A (0–6.4 s):** a curious E-minor pizzicato over a brushed "chugga-chugga" train rhythm that gets louder each bar, a glockenspiel question, and a snare roll into the drop.
- **B (6.4–42.67 s):** a bright G-major travelling groove (G–Em–C–D): plucked strum, synth bass, kick and snap, a 16th-note train chug, a glockenspiel hook, and an accordion-like musette reed that answers it. The band drops out for a beat and a half on "Blocked?".
- **C (42.67 s to the end):** a resolving cadence and a ringing final chord with the reed on top.

Sound effects, all synthesized: steam whistle, ferry horn, ticket punch, rail clacks, card deals and flips, paper pops, rustles and whooshes, pencil, rubber stamp, comedy buzzer, ding, check and sparkle. Every cue is placed from the narration's word timestamps. The music ducks about 10.5 dB under the voice.
