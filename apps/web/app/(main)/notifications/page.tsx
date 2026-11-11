import type { Metadata } from "next";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Thông báo" };

export default function NotificationsPage() {
  return <NotificationList />;
}
