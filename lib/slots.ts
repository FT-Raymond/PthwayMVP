type BookedSlot = { start: string; end: string }
type Slot = { start: string; end: string; available: boolean }

function toMins(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMins(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateSlots({
  workStart,
  workEnd,
  durationMins,
  bufferMins = 0,
  bookedSlots = [],
}: {
  workStart: string
  workEnd: string
  durationMins: number
  bufferMins?: number
  bookedSlots?: BookedSlot[]
}): Slot[] {
  const slots: Slot[] = []
  const end = toMins(workEnd)
  const step = durationMins + bufferMins

  for (let cur = toMins(workStart); cur + durationMins <= end; cur += step) {
    const slotEnd = cur + durationMins
    const available = !bookedSlots.some(b => {
      const bs = toMins(b.start)
      const be = toMins(b.end)
      return cur < be && slotEnd > bs
    })
    slots.push({ start: fromMins(cur), end: fromMins(slotEnd), available })
  }

  return slots
}

export function formatSlotTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}
