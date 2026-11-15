// German text-to-speech through the phone's own voice.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
const germanVoice = () => (synth ? synth.getVoices().find((v) => /^de(-|_|$)/i.test(v.lang)) : undefined);

/** False when the device has voices but none of them is German. */
export function canSpeak() {
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const voices = synth.getVoices();
  return voices.length === 0 || !!germanVoice();
}

export function speak(text) {
  if (!canSpeak()) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/_{2,}/g, ' … '));
  u.lang = 'de-DE';
  const v = germanVoice();
  if (v) u.voice = v;
  u.rate = 0.92;
  synth.speak(u);
}

export function stop() {
  if (synth) synth.cancel();
}
