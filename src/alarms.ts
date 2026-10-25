import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';

type Alarm = { id: string; title: string; time: string; days: string[]; notes: string; enabled: boolean };
const DAY_NUMBER: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
function notificationId(id: string, day: string) {
  let hash = 0;
  for (const char of id + ':' + day) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 2000000000) + 1;
}
export async function prepareAlarmNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') await LocalNotifications.requestPermissions();
  await LocalNotifications.createChannel({
    id: 'chronos-alarms',
    name: 'Chronos Alarms',
    description: 'Scheduled alarm reminders',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true,
  });
}
export async function syncAlarmNotifications(alarms: Alarm[]) {
  if (!Capacitor.isNativePlatform()) return;
  await prepareAlarmNotifications();
  const pending = await LocalNotifications.getPending();
  const wanted = new Map<number, LocalNotificationSchema>();
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [hour, minute] = alarm.time.split(':').map(Number);
    for (const day of alarm.days) {
      const weekday = DAY_NUMBER[day];
      if (!weekday) continue;
      const id = notificationId(alarm.id, day);
      wanted.set(id, {
        id,
        title: alarm.title || 'Chronos Alarm',
        body: alarm.notes || 'Your scheduled alarm is due.',
        channelId: 'chronos-alarms',
        schedule: { on: { weekday, hour, minute }, repeats: true, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        extra: { scheduleId: alarm.id, day },
      });
    }
  }
  const stale = pending.notifications.filter(n => !wanted.has(n.id));
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(n => ({ id: n.id })) });
  const notifications = [...wanted.values()];
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
