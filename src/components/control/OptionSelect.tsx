import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { CatalogOption } from '../../utils/optionCatalog.ts';

const POPUP_GAP = 4;
const POPUP_MAX_HEIGHT = 260;
const VIEWPORT_MARGIN = 8;

interface PopupPosition {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
}

export interface OptionSelectProps<T extends string> {
  /** Accessible name for both the trigger and the listbox. */
  ariaLabel: string;
  value: T;
  options: readonly CatalogOption<T>[];
  onChange: (value: T) => void;
  testId?: string;
  disabled?: boolean;
  /** The popup never gets narrower than this, even if the trigger is tiny. */
  minPopupWidth?: number;
  /** Extra classes for the trigger button. */
  className?: string;
}

/**
 * Compact dropdown used by the control panel. The popup is portalled to the
 * body so it is never clipped by the panel's scroll container, and it flips
 * above the trigger when there is no room below.
 */
export function OptionSelect<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  testId,
  disabled = false,
  minPopupWidth = 0,
  className = '',
}: OptionSelectProps<T>) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  );
  const selected = options[selectedIndex];
  const SelectedIcon = selected?.icon;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, minPopupWidth);
    const height = popupRef.current?.offsetHeight ?? 0;

    const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - POPUP_GAP - VIEWPORT_MARGIN;
    const placement: PopupPosition['placement'] =
      height > spaceBelow && spaceAbove > spaceBelow ? 'top' : 'bottom';

    const top =
      placement === 'bottom' ? rect.bottom + POPUP_GAP : rect.top - POPUP_GAP - height;

    setPosition({
      top: Math.max(VIEWPORT_MARGIN, top),
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)
      ),
      width,
      placement,
    });
  }, [minPopupWidth]);

  // Provisional position, applied before the first paint so the popup is
  // already at its final width when it gets measured below the trigger.
  const openList = useCallback(
    (index: number) => {
      const trigger = triggerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const width = Math.max(rect.width, minPopupWidth);
        setPosition({
          top: rect.bottom + POPUP_GAP,
          left: Math.max(
            VIEWPORT_MARGIN,
            Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)
          ),
          width,
          placement: 'bottom',
        });
      }
      setActiveIndex(index);
      setOpen(true);
    },
    [minPopupWidth]
  );

  // Measure the rendered popup and flip it above the trigger if needed.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  // Keep the portal anchored while the panel or page scrolls/resizes.
  useEffect(() => {
    if (!open) return;
    const handleReflow = () => updatePosition();
    window.addEventListener('resize', handleReflow);
    window.addEventListener('scroll', handleReflow, true);
    return () => {
      window.removeEventListener('resize', handleReflow);
      window.removeEventListener('scroll', handleReflow, true);
    };
  }, [open, updatePosition]);

  // Dismiss on an outside press.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        openList(event.key === 'ArrowUp' ? options.length - 1 : selectedIndex);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        data-open={open ? 'true' : 'false'}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        onClick={() => (open ? setOpen(false) : openList(selectedIndex))}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[9px] text-neutral-200 transition-[background-color,border-color,color,opacity] cursor-pointer hover:border-neutral-700 hover:bg-neutral-800 focus:outline-none focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        {SelectedIcon && <SelectedIcon size={9} className="shrink-0 text-cyan-400" />}
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          size={9}
          className={`shrink-0 text-neutral-500 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            data-ui-panel
            data-testid={testId ? `${testId}-listbox` : undefined}
            className="option-popup fixed z-50 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/98 p-1 shadow-2xl backdrop-blur-md"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: position?.width,
              maxHeight: POPUP_MAX_HEIGHT,
              visibility: position ? 'visible' : 'hidden',
              transformOrigin: position?.placement === 'top' ? 'bottom' : 'top',
            }}
          >
            {options.map((option, index) => {
              const OptionIcon = option.icon;
              const isSelected = option.id === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(index)}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-[10px] cursor-pointer transition-colors ${
                    isActive ? 'bg-neutral-800 text-white' : 'text-neutral-300'
                  }`}
                >
                  {OptionIcon && (
                    <OptionIcon
                      size={11}
                      className={`mt-0.5 shrink-0 ${
                        isSelected ? 'text-cyan-300' : 'text-cyan-500/70'
                      }`}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-tight">{option.label}</span>
                    {option.description && (
                      <span className="block text-[9px] leading-tight text-neutral-500">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check size={11} className="mt-0.5 shrink-0 text-cyan-300" />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
