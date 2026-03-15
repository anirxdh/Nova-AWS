import React, { useEffect, useState } from 'react';
import {
  getSettings,
  saveSettings,
  getApiKeys,
  saveApiKeys,
} from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/constants';
import { ExtensionSettings, DisplayMode, ExplanationLevel } from '../shared/types';

/* ─── Floating Orbs Background ─── */

const FloatingOrbs: React.FC = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="orb orb-1" />
    <div className="orb orb-2" />
    <div className="orb orb-3" />
  </div>
);

/* ─── Gear Illustration ─── */

const GearIllustration: React.FC = () => (
  <svg viewBox="0 0 200 160" className="w-40 h-auto mx-auto" aria-hidden="true">
    <defs>
      <radialGradient id="gearGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FF9900" stopOpacity="0.5">
          <animate attributeName="stopOpacity" values="0.5;0.25;0.5" dur="3s" repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#FF9900" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="gearGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFB84D" />
        <stop offset="100%" stopColor="#FF9900" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="80" r="60" fill="url(#gearGlow)" />
    <g transform="translate(100,80)">
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="20s" repeatCount="indefinite" additive="sum" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <rect
          key={angle}
          x="-6"
          y="-38"
          width="12"
          height="14"
          rx="3"
          fill="url(#gearGrad)"
          transform={`rotate(${angle})`}
          opacity="0.8"
        />
      ))}
      <circle cx="0" cy="0" r="28" fill="none" stroke="url(#gearGrad)" strokeWidth="8" />
      <circle cx="0" cy="0" r="12" fill="#232F3E" stroke="#FF9900" strokeWidth="2" />
      <circle cx="0" cy="0" r="5" fill="#FF9900" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.3;0.6" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  </svg>
);

