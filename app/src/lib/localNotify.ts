import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

let permissionAsked = false

/** Fire a local notification on native platforms. No-op on web — a browser
 *  permission prompt for a background tab is more annoying than useful, and
 *  the in-app toast already covers that case. */
export async function notifyLocal(title: string, body: string) {
  if (!Capacitor.isNativePlatform()) return

  if (!permissionAsked) {
    permissionAsked = true
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') await LocalNotifications.requestPermissions()
  }

  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return

  await LocalNotifications.schedule({
    notifications: [{
      id: Math.floor(Math.random() * 2_147_483_647),
      title,
      body,
      schedule: { at: new Date(Date.now() + 200) },
    }],
  })
}
