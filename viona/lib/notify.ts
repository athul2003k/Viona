import { sendNotification } from '@/lib/rabbitmq';

export function notifyAsync(payload: any) {
  queueMicrotask(() => {
    sendNotification(payload).catch(console.error);
  });
}
