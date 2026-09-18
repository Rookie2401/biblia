/**
 * Accessible modal behaviour for sheets and the phone-width word/verse panel:
 * focus moves into the dialog when it opens, Tab/Shift+Tab cycle inside it, Escape closes it,
 * the rest of the page is made inert, and focus returns to the control that opened it.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export interface ModalOptions {
  /** the dialog is modal only while this is true (false = ordinary side panel) */
  active: boolean;
  onClose: () => void;
  /** the element to return focus to; defaults to whatever was focused when the dialog became active */
  returnTo?: HTMLElement | null;
  /** page regions to mark inert while the dialog is modal */
  inertSelector?: string;
}

export function useModalDialog(ref: RefObject<HTMLElement | null>, { active, onClose, returnTo, inertSelector }: ModalOptions): void {
  const returnRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    returnRef.current = returnTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((f) => f.offsetParent !== null || f === document.activeElement);
    // focus the dialog itself first (its title is announced), not the first control
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    const inerted: Element[] = [];
    if (inertSelector) {
      for (const region of document.querySelectorAll(inertSelector)) {
        if (region.contains(el)) continue;
        region.setAttribute('inert', '');
        inerted.push(region);
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || current === el || !el.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !el.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!el.contains(e.target as Node)) el.focus();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn);
      for (const region of inerted) region.removeAttribute('inert');
      const back = returnRef.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
    // returnTo is read once when the dialog becomes active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref, inertSelector]);
}

let idCounter = 0;
export function useStableId(prefix: string): string {
  const [id] = useState(() => `${prefix}-${++idCounter}`);
  return id;
}
