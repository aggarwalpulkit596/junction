"""Word-level timestamps for each VO line (faster-whisper small.en) -> audio/vo/words.json.
Used to time caption chunks to the actual speech."""
import os, json
from faster_whisper import WhisperModel
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
m = WhisperModel("small.en", device="cpu", compute_type="int8")
out = {}
for ln in json.load(open(f"{ROOT}/script/lines.json")):
    segs, _ = m.transcribe(f"{ROOT}/audio/vo/{ln['id']}.wav", beam_size=5, word_timestamps=True)
    out[ln["id"]] = [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for s in segs for w in s.words]
    print(ln["id"], " ".join(w[0] for w in out[ln["id"]]), flush=True)
json.dump(out, open(f"{ROOT}/audio/vo/words.json", "w"))
os._exit(0)
