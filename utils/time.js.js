// utils/time.js
const { DateTime } = require('luxon');

const MEXICO_CITY_TIMEZONE = 'America/Mexico_City';
const EIGHT_AM_HOUR = 8; // 8 AM

/**
 * Gets the current DateTime object in the Mexico City timezone.
 * @returns {DateTime}
 */
function getCurrentMexicoCityTime() {
    return DateTime.now().setZone(MEXICO_CITY_TIMEZONE);
}

/**
 * Calculates the start and end of the current "day" in Mexico City timezone,
 * where a day starts at 8 AM and ends at 7:59:59 AM the next day.
 * @returns {{startOfDay: DateTime, endOfDay: DateTime}}
 */
function getDailyTimeRange() {
    const now = getCurrentMexicoCityTime();
    let startOfDay = now.set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 });

    if (now < startOfDay) {
        // If current time is before 8 AM, the "day" started yesterday at 8 AM
        startOfDay = startOfDay.minus({ days: 1 });
    }
    const endOfDay = startOfDay.plus({ days: 1 }).minus({ milliseconds: 1 }); // Just before 8 AM next day

    return { startOfDay, endOfDay };
}

/**
 * Calculates the start and end of the current "week" in Mexico City timezone,
 * where a week starts on Monday at 8 AM and ends on Monday at 7:59:59 AM the next week.
 * @returns {{startOfWeek: DateTime, endOfWeek: DateTime}}
 */
function getWeeklyTimeRange() {
    const now = getCurrentMexicoCityTime();
    // Set to the current day at 8 AM
    let startOfWeek = now.set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 });

    // Move to the most recent Monday (luxon.weekday starts from 1=Monday)
    startOfWeek = startOfWeek.startOf('week'); // This gets Monday at 00:00:00 local time
    startOfWeek = startOfWeek.set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 }); // Set to 8 AM Monday

    // If 'now' is a Monday before 8 AM, then the start of the current "week" was last Monday at 8 AM
    if (now.weekday === 1 && now < startOfWeek) { // Monday and before 8 AM
        startOfWeek = startOfWeek.minus({ weeks: 1 });
    }

    const endOfWeek = startOfWeek.plus({ weeks: 1 }).minus({ milliseconds: 1 }); // Just before 8 AM next Monday

    return { startOfWeek, endOfWeek };
}

module.exports = {
    getCurrentMexicoCityTime,
    getDailyTimeRange,
    getWeeklyTimeRange,
    MEXICO_CITY_TIMEZONE, // Export for consistency if needed elsewhere
    EIGHT_AM_HOUR // Export for consistency if needed elsewhere
};