import React, { useEffect, useState } from 'react';
import { getSettings, isMicPermissionGranted, isSetupComplete } from '../shared/storage';
import { ExtensionSettings } from '../shared/types';

const Popup: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [setupDone, setSetupDone] = useState<boolean | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    isMicPermissionGranted().then(setMicGranted);
    isSetupComplete().then(setSetupDone);
  }, []);

  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  };

  const openWelcome = () => {
    chrome.runtime.sendMessage({ action: 'open-welcome' });
    window.close();
  };

  const shortcutDisplay = settings?.shortcutKey === '`' ? 'Backtick (`)' : settings?.shortcutKey ?? '...';

  if (settings === null || micGranted === null || setupDone === null) {
    return (
      <div className="w-72 p-4 bg-gray-800 text-gray-300">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-72 p-4 bg-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <img src={chrome.runtime.getURL('icons/icon-48.png')} alt="" className="w-6 h-6 rounded" />
        <h1 className="text-base font-bold text-white">ScreenSense Voice</h1>
      </div>

      {!setupDone && (
        <div className="bg-yellow-900/50 border border-yellow-500/50 rounded-lg p-3 mb-3">
          <p className="text-yellow-300 text-sm mb-2">Setup not complete</p>
          <button
            onClick={openWelcome}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Complete setup
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Shortcut</span>
          <span className="font-mono text-sm bg-gray-700 px-2 py-0.5 rounded text-blue-300">
            {shortcutDisplay}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Microphone</span>
          {micGranted ? (
            <span className="text-sm text-green-400 flex items-center gap-1">
              {'\u2713'} Granted
            </span>
          ) : (
            <button
              onClick={openWelcome}
              className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              {'\u2717'} Not granted
            </button>
          )}
        </div>

        <hr className="border-gray-700" />

        <button
          onClick={openSettings}
          className="w-full text-sm text-gray-300 hover:text-white py-1.5 rounded hover:bg-gray-700 transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  );
};

export default Popup;
