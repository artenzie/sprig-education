/**
 * Today (as YYYY-MM-DD) in the student's own timezone. Matches the
 * `daily_checkins.date` column, which doubles as half of that table's primary
 * key -- the exact counterpart of currentWeekStart() in week.ts.
 *
 * Built by hand from the local parts rather than with toISOString().slice(0,10),
 * and that is the whole point of the function. toISOString() converts to UTC
 * first, so a student checking in at 23:30 in Barcelona (UTC+2) would be
 * recorded against *tomorrow's* date -- and then find the prompt gone the
 * following evening, having never checked in that day. Sprig's pilot schools
 * are all in UTC+1/+2, so this is a real evening, not a theoretical one.
 */
export function todayKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
