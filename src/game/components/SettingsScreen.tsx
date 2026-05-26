import type { UserSettings } from "../lib/storage.js";

interface Props {
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, setSettings, onBack }: Props): JSX.Element {
  return (
    <div className="title-screen">
      <div className="title-content">
        <h1 className="title-name">Settings & Data</h1>
        <p className="title-abstract">Accessibility and local data controls.</p>

        <div className="reports-list" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="row between">
              <strong>Reduced Motion</strong>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => setSettings({ ...settings, reducedMotion: e.target.checked })}
              />
            </div>
          </div>

          <div className="card">
            <div className="row between">
              <strong>Text Scale</strong>
              <select
                value={settings.textScale}
                onChange={(e) => setSettings({ ...settings, textScale: e.target.value as UserSettings["textScale"] })}
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
          </div>
        </div>

        <div className="title-actions">
          <button className="secondary" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
