import { useEffect, useRef, useState } from 'react';
import { Check, Lock, RotateCcw, X } from 'lucide-react';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { drawCharacterModelPreview, drawCharacterPortrait, type ModelPose } from '../engine/characterDraw';
import type { CharacterId, PlayerProgress } from '../types/game';

function CharacterCanvas({ charId, pose }: { charId: CharacterId; pose?: ModelPose }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = pose ? 220 : 64, height = pose ? 190 : 64;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    if (pose) drawCharacterModelPreview(ctx, charId, width, height, pose);
    else drawCharacterPortrait(ctx, charId, width);
  }, [charId, pose]);
  return <canvas ref={ref} width={pose ? 220 : 64} height={pose ? 190 : 64}
    role="img" aria-label={`${getCharacterById(charId).name}${pose ? ` ${pose} model` : ' portrait'}`}
    className={pose ? 'w-full h-[170px] sm:h-[210px] object-contain' : 'w-16 h-16 shrink-0'} />;
}

interface CharacterSelectModalProps {
  open: boolean;
  progress: PlayerProgress;
  onSelect: (id: CharacterId) => void;
  onResetAll?: () => void;
  onClose: () => void;
}

export function CharacterSelectModal({ open, progress, onSelect, onResetAll, onClose }: CharacterSelectModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [previewId, setPreviewId] = useState<CharacterId>(progress.selectedCharacter);
  const [pose, setPose] = useState<ModelPose>('ready');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (open) { setPreviewId(progress.selectedCharacter); setPose('ready'); setConfirmReset(false); }
  }, [open, progress.selectedCharacter]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();
    const escape = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  const character = getCharacterById(previewId);
  const unlocked = progress.unlockedIds.includes(previewId);
  const equipped = progress.selectedCharacter === previewId;
  const index = CHARACTERS.findIndex(c => c.id === previewId);
  return <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="locker-title"
      className="w-full sm:max-w-3xl bg-[#11151D] border border-slate-700/80 rounded-t-2xl sm:rounded-2xl h-[92dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key !== 'Tab') return;
        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }}>
      <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <p className="text-[10px] font-mono tracking-[.22em] text-amber-400 mb-1">MEET THE STUNT CREW</p>
          <h2 id="locker-title" className="font-display text-3xl font-extrabold uppercase text-white">Diver locker <span className="text-base text-slate-500 ml-2">{progress.unlockedIds.length}/{CHARACTERS.length}</span></h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close character locker" className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 grid auto-rows-max sm:grid-cols-[220px_1fr] gap-4 content-start">
        <section ref={previewRef} className="grid grid-cols-[150px_minmax(0,1fr)] sm:block rounded-xl border border-slate-700/70 bg-[#0D1119] overflow-hidden">
          <div className="relative flex items-center bg-[radial-gradient(ellipse_at_center,_#253044_0%,_#0D1119_75%)]">
            <span className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">SP / {String(index + 1).padStart(2, '0')}</span>
            <CharacterCanvas charId={previewId} pose={pose} />
          </div>
          <div className="px-2 py-3 sm:px-3 sm:pt-0 sm:pb-4 text-center">
            <div className="flex rounded-lg bg-slate-900 p-1 gap-1 mb-2 sm:mb-4" role="group" aria-label="Preview pose">
              {(['ready', 'tucked', 'rotated'] as const).map(p => <button key={p} type="button" aria-pressed={pose === p} onClick={() => setPose(p)}
                className={`flex-1 min-h-9 rounded-md text-[11px] font-semibold transition-colors ${pose === p ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                {p === 'ready' ? 'Upright' : p === 'tucked' ? 'Tucked' : 'Sideways'}
              </button>)}
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase text-white">{character.name}</h3>
            <p className="hidden sm:block text-xs text-slate-400 mt-1 min-h-8">{character.tagline}</p>
            <p className="text-[10px] font-mono text-amber-400 mt-2 mb-2 sm:mt-3 sm:mb-3 min-h-8">
              {unlocked ? 'READY FOR THE DROP' : `Clear stage ${character.requiredStreak} or earn ${character.requiredTotalJumps} total clears`}
            </p>
            <button type="button" disabled={!unlocked || equipped} onClick={() => { onSelect(previewId); dialogRef.current?.querySelector('button')?.focus(); }}
              className={`w-full min-h-11 rounded-lg font-display text-lg uppercase font-bold flex items-center justify-center gap-2 ${equipped ? 'bg-emerald-500/15 text-emerald-300' : unlocked ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'bg-slate-800 text-slate-500'}`}>
              {equipped ? <><Check className="w-4 h-4" /> Equipped</> : unlocked ? 'Equip diver' : <><Lock className="w-4 h-4" /> Locked</>}
            </button>
          </div>
        </section>
        <div className="grid grid-cols-3 gap-2 content-start" role="group" aria-label="Choose a diver to preview">
          {CHARACTERS.map(char => {
            const available = progress.unlockedIds.includes(char.id);
            const selected = previewId === char.id;
            const active = progress.selectedCharacter === char.id;
            return <button key={char.id} type="button" onClick={() => { setPreviewId(char.id); previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} aria-pressed={selected}
              aria-label={`Preview ${char.name}${available ? '' : ', locked'}`}
              className={`relative min-h-[126px] rounded-xl border flex flex-col items-center justify-center px-1 py-3 transition-colors ${selected ? 'bg-amber-500/10 border-amber-500' : 'bg-[#151B26] border-slate-800 hover:border-slate-500'}`}>
              <span className="absolute top-2 right-2">{active ? <Check className="w-3 h-3 text-emerald-400" /> : !available ? <Lock className="w-3 h-3 text-slate-500" /> : null}</span>
              <CharacterCanvas charId={char.id} />
              <span className="font-display text-sm sm:text-base font-bold uppercase text-slate-100 text-center leading-tight mt-1">{char.name}</span>
              <span className="text-[9px] font-mono text-slate-500 mt-1">{active ? 'EQUIPPED' : available ? 'UNLOCKED' : `STAGE ${char.requiredStreak}`}</span>
            </button>;
          })}
        </div>
      </div>
      <footer className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <p className="text-[10px] text-slate-500 leading-relaxed">Cosmetic crew. Same physics and collision body for every diver.<br />Ears, fins and accessories are decorative.</p>
        {onResetAll && (confirmReset ? <div className="flex gap-2 shrink-0 items-center">
          <span className="text-[10px] text-red-300">Wipe all progress?</span>
          <button type="button" onClick={() => { onResetAll(); setConfirmReset(false); }} className="min-h-10 px-3 rounded-lg bg-red-700 text-xs text-white">Confirm reset</button>
          <button type="button" onClick={() => setConfirmReset(false)} className="min-h-10 px-2 text-xs text-slate-400">Cancel</button>
        </div> : <button type="button" onClick={() => setConfirmReset(true)} aria-label="Reset all progress and unlocks" className="min-h-10 min-w-10 text-slate-500 hover:text-red-400 flex items-center justify-center"><RotateCcw className="w-4 h-4" /></button>)}
      </footer>
    </div>
  </div>;
}
