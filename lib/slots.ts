export type Slot = {
  start: string // "HH:MM"
  end: string
  available: boolean
}

export function generateSlots({
  workStart,
  workEnd,
  durationMins,
  bufferMins = 0,
  bookedSlots, // array of { start: "HH:MM", end: "HH:MM" }
}: {
  workStart: string
  workEnd: string
  durationMins: number
  bufferMins?: number
  bookedSlots: { start: string; end: string }[]
}): Slot[] {
  const slots: Slot[] = []

  function toMins(time: string) {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  function toTime(mins: number) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function overlaps(startA: number, endA: number, startB: number, endB: number) {
    return startA < endB && endA > startB
  }

  const workStartMins = toMins(workStart)
  const workEndMins = toMins(workEnd)
  const totalSlot = durationMins + bufferMins

  let cursor = workStartMins

  while (cursor + durationMins <= workEndMins) {
    const slotStart = cursor
    const slotEnd = cursor + durationMins

    const isBooked = bookedSlots.some(b => {
      const bStart = toMins(b.start)
      const bEnd = toMins(b.end)
      return overlaps(slotStart, slotEnd + bufferMins, bStart, bEnd)
    })

    slots.push({
      start: toTime(slotStart),
      end: toTime(slotEnd),
      available: !isBooked,
    })

    cursor += totalSlot
  }

  return slots
}

export function formatSlotTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}