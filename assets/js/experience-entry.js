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
  const defaults = {
    loaderEnabled: true, loaderText: "Tuning the little sounds...",
    welcomeEnabled: true,
    welcomeTitle: "How would you like to experience Perivelle?",
    welcomeCopy: "There are tiny sounds hiding around this little studio. You decide if you want to hear them.",
    withAudioEnabled: true, withAudioLabel: "With audio",
    withAudioDescription: "Music & playful sound effects",
    withoutAudioEnabled: true, withoutAudioLabel: "Without audio",
    withoutAudioDescription: "A quiet browsing experience",
    soundEffectsEnabled: true, soundEffectsVolume: 0.025
  };
  let config = { ...defaults };
  let audioContext = null;
  let audioAllowed = false;
  let effectsEnabled = false;
  let lastHover = 0;

  function tone(frequency, duration, type = "sine", volume = config.soundEffectsVolume) {
    if (!audioAllowed || !effectsEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(Math.max(0.0001, volume), audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }

  function removeLoader() {
    if (!loader) return;
    loader.classList.add("is-leaving");
    window.setTimeout(() => loader.remove(), reduceMotion ? 0 : 420);
  }

  function revealSite() {
    removeLoader();
    document.body.classList.remove("pv-entry-locked");
  }

  function applyConfig(settings) {
    config = { ...defaults, ...(settings && typeof settings === "object" ? settings : {}) };
    const loaderText = document.querySelector(".pv-loader-caption");
    const title = document.getElementById("pvWelcomeTitle");
    const copy = document.getElementById("pvWelcomeCopy");
    const withTitle = choices.with?.querySelector("strong");
    const withDescription = choices.with?.querySelector("small");
    const withoutTitle = choices.without?.querySelector("strong");
    const withoutDescription = choices.without?.querySelector("small");
    if (loaderText) loaderText.textContent = config.loaderText;
    if (title) {
      title.textContent = "";
      const prefix = document.createTextNode(config.welcomeTitle.replace(/Perivelle\??/i, ""));
      const emphasis = document.createElement("em");
      emphasis.textContent = "Perivelle";
      title.append(prefix, emphasis);
    }
    if (copy) copy.textContent = config.welcomeCopy;
    if (withTitle) withTitle.textContent = config.withAudioLabel;
    if (withDescription) withDescription.textContent = config.withAudioDescription;
    if (withoutTitle) withoutTitle.textContent = config.withoutAudioLabel;
    if (withoutDescription) withoutDescription.textContent = config.withoutAudioDescription;
    if (choices.with) choices.with.hidden = !config.withAudioEnabled;
    if (choices.without) choices.without.hidden = !config.withoutAudioEnabled;
    if (loader && !config.loaderEnabled) loader.remove();
  }

  function chooseAudio(choice) {
    try { sessionStorage.setItem(KEY, choice); } catch (_) {}
    audioAllowed = choice === "with";
    effectsEnabled = audioAllowed && config.soundEffectsEnabled;
    window.perivelleAudioExperience = choice;
    root.dataset.audioExperience = choice;
    if (audioAllowed && effectsEnabled) {
      tone(660, 0.12, "sine", Math.min(config.soundEffectsVolume, 0.025));
      window.setTimeout(() => tone(880, 0.16, "sine", Math.min(config.soundEffectsVolume, 0.02)), 90);
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
      if (saved === "with" || saved === "without") {
        audioAllowed = saved === "with";
        effectsEnabled = audioAllowed && config.soundEffectsEnabled;
        window.perivelleAudioExperience = saved;
        root.dataset.audioExperience = saved;
        revealSite();
        return;
      }
      if (!config.welcomeEnabled) {
        chooseAudio("without");
        return;
      }
      if (!config.withAudioEnabled && !config.withoutAudioEnabled) {
        chooseAudio("without");
        return;
      }
      if (gate) {
        gate.hidden = false;
        requestAnimationFrame(() => gate.classList.add("is-visible"));
      }
      removeLoader();
    }, reduceMotion ? 0 : (config.loaderEnabled ? 950 : 0));
  }

  choices.with?.addEventListener("click", () => chooseAudio("with"));
  choices.without?.addEventListener("click", () => chooseAudio("without"));

  document.addEventListener("pointerover", event => {
    if (!audioAllowed || !effectsEnabled || !event.target.closest("a,button,[role='button']")) return;
    const now = Date.now();
    if (now - lastHover < 110) return;
    lastHover = now;
    tone(520, 0.045, "triangle", config.soundEffectsVolume * 0.48);
  }, { passive: true });

  document.addEventListener("click", event => {
    if (!audioAllowed || !effectsEnabled || event.target.closest("#pvAudioWith")) return;
    if (event.target.closest("a,button,[role='button']")) tone(740, 0.075, "sine", config.soundEffectsVolume * 0.72);
  }, { passive: true });

  document.addEventListener("click", event => {
    const dock = event.target.closest(".pv-audio-dock, .pv-audio-compact");
    if (dock && !audioAllowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const notice = document.getElementById("pvAudioNotice");
      if (notice) {
        notice.hidden = false;
        window.setTimeout(() => { notice.hidden = true; }, 2400);
      }
    }
  }, true);

  async function init() {
    try {
      const response = await fetch("/api/site-config", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        applyConfig(data.settings?.entry_experience);
      } else applyConfig(null);
    } catch (_) { applyConfig(null); }
    start();
  }
  init();
})();
