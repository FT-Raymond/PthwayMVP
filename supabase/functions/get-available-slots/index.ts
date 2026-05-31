import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...cors, 'Content-Type': 'application/json' }, status,
  })
}

// Parse "HH:MM" into minutes since midnight
function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Format minutes since midnight to "HH:MM"
function minsToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// Convert a UTC date + local time string to UTC ISO
function localTimeToUTC(dateStr: string, timeStr: string, tzOffset: number): Date {
  // dateStr = "YYYY-MM-DD", timeStr = "HH:MM", tzOffset = minutes offset from UTC
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  const localMs = Date.UTC(y, mo - 1, d, h, mi) - tzOffset * 60 * 1000
  return new Date(localMs)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { opportunityId, dateStr, tzOffset = 0 } = body
    // dateStr = "YYYY-MM-DD" in provider's local date
    // tzOffset = client's offset from UTC in minutes (e.g. BST = -60)

    if (!opportunityId || !dateStr) {
      return err(400, 'opportunityId and dateStr are required')
    }

    // 1. Load the service
    const { data: opp } = await supabase
      .from('opportunities')
      .select('id, provider_id, metadata, status')
      .eq('id', opportunityId)
      .single()

    if (!opp || opp.status !== 'active') return err(404, 'Service not found')

    const durationMins: number = opp.metadata?.duration ?? 60
    const providerId: string = opp.provider_id

    // 2. Check date is not in the past (UTC)
    const dateUTC = new Date(dateStr + 'T00:00:00Z')
    const nowUTC = new Date()
    const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()))
    if (dateUTC < todayUTC) {
      return new Response(JSON.stringify({ slots: [], reason: 'past_date' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 3. Check provider-level overrides (holidays/blocked days) — these win
    const { data: overrides } = await supabase
      .from('provider_availability')
      .select('status, date, end_date, label')
      .eq('provider_id', providerId)
      .eq('is_recurring', false)
      .not('date', 'is', null)

    for (const ov of (overrides ?? [])) {
      const start = ov.date
      const end = ov.end_date ?? ov.date
      if (dateStr >= start && dateStr <= end && ov.status === 'blocked') {
        return new Response(JSON.stringify({ slots: [], reason: 'provider_blocked', label: ov.label }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    // 4. Check recurring day-of-week blocks
    const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay()
    const { data: recurringBlocks } = await supabase
      .from('provider_availability')
      .select('day_of_week')
      .eq('provider_id', providerId)
      .eq('is_recurring', true)
      .eq('status', 'blocked')
      .eq('day_of_week', dow)

    if (recurringBlocks && recurringBlocks.length > 0) {
      return new Response(JSON.stringify({ slots: [], reason: 'day_blocked' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 5. Load service-level availability for this day
    const { data: serviceAvail } = await supabase
      .from('service_availability')
      .select('start_time, end_time')
      .eq('opportunity_id', opportunityId)
      .eq('day_of_week', dow)
      .eq('is_active', true)
      .limit(1)

    // 6. Fall back to provider-level hours if no service-level availability
    let workStart: string | null = null
    let workEnd: string | null = null

    if (serviceAvail && serviceAvail.length > 0) {
      workStart = serviceAvail[0].start_time
      workEnd = serviceAvail[0].end_time
    } else {
      const { data: providerHours } = await supabase
        .from('provider_hours')
        .select('start_time, end_time, is_active')
        .eq('provider_id', providerId)
        .eq('day_of_week', dow)
        .single()

      if (!providerHours || !providerHours.is_active) {
        return new Response(JSON.stringify({ slots: [], reason: 'no_hours' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      workStart = providerHours.start_time
      workEnd = providerHours.end_time
    }

    if (!workStart || !workEnd) {
      return new Response(JSON.stringify({ slots: [], reason: 'no_hours' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 7. Load provider settings (buffer, min notice, max bookings/day)
    const { data: settings } = await supabase
      .from('provider_settings')
      .select('buffer_mins, min_notice_hours, max_bookings_per_day')
      .eq('provider_id', providerId)
      .single()

    const bufferMins: number = settings?.buffer_mins ?? 0
    const minNoticeHours: number = settings?.min_notice_hours ?? 0
    const maxPerDay: number = settings?.max_bookings_per_day ?? 0

    // 8. Load existing bookings for this provider on this date
    // Use date range in UTC — cover the full day generously
    const dayStart = new Date(dateStr + 'T00:00:00Z')
    const dayEnd = new Date(dateStr + 'T23:59:59Z')

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('starts_at, ends_at, duration_minutes')
      .eq('provider_id', providerId)
      .not('status', 'in', '("cancelled")')
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())

    // 9. Check max bookings per day
    if (maxPerDay > 0 && (existingBookings?.length ?? 0) >= maxPerDay) {
      return new Response(JSON.stringify({ slots: [], reason: 'fully_booked' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 10. Generate slots at 30-min granularity
    const workStartMins = timeToMins(workStart)
    const workEndMins = timeToMins(workEnd)
    const slotDuration = durationMins + bufferMins // total inventory block
    const now = new Date()

    const slots: { start: string; end: string; available: boolean; startUTC: string; endUTC: string }[] = []

    let cursor = workStartMins
    while (cursor + durationMins <= workEndMins) {
      const slotStartStr = minsToTime(cursor)
      const slotEndStr = minsToTime(cursor + durationMins)

      // Convert to UTC for comparison
      const slotStartUTC = localTimeToUTC(dateStr, slotStartStr, tzOffset)
      const slotEndUTC = localTimeToUTC(dateStr, slotEndStr, tzOffset)

      // Check min notice
      const minNoticeMs = minNoticeHours * 60 * 60 * 1000
      const noticeOk = slotStartUTC.getTime() - now.getTime() >= minNoticeMs

      // Check overlap with existing bookings (including buffer)
      let blocked = false
      for (const booking of (existingBookings ?? [])) {
        const bStart = new Date(booking.starts_at).getTime()
        const bEnd = new Date(booking.ends_at ?? new Date(booking.starts_at).getTime() + (booking.duration_minutes ?? 60) * 60000).getTime()
        const bEndWithBuffer = bEnd + bufferMins * 60000

        // Our slot overlaps if it starts before booking+buffer ends and ends after booking starts
        if (slotStartUTC.getTime() < bEndWithBuffer && slotEndUTC.getTime() > bStart) {
          blocked = true
          break
        }
      }

      const available = noticeOk && !blocked

      slots.push({
        start: slotStartStr,
        end: slotEndStr,
        available,
        startUTC: slotStartUTC.toISOString(),
        endUTC: slotEndUTC.toISOString(),
      })

      cursor += 30 // 30-min granularity
    }

    return new Response(
      JSON.stringify({ slots, date: dateStr, duration: durationMins, buffer: bufferMins }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('get-available-slots error:', e)
    return err(500, e instanceof Error ? e.message : 'Internal error')
  }
})