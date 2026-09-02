import type { PointerEvent as ReactPointerEvent } from 'react';

declare global {
  namespace React {
    type PointerEvent<T = Element> = ReactPointerEvent<T>;
  }
}

export {};
