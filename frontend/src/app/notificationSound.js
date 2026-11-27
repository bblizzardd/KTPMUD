let audioContext;

function resumeAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
    if (audioContext.state !== 'running') {
      // Một số trình duyệt chỉ cho phép resume() trong lần chạm hoặc nhấn phím.
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    // Thiết bị không có đầu ra âm thanh vẫn nhận được thông báo trên màn hình.
  }
}

export function prepareNotificationSound() {
  const gestures = ['pointerup', 'click', 'keydown'];
  for (const event of gestures) document.addEventListener(event, resumeAudio, true);
  return () => {
    for (const event of gestures) document.removeEventListener(event, resumeAudio, true);
  };
}

/** Chỉ phát khi thông báo còn hiện, kể cả khi phải chờ trình duyệt cho phép phát. */
export function playNotificationSound() {
  const audio = resumeAudio();
  if (!audio) return;
  let waiting = true;
  const gains = [];

  function playWhenReady() {
    if (!waiting || audio.state !== 'running') return;
    waiting = false;
    audio.removeEventListener('statechange', playWhenReady);
    const now = audio.currentTime;
    [659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((frequency, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = now + i * 0.18;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.42);
      gains.push(gain);
    });
  }

  audio.addEventListener('statechange', playWhenReady);
  queueMicrotask(playWhenReady);
  return () => {
    waiting = false;
    audio.removeEventListener('statechange', playWhenReady);
    gains.forEach(gain => gain.disconnect());
  };
}
