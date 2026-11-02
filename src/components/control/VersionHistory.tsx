import React from 'react';
import { PlusCircle, CornerUpLeft, Trash2 } from 'lucide-react';
import { SavedVersion, MAX_VERSIONS } from '../../utils/storage.ts';

export interface VersionHistoryProps {
  savedVersions: SavedVersion[];
  onSaveVersion: (label: string) => void;
  onRestoreVersion?: (id: string) => void;
  onDeleteVersion?: (id: string) => void;
  versionLabel: string;
  setVersionLabel: React.Dispatch<React.SetStateAction<string>>;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  savedVersions,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  versionLabel,
  setVersionLabel,
}) => {
  return (
    <div
      data-testid="version-history"
      className="mt-2 p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex flex-col gap-1.5 text-xs"
    >
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSaveVersion) {
              onSaveVersion(versionLabel);
              setVersionLabel('');
            }
          }}
          placeholder="Version name (optional)…"
          maxLength={40}
          className="flex-1 h-5 px-1.5 rounded border border-neutral-700 bg-neutral-950 text-[10px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          disabled={savedVersions.length >= MAX_VERSIONS}
          onClick={() => {
            onSaveVersion(versionLabel);
            setVersionLabel('');
          }}
          className="h-5 px-2 rounded border border-indigo-700/70 bg-indigo-950/80 text-indigo-300 hover:bg-indigo-900 text-[10px] flex items-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer disabled:opacity-40"
        >
          <PlusCircle size={10} />
          <span>Save</span>
        </button>
      </div>

      {savedVersions.length === 0 ? (
        <p className="text-[9px] text-neutral-500 italic">No versions yet.</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-thin pr-0.5">
          {savedVersions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-1 p-1 rounded bg-neutral-950/80 border border-neutral-800 text-[9px]"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-neutral-200">{v.label}</span>
                <span className="text-neutral-500 ml-1.5 font-mono">{v.savedAt}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onRestoreVersion?.(v.id)}
                  title={`Restore ${v.label}`}
                  aria-label={`Restore ${v.label}`}
                  className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 hover:text-white"
                >
                  <CornerUpLeft size={9} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteVersion?.(v.id)}
                  title={`Delete ${v.label}`}
                  aria-label={`Delete ${v.label}`}
                  className="p-0.5 rounded bg-neutral-900 text-neutral-500 hover:text-red-400"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
