// Speech input via the Web Speech API — press to talk, one question at a time.
//
// PRIVACY, PLAINLY: in Chrome and Edge this is NOT on-device. The browser
// streams your microphone audio to the vendor's servers to transcribe it. If
// that is not acceptable, use the typed Ask box instead - it runs the exact
// same query path and never touches the network.
//
// Support: Chrome and Edge yes, Safari partially (webkit prefix), Firefox no.

const SpeechRecognitionCtor =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voiceSupported = Boolean(SpeechRecognitionCtor);

const ERRORS = {
  'not-allowed': 'Microphone blocked. Allow mic access for localhost in the address-bar icon.',
  'service-not-allowed': 'The browser refused speech service. Try Chrome or Edge.',
  'no-speech': 'Did not catch anything - try again.',
  'audio-capture': 'No microphone found.',
  network: 'Speech service unreachable - check the connection.',
  aborted: null, // user cancelled; not worth reporting
};

export class Voice {
  constructor({ onState, onTranscript, onResult, onError } = {}) {
    this.onState = onState ?? (() => {});
    this.onTranscript = onTranscript ?? (() => {});
    this.onResult = onResult ?? (() => {});
    this.onError = onError ?? (() => {});
    this.listening = false;
    this.rec = null;
  }

  toggle() {
    if (this.listening) this.stop();
    else this.start();
  }

  start() {
    if (!voiceSupported) {
      this.onError('This browser has no speech recognition. Chrome or Edge, or use the typed box.');
      return;
    }
    if (this.listening) return;

    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.listening = true;
      this.onState('listening');
    };

    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (const result of event.results) {
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      this.onTranscript((final || interim).trim(), Boolean(final));
      if (final.trim()) this.onResult(final.trim());
    };

    rec.onerror = (event) => {
      const message = ERRORS[event.error];
      if (message) this.onError(message);
      else if (message !== null) this.onError(`Speech error: ${event.error}`);
    };

    rec.onend = () => {
      this.listening = false;
      this.rec = null;
      this.onState('idle');
    };

    this.rec = rec;
    try {
      rec.start();
    } catch (err) {
      this.listening = false;
      this.onError(`Could not start the microphone: ${err.message}`);
    }
  }

  stop() {
    this.rec?.stop();
  }
}
