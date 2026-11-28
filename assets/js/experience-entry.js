(() => {
  "use strict";
  const KEY = "pv_audio_choice";
  const root = document.documentElement;
  const loader = document.getElementById("pvExperienceLoader");
  const gate = document.getElementById("pvAudioWelcome");
  const choices = {
    with: document.getElementById("pvAudioWith"),
    without: document.getElementById("pvAudioWithout")
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let audioContext = null;
  let soundEnabled = false;
  let lastHover = 0;

  function tone(frequency, duration, type = "sine", volume = 0.035) {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }

  function revealSite() {
    if (loader) {
      loader.classList.add("is-leaving");
      window.setTimeout(() => loader.remove(), reduceMotion ? 0 : 420);
    }
    document.body.classList.remove("pv-entry-locked");
  }

  function chooseAudio(choice) {
    try { sessionStorage.setItem(KEY, choice); } catch (_) {}
    soundEnabled = choice === "with";
    window.perivelleAudioExperience = choice;
    root.dataset.audioExperience = choice;
    if (soundEnabled) {
      // This runs inside the visitor's click gesture, satisfying browser audio policies.
      tone(660, 0.12, "sine", 0.025);
      window.setTimeout(() => tone(880, 0.16, "sine", 0.02), 90);
    }
    if (gate) {
      gate.classList.add("is-leaving");
      window.setTimeout(() => gate.remove(), reduceMotion ? 0 : 360);
    }
    revealSite();
  }

  function start() {
    let saved = "";
    try { saved = sessionStorage.getItem(KEY) || ""; } catch (_) {}
    window.setTimeout(() => {
      if (loader) loader.classList.add("is-ready");
      if (saved === "with" || saved === "without") {
        soundEnabled = saved === "with";
        window.perivelleAudioExperience = saved;
        root.dataset.audioExperience = saved;
        window.setTimeout(revealSite, reduceMotion ? 0 : 380);
      } else {
        if (gate) {
          gate.hidden = false;
          requestAnimationFrame(() => gate.classList.add("is-visible"));
        }
        if (loader) {
          loader.classList.add("is-leaving");
          window.setTimeout(() => loader.remove(), reduceMotion ? 0 : 420);
        }
      }
    }, reduceMotion ? 0 : 950);
  }

  choices.with?.addEventListener("click", () => chooseAudio("with"));
  choices.without?.addEventListener("click", () => chooseAudio("without"));

  // Small synthesized UI cues: subtle hover tick and soft confirmation click.
  document.addEventListener("pointerover", event => {
    if (!soundEnabled || !event.target.closest("a,button,[role='button']")) return;
    const now = Date.now();
    if (now - lastHover < 110) return;
    lastHover = now;
    tone(520, 0.045, "triangle", 0.012);
  }, { passive: true });
  document.addEventListener("click", event => {
    if (!soundEnabled || event.target.closest("#pvAudioWith")) return;
    if (event.target.closest("a,button,[role='button']")) tone(740, 0.075, "sine", 0.018);
  }, { passive: true });

  // Let the existing audio dock respect the visitor's explicit choice.
  document.addEventListener("click", event => {
    const dock = event.target.closest(".pv-audio-dock, .pv-audio-compact");
    if (dock && !soundEnabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const notice = document.getElementById("pvAudioNotice");
      if (notice) {
        notice.hidden = false;
        window.setTimeout(() => { notice.hidden = true; }, 2400);
      }
    }
  }, true);

  start();
})();
