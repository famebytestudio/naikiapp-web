const dateTimeFormat = new Intl.DateTimeFormat('en-PK', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const timeFormat = new Intl.DateTimeFormat('en-PK', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const MINUTE = 60_000

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? dateTimeFormat.format(date) : 'Not set'
}

export function formatTime(value) {
  const date = toDate(value)
  return date ? timeFormat.format(date) : 'Not set'
}

/*
  A pickup window is a range, not a single instant. Colons inside the times are
  what make the output unambiguous ("9:00 pm to 10:30 pm").
*/
export function formatWindow(start, end) {
  const from = toDate(start)
  const to = toDate(end)
  if (!from || !to) return 'Not set'
  return `${timeFormat.format(from)} to ${timeFormat.format(to)}`
}

/*
  <input type="datetime-local"> speaks wall-clock local time with no timezone,
  but the database stores timestamptz. These two convert between the value the
  input needs and the ISO string we persist, so a donor in Karachi types 9pm
  and gets 9pm back regardless of where the browser is running.
*/
export function toLocalInputValue(value) {
  const date = toDate(value)
  if (!date) return ''
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE)
  return shifted.toISOString().slice(0, 16)
}

export function fromLocalInputValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/*
  A sensible default pickup window: starting in an hour, lasting 90 minutes.
  Keeps the form usable without inventing a time the donor did not choose.
*/
export function defaultPickupWindow(now = Date.now()) {
  const start = new Date(now + 60 * 60_000)
  const end = new Date(now + (60 + 90) * 60_000)
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) }
}
