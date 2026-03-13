import React, { useState, useEffect, useCallback } from 'react';
import { getSettings, setMicPermissionGranted, setSetupComplete } from '../shared/storage';
import { ExtensionSettings } from '../shared/types';

type WelcomeStep = 1 | 2 | 3;

/* ─── Animated SVG Illustrations ─── */

const KeyboardIllustration: React.FC = () => (
  <svg viewBox="0 0 200 140" className="w-48 h-auto mx-auto" aria-hidden="true">
    {/* Glow behind the key */}
    <defs>
      <radialGradient id="keyGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6">
          <animate attributeName="stopOpacity" values="0.6;0.3;0.6" dur="2s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
    </defs>

    {/* Ambient glow */}
    <circle cx="100" cy="70" r="60" fill="url(#keyGlow)" />

    {/* Keyboard body */}
    <rect x="20" y="40" width="160" height="80" rx="12" fill="url(#cardGrad)" stroke="#475569" strokeWidth="1" />

    {/* Key rows - subtle */}
    {[0, 1, 2].map((row) =>
      Array.from({ length: 8 }).map((_, col) => {
        const isBacktick = row === 0 && col === 0;
        return (
          <rect
            key={`${row}-${col}`}
            x={30 + col * 18}
            y={50 + row * 22}
            width={14}
            height={14}
            rx={3}
            fill={isBacktick ? '#818cf8' : '#475569'}
            opacity={isBacktick ? 1 : 0.4}
          >
            {isBacktick && (
              <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
            )}
          </rect>
        );
      })
    )}

    {/* Backtick label */}
    <text x="37" y="61" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="bold">
      `
    </text>

    {/* Press indicator - animated finger */}
    <g>
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,-8; 0,0; 0,-8"
        dur="2s"
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
      />
      <circle cx="37" cy="42" r="6" fill="#c4b5fd" opacity="0.5" />
      <circle cx="37" cy="42" r="3" fill="#c4b5fd" opacity="0.8" />
    </g>

    {/* Ripple from backtick key */}
    <circle cx="37" cy="57" r="8" fill="none" stroke="#818cf8" strokeWidth="1" opacity="0">
      <animate attributeName="r" values="8;24" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const MicrophoneIllustration: React.FC<{ granted: boolean }> = ({ granted }) => (
  <svg viewBox="0 0 200 180" className="w-48 h-auto mx-auto" aria-hidden="true">
    <defs>
      <radialGradient id="micGlow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stopColor={granted ? '#a78bfa' : '#818cf8'} stopOpacity="0.5">
          <animate attributeName="stopOpacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor={granted ? '#a78bfa' : '#818cf8'} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="micBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={granted ? '#c4b5fd' : '#a5b4fc'} />
        <stop offset="100%" stopColor={granted ? '#a78bfa' : '#818cf8'} />
      </linearGradient>
    </defs>

    {/* Ambient glow */}
    <circle cx="100" cy="80" r="70" fill="url(#micGlow)" />

    {/* Sound waves */}
    {[30, 42, 54].map((r, i) => (
      <React.Fragment key={i}>
        <path
          d={`M${100 - r} 70 Q${100 - r} ${70 - r * 0.6} 100 ${70 - r * 0.6} Q${100 + r} ${70 - r * 0.6} ${100 + r} 70`}
          fill="none"
          stroke={granted ? '#a78bfa' : '#818cf8'}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            values="0;0.6;0"
            dur="2s"
            begin={`${i * 0.3}s`}
            repeatCount="indefinite"
          />
        </path>
      </React.Fragment>
    ))}

    {/* Mic body */}
    <rect x="88" y="55" width="24" height="45" rx="12" fill="url(#micBody)" />

    {/* Mic grille lines */}
    {[63, 69, 75, 81, 87].map((y) => (
      <line key={y} x1="92" y1={y} x2="108" y2={y} stroke="#fff" strokeWidth="0.8" opacity="0.3" />
    ))}

    {/* Mic stand */}
    <path d="M80 95 Q80 115 100 115 Q120 115 120 95" fill="none" stroke={granted ? '#c4b5fd' : '#a5b4fc'} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="100" y1="115" x2="100" y2="135" stroke={granted ? '#c4b5fd' : '#a5b4fc'} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="88" y1="135" x2="112" y2="135" stroke={granted ? '#c4b5fd' : '#a5b4fc'} strokeWidth="2.5" strokeLinecap="round" />

    {/* Checkmark overlay when granted */}
    {granted && (
      <g>
        <circle cx="130" cy="60" r="14" fill="#6366f1" />
        <polyline
          points="122,60 128,66 138,54"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          strokeDashoffset="24"
        >
          <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.4s" fill="freeze" />
        </polyline>
      </g>
    )}
  </svg>
);

const RocketIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" className="w-48 h-auto mx-auto" aria-hidden="true">
    <defs>
      <radialGradient id="launchGlow" cx="50%" cy="60%" r="50%">
        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4">
          <animate attributeName="stopOpacity" values="0.4;0.2;0.4" dur="3s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="rocketBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e0e7ff" />
        <stop offset="100%" stopColor="#a5b4fc" />
      </linearGradient>
      <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="100%" stopColor="#f43f5e" />
      </linearGradient>
    </defs>

    {/* Ambient glow */}
    <circle cx="100" cy="100" r="80" fill="url(#launchGlow)" />

    {/* Stars */}
    {[[30, 40], [160, 50], [45, 150], [155, 140], [80, 30], [130, 170], [25, 100], [175, 90]].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="1.5" fill="#e0e7ff">
        <animate attributeName="opacity" values="0.2;1;0.2" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
      </circle>
    ))}

    {/* Rocket group - floating animation */}
    <g>
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,4; 0,-4; 0,4"
        dur="3s"
        repeatCount="indefinite"
        calcMode="spline"
        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
      />

      {/* Flame */}
      <ellipse cx="100" cy="145" rx="8" ry="18" fill="url(#flame)" opacity="0.9">
        <animate attributeName="ry" values="18;22;16;20;18" dur="0.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.6;0.9" dur="0.3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="100" cy="143" rx="4" ry="12" fill="#fbbf24" opacity="0.8">
        <animate attributeName="ry" values="12;15;10;13;12" dur="0.4s" repeatCount="indefinite" />
      </ellipse>

      {/* Rocket body */}
      <path d="M88 130 L88 95 Q88 65 100 55 Q112 65 112 95 L112 130 Z" fill="url(#rocketBody)" />

      {/* Window */}
      <circle cx="100" cy="95" r="8" fill="#1e1b4b" stroke="#c7d2fe" strokeWidth="1.5" />
      <circle cx="100" cy="95" r="5" fill="#312e81">
        <animate attributeName="fill" values="#312e81;#4338ca;#312e81" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Fins */}
      <path d="M88 120 L75 138 L88 132 Z" fill="#818cf8" />
      <path d="M112 120 L125 138 L112 132 Z" fill="#818cf8" />

      {/* Nose highlight */}
      <path d="M95 70 Q95 60 100 55" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
    </g>

    {/* Particle trail */}
    {[0, 1, 2, 3, 4].map((i) => (
      <circle key={`p${i}`} cx={95 + Math.random() * 10} cy="160" r="2" fill="#fb923c" opacity="0">
        <animate
          attributeName="cy"
          values="155;185"
          dur="1s"
          begin={`${i * 0.2}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="1s"
          begin={`${i * 0.2}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          values={`${96 + i * 2};${90 + i * 4}`}
          dur="1s"
          begin={`${i * 0.2}s`}
          repeatCount="indefinite"
        />
      </circle>
    ))}
  </svg>
);

/* ─── Floating Orbs Background ─── */

const FloatingOrbs: React.FC = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="orb orb-1" />
    <div className="orb orb-2" />
    <div className="orb orb-3" />
  </div>
);

/* ─── Main Component ─── */

const Welcome: React.FC = () => {
  const [step, setStep] = useState<WelcomeStep>(1);
  const [prevStep, setPrevStep] = useState<WelcomeStep>(1);
  const [animating, setAnimating] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const goToStep = useCallback(
    (next: WelcomeStep) => {
      if (animating) return;
      setAnimating(true);
      setPrevStep(step);
      setStep(next);
      setTimeout(() => setAnimating(false), 600);
    },
    [step, animating]
  );

  const handleRequestMic = async () => {
    setRequesting(true);
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      await setMicPermissionGranted(true);
    } catch {
      setMicError('Microphone access was denied. Please allow it to continue.');
    } finally {
      setRequesting(false);
    }
  };

  const handleFinish = async () => {
    await setSetupComplete();
    window.close();
  };

  const shortcutDisplay = settings?.shortcutKey === '`' ? 'Backtick ( ` )' : settings?.shortcutKey ?? '`';
  const shortcutKey = settings?.shortcutKey === '`' ? '`' : settings?.shortcutKey ?? '`';

  return (
    <div className="welcome-root">
      <FloatingOrbs />

      <div className="welcome-container">
        {/* ─── Title ─── */}
        <h2 className="welcome-title">ScreenSense</h2>

        {/* ─── Progress Bar ─── */}
        <div className="progress-bar">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              {s > 1 && (
                <div className={`progress-line ${s <= step ? 'filled' : ''}`} />
              )}
              <div className={`progress-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}>
                {s < step ? (
                  <svg viewBox="0 0 16 16" width="12" height="12">
                    <polyline points="3,8 7,12 13,4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  s
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* ─── Card ─── */}
        <div className="card">
          <div
            key={step}
            className="card-content step-enter"
          >
            {step === 1 && (
              <>
                <KeyboardIllustration />
                <h1 className="card-title">
                  Hold to <span className="gradient-text">Speak</span>
                </h1>
                <p className="card-desc">
                  Press and hold <kbd className="key-badge">{shortcutKey}</kbd> to ask a question about anything on your screen. Release when you're done.
                </p>
                <div className="hint-box">
                  <div className="hint-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span>Quick taps are ignored — you can still type normally</span>
                </div>
                <button onClick={() => goToStep(2)} className="btn btn-primary">
                  Continue
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-2">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <MicrophoneIllustration granted={micGranted} />
                <h1 className="card-title">
                  Enable <span className="gradient-text">Microphone</span>
                </h1>
                <p className="card-desc">
                  ScreenSense only listens while you hold the key. Your audio is never stored or sent anywhere except to process your question.
                </p>

                {micError && (
                  <div className="error-box">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{micError}</span>
                  </div>
                )}

                {micGranted ? (
                  <div className="success-box">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Microphone access granted</span>
                  </div>
                ) : (
                  <button
                    onClick={handleRequestMic}
                    disabled={requesting}
                    className="btn btn-mic"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 mr-2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" strokeLinecap="round" />
                      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
                      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
                    </svg>
                    {requesting ? 'Requesting Access...' : 'Allow Microphone'}
                  </button>
                )}

                <button
                  onClick={() => goToStep(3)}
                  disabled={!micGranted}
                  className={`btn ${micGranted ? 'btn-primary' : 'btn-disabled'}`}
                >
                  {micGranted ? 'Continue' : 'Grant permission to continue'}
                  {micGranted && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-2">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <RocketIllustration />
                <h1 className="card-title">
                  You're <span className="gradient-text">Ready</span>
                </h1>
                <p className="card-desc">
                  Hold <kbd className="key-badge">{shortcutKey}</kbd>, speak your question, release — and get an instant AI-powered answer right on the page.
                </p>

                <div className="how-it-works">
                  <div className="how-step">
                    <div className="how-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                        <rect x="2" y="7" width="20" height="12" rx="2" />
                        <rect x="5" y="10" width="4" height="3" rx="1" fill="currentColor" opacity="0.3" />
                      </svg>
                    </div>
                    <div className="how-label">Press & hold <kbd className="key-badge-sm">{shortcutKey}</kbd></div>
                  </div>
                  <div className="how-connector" />
                  <div className="how-step">
                    <div className="how-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="how-label">Speak your mind</div>
                  </div>
                  <div className="how-connector" />
                  <div className="how-step">
                    <div className="how-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="how-label">Instant AI insight</div>
                  </div>
                </div>

                <button onClick={handleFinish} className="btn btn-launch">
                  Launch ScreenSense
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-2">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <p className="footer-text">
          ScreenSense Voice &middot; TreeLine Hacks 2026
        </p>
      </div>

      <style>{`
        /* ─── Reset & Base ─── */
        .welcome-root {
          min-height: 100vh;
          background: #0a0a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ─── Floating Orbs ─── */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
        }
        .orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15), transparent);
          top: -100px; left: -100px;
          animation: orbFloat1 15s ease-in-out infinite;
        }
        .orb-2 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent);
          bottom: -80px; right: -80px;
          animation: orbFloat2 18s ease-in-out infinite;
        }
        .orb-3 {
          width: 250px; height: 250px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent);
          top: 50%; left: 60%;
          animation: orbFloat3 12s ease-in-out infinite;
        }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(60px, 40px); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px, -30px); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px, 50px); } }

        /* ─── Container ─── */
        .welcome-container {
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 1;
        }

        /* ─── Title ─── */
        .welcome-title {
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #c4b5fd, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 1.5rem;
        }

        /* ─── Progress ─── */
        .progress-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 2rem;
          padding: 0 1rem;
        }
        .progress-line {
          flex: 0 0 60px;
          height: 2px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          transition: background 0.5s ease;
        }
        .progress-line.filled {
          background: linear-gradient(90deg, #818cf8, #a78bfa);
          box-shadow: 0 0 8px rgba(129, 140, 248, 0.3);
        }
        .progress-dot {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          border: 2px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.25);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }
        .progress-dot.active {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          border-color: rgba(129, 140, 248, 0.6);
          color: #fff;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
          transform: scale(1.1);
        }
        .progress-dot.done {
          background: linear-gradient(135deg, #818cf8, #6366f1);
          border-color: rgba(129, 140, 248, 0.4);
          color: #fff;
        }

        /* ─── Card ─── */
        .card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 2.5rem 2rem;
          box-shadow: 0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
          overflow: hidden;
        }
        .card-content { text-align: center; }

        /* ─── Step Transition ─── */
        .step-enter {
          animation: stepIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ─── Typography ─── */
        .card-title {
          font-size: 28px; font-weight: 700; color: #f1f5f9;
          margin: 0.5rem 0 0.75rem; letter-spacing: -0.03em;
          line-height: 1.2;
        }
        .gradient-text {
          background: linear-gradient(135deg, #a5b4fc, #818cf8, #c4b5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-desc {
          font-size: 15px; line-height: 1.6;
          color: rgba(203, 213, 225, 0.7);
          margin-bottom: 1.5rem;
          max-width: 380px;
          margin-left: auto; margin-right: auto;
        }

        /* ─── Key Badge ─── */
        .key-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          padding: 2px 10px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 15px; font-weight: 600;
          color: #a5b4fc;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .key-badge-sm {
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 4px;
          padding: 1px 6px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px; font-weight: 600;
          color: #a5b4fc;
        }

        /* ─── Hint Box ─── */
        .hint-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 1.5rem;
          font-size: 13px; color: rgba(165, 180, 252, 0.7);
        }
        .hint-icon { color: rgba(129, 140, 248, 0.5); flex-shrink: 0; }

        /* ─── Buttons ─── */
        .btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100%; padding: 14px 24px;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative; overflow: hidden;
        }
        .btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .btn:hover::before { opacity: 1; }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          color: #fff;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .btn-primary:active { transform: translateY(0); }

        .btn-mic {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          margin-bottom: 0.75rem;
        }
        .btn-mic:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.5);
        }
        .btn-mic:disabled {
          opacity: 0.5; cursor: not-allowed;
        }

        .btn-disabled {
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.2);
          cursor: not-allowed;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .btn-launch {
          background: linear-gradient(135deg, #7c3aed, #a78bfa);
          color: #fff;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(255,255,255,0.15);
          font-size: 16px;
          padding: 16px 24px;
        }
        .btn-launch:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(124, 58, 237, 0.45), inset 0 1px 0 rgba(255,255,255,0.15);
        }

        /* ─── Status Boxes ─── */
        .error-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 1rem;
          font-size: 13px; color: #fca5a5;
        }
        .success-box {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: rgba(129, 140, 248, 0.08);
          border: 1px solid rgba(129, 140, 248, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 1rem;
          font-size: 14px; font-weight: 500; color: #a5b4fc;
          animation: successPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes successPop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ─── How It Works (Step 3) ─── */
        .how-it-works {
          display: flex; align-items: center; justify-content: center;
          gap: 0;
          margin-bottom: 2rem;
        }
        .how-step {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 16px 12px;
        }
        .how-icon {
          width: 44px; height: 44px;
          background: rgba(129, 140, 248, 0.08);
          border: 1px solid rgba(129, 140, 248, 0.15);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: #a5b4fc;
          transition: all 0.3s ease;
        }
        .how-step:hover .how-icon {
          background: rgba(129, 140, 248, 0.15);
          border-color: rgba(129, 140, 248, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }
        .how-label {
          font-size: 12px; font-weight: 500;
          color: rgba(203, 213, 225, 0.5);
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .how-connector {
          width: 24px; height: 1px;
          background: rgba(129, 140, 248, 0.15);
          margin-bottom: 28px;
          flex-shrink: 0;
        }

        /* ─── Footer ─── */
        .footer-text {
          text-align: center;
          font-size: 12px;
          color: rgba(148, 163, 184, 0.3);
          margin-top: 2rem;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
};

export default Welcome;
