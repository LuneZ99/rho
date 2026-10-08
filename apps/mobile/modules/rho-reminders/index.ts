import { requireOptionalNativeModule } from "expo-modules-core";
export type ReminderStatus = {
  installedReminderVersions: Record<string, number>;
  notificationPermission: boolean;
  exactAlarmPermission: boolean;
  receipts: string[];
  history: {
    key: string;
    title: string;
    at: number;
    itemId: string;
    deliveredAt: number;
    missed: boolean;
  }[];
};
export const Reminders = requireOptionalNativeModule<{
  sync(json: string): Promise<string>;
  status(): Promise<string>;
  openSettings(): Promise<void>;
}>("RhoReminders");
