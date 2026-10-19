"use client"

/** MarketHive's switch (S584, Chris: every switch must match MarketHive) - the
    dashboard's MEMB/CORP toggle (Tom, S572/S575): a pill with a navy border,
    a white knob that slides, ON on the button blue #6d83b4, OFF on the light
    blue #a1b1d1, white ON/OFF copy. Styles: .mh-switch in styles/markethive.css.
    The one switch in the studio - never hand-build another. */
export function MhSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  /** Accessible name when no visible <label> wraps the switch. */
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="mh-switch disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden className="mh-switch-knob" />
      <span aria-hidden className="mh-switch-label">
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  )
}