/* ─── Main Component ─── */

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [elevenLabsKey, setElevenLabsKey] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
    getApiKeys().then((keys) => {
      setElevenLabsKey(keys.elevenLabsKey || '');
    });
  }, []);

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (settings) {
      setSettings({ ...settings, shortcutKey: e.key });
      setCapturing(false);
    }
  };

  const handleSave = async () => {
    if (settings) {
      await saveSettings(settings);
      await saveApiKeys({
        elevenLabsKey: elevenLabsKey || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleReset = async () => {
    setSettings({ ...DEFAULT_SETTINGS });
    await saveSettings(DEFAULT_SETTINGS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!settings) {
    return (
      <div className="settings-root">
        <FloatingOrbs />
        <p style={{ color: 'rgba(203,213,225,0.5)', fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  const displayKey =
    settings.shortcutKey === '`' ? '`' : settings.shortcutKey;

  return (
    <div className="settings-root">
      <FloatingOrbs />

      <div className="settings-container">
        {/* Title */}
        <h2 className="settings-header">ScreenSense</h2>

        {/* Card */}
        <div className="card">
          <div className="card-content">
            <GearIllustration />
            <h1 className="card-title">
              <span className="gradient-text">Settings</span>
            </h1>

            {/* Shortcut Key */}
            <div className="field-group">
              <label className="field-label">Shortcut Key</label>
              {capturing ? (
                <div
                  className="key-capture"
                  tabIndex={0}
                  onKeyDown={handleKeyCapture}
                  onBlur={() => setCapturing(false)}
                  autoFocus
                  ref={(el) => el?.focus()}
                >
                  Press any key...
                </div>
              ) : (
                <button onClick={() => setCapturing(true)} className="key-display">
                  <kbd className="key-badge">{displayKey}</kbd>
                  <span className="key-hint">(click to change)</span>
                </button>
              )}
            </div>

            {/* Hold Delay */}
            <div className="field-group">
              <label className="field-label">
                Hold Delay: <span className="field-value">{settings.holdDelayMs}ms</span>
              </label>
              <input
                type="range"
                min={100}
                max={500}
                step={10}
                value={settings.holdDelayMs}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    holdDelayMs: parseInt(e.target.value, 10),
                  })
                }
                className="range-input"
              />
              <div className="range-labels">
                <span>100ms</span>
                <span>500ms</span>
              </div>
            </div>

            {/* Display Mode */}
            <div className="field-group">
              <label className="field-label">Display Mode</label>
              <div className="toggle-group">
                {([
                  ['both', 'Text + Audio'],
                  ['audio-only', 'Audio Only'],
                  ['text-only', 'Text Only'],
                ] as [DisplayMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    className={`toggle-btn${settings.displayMode === mode ? ' active' : ''}`}
                    onClick={() => setSettings({ ...settings, displayMode: mode })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                Choose how responses are delivered — text overlay, spoken audio, or both
              </p>
            </div>

            {/* Explanation Level */}
            <div className="field-group">
              <label className="field-label">Explanation Level</label>
              <div className="toggle-group level-group">
                {([
                  ['kid', 'Kid'],
                  ['school', 'Student'],
                  ['college', 'College'],
                  ['phd', 'PhD'],
                  ['executive', 'Executive'],
                ] as [ExplanationLevel, string][]).map(([level, label]) => (
                  <button
                    key={level}
                    className={`toggle-btn${settings.explanationLevel === level ? ' active' : ''}`}
                    onClick={() => setSettings({ ...settings, explanationLevel: level })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                Adjusts how detailed and technical the AI explanations are
              </p>
            </div>

            {/* Divider */}
            <div className="divider" />

            {/* AWS Transcribe Note */}
            <div className="field-group">
              <label className="field-label">Speech-to-Text</label>
              <div className="aws-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18" style={{ flexShrink: 0, color: '#00A8E1' }}>
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Speech-to-text powered by Amazon Transcribe. Configure AWS credentials in <code style={{ color: '#FFB84D', fontSize: 12 }}>backend/.env</code></span>
              </div>
            </div>

            {/* ElevenLabs API Key */}
            <div className="field-group">
              <label className="field-label">ElevenLabs API Key</label>
              <input
                type="password"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                placeholder="sk_..."
                className="text-input"
              />
              <p className="field-hint">
                For voice readback &middot;{' '}
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="field-link"
                >
                  elevenlabs.io
                </a>
                {' '}&middot; optional (falls back to browser voice)
              </p>
            </div>

            {/* Actions */}
            <div className="actions">
              <button onClick={handleSave} className="btn btn-primary">
                {saved ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ marginRight: 8 }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved!
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button onClick={handleReset} className="btn-ghost">
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="footer-text">
          ScreenSense Voice &middot; Amazon Nova Hackathon 2026
        </p>
      </div>

      <style>{`
        /* ─── Reset & Base ─── */
        .settings-root {
          min-height: 100vh;
          background: #0D1117;
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
          background: radial-gradient(circle, rgba(255, 153, 0, 0.15), transparent);
          top: -100px; left: -100px;
          animation: orbFloat1 15s ease-in-out infinite;
        }
        .orb-2 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(232, 139, 0, 0.12), transparent);
          bottom: -80px; right: -80px;
          animation: orbFloat2 18s ease-in-out infinite;
        }
        .orb-3 {
          width: 250px; height: 250px;
          background: radial-gradient(circle, rgba(0, 168, 225, 0.1), transparent);
          top: 50%; left: 60%;
          animation: orbFloat3 12s ease-in-out infinite;
        }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(60px, 40px); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px, -30px); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px, 50px); } }

        /* ─── Container ─── */
        .settings-container {
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 1;
        }

        /* ─── Header ─── */
        .settings-header {
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #FFB84D, #FF9900);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 2rem;
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
        }
        .card-content { text-align: center; }

        /* ─── Typography ─── */
        .card-title {
          font-size: 28px; font-weight: 700; color: #f1f5f9;
          margin: 0.5rem 0 1.75rem; letter-spacing: -0.03em;
          line-height: 1.2;
        }
        .gradient-text {
          background: linear-gradient(135deg, #FFB84D, #FF9900, #00A8E1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ─── Field Groups ─── */
        .field-group {
          text-align: left;
          margin-bottom: 1.5rem;
        }
        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: rgba(203, 213, 225, 0.6);
          margin-bottom: 8px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .field-value {
          color: #FFB84D;
          text-transform: none;
        }

        /* ─── AWS Note ─── */
        .aws-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(0, 168, 225, 0.06);
          border: 1px solid rgba(0, 168, 225, 0.15);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(203, 213, 225, 0.6);
        }

        /* ─── Key Display ─── */
        .key-display {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .key-display:hover {
          background: rgba(255, 153, 0, 0.08);
          border-color: rgba(255, 153, 0, 0.2);
        }
        .key-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(255, 153, 0, 0.15);
          border: 1px solid rgba(255, 153, 0, 0.3);
          border-radius: 6px;
          padding: 2px 12px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 16px; font-weight: 600;
          color: #FFB84D;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .key-hint {
          font-size: 13px;
          color: rgba(148, 163, 184, 0.4);
        }
        .key-capture {
          width: 100%;
          padding: 14px;
          background: rgba(255, 153, 0, 0.08);
          border: 2px solid rgba(255, 153, 0, 0.4);
          border-radius: 14px;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: #FFB84D;
          outline: none;
          animation: pulseCapture 1.5s ease-in-out infinite;
        }
        @keyframes pulseCapture {
          0%, 100% { border-color: rgba(255, 153, 0, 0.4); }
          50% { border-color: rgba(255, 153, 0, 0.7); }
        }

        /* ─── Range Input ─── */
        .range-input {
          width: 100%;
          height: 6px;
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          -webkit-appearance: none;
          appearance: none;
          outline: none;
          cursor: pointer;
        }
        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF9900, #E88B00);
          box-shadow: 0 2px 8px rgba(255, 153, 0, 0.4);
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .range-input::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .range-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          color: rgba(148, 163, 184, 0.3);
        }

        /* ─── Text Input ─── */
        .text-input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          font-size: 14px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #e2e8f0;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        .text-input::placeholder {
          color: rgba(148, 163, 184, 0.25);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .text-input:focus {
          border-color: rgba(255, 153, 0, 0.4);
          background: rgba(255, 153, 0, 0.04);
          box-shadow: 0 0 0 3px rgba(255, 153, 0, 0.1);
        }
        .field-hint {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(148, 163, 184, 0.35);
        }
        .field-link {
          color: rgba(255, 184, 77, 0.7);
          text-decoration: none;
          transition: color 0.2s;
        }
        .field-link:hover {
          color: #FFB84D;
          text-decoration: underline;
        }

        /* ─── Toggle Group ─── */
        .toggle-group {
          display: flex;
          gap: 6px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 4px;
        }
        .level-group {
          flex-wrap: wrap;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(148, 163, 184, 0.5);
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .toggle-btn:hover {
          color: rgba(203, 213, 225, 0.7);
          background: rgba(255,255,255,0.03);
        }
        .toggle-btn.active {
          background: rgba(255, 153, 0, 0.15);
          border-color: rgba(255, 153, 0, 0.3);
          color: #FFB84D;
          font-weight: 600;
        }

        /* ─── Divider ─── */
        .divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 0.5rem 0 1.5rem;
        }

        /* ─── Buttons ─── */
        .actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 2rem;
        }
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
          background: linear-gradient(135deg, #E88B00, #FF9900);
          color: #fff;
          box-shadow: 0 4px 16px rgba(255, 153, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(255, 153, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .btn-primary:active { transform: translateY(0); }

        .btn-ghost {
          background: none;
          border: none;
          padding: 10px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(148, 163, 184, 0.35);
          cursor: pointer;
          transition: color 0.3s;
        }
        .btn-ghost:hover {
          color: rgba(203, 213, 225, 0.6);
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

export default Settings;
