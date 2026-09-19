export const drawer =
  "pointer-events-none absolute inset-0 z-4 overflow-clip data-[open=true]:z-5"

export const drawerTrack =
  "absolute top-3.5 right-3.5 flex max-h-[calc(100%-28px)] w-[min(340px,calc(100%-82px))] translate-x-full in-data-[open=true]:translate-x-0"

export const panelHandle =
  "pointer-events-auto absolute top-0 right-[calc(100%+6px)] h-10 min-w-10 border-rule-strong bg-surface px-2.5 font-mono text-xs text-ink-muted"

export const drawerPanel =
  "pointer-events-auto invisible relative flex min-h-0 w-full max-w-full flex-col gap-3 border border-rule-strong bg-paper p-3 shadow-menu in-data-[open=true]:visible"
