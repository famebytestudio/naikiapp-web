const formatter = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 1 })

/*
  Quantities below 10kg keep a decimal because "0.5 kg" and "8.5 kg" are
  meaningful donations; above that the decimal is noise. Impact totals round to
  whole kilograms.
*/
export function formatKg(kg, { precise = false } = {}) {
  const value = Number(kg)
  if (!Number.isFinite(value)) return '0 kg'

  if (precise || (value > 0 && value < 10)) {
    return `${formatter.format(value)} kg`
  }
  return `${Math.round(value).toLocaleString('en-PK')} kg`
}

/*
  QUANTITY_UNITS values are already plural ('plates', 'trays', ...), so they are
  used as-is rather than pluralised again. kg is handled by formatKg because a
  sub-10kg donation keeps its decimal.
*/
export function formatQuantity(value, unit) {
  const count = Number(value)
  if (!Number.isFinite(count)) return ''
  if (unit === 'kg') return formatKg(count, { precise: true })
  return `${count.toLocaleString('en-PK')} ${unit}`
}
