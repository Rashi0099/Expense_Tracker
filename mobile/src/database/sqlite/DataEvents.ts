/**
 * DataEvents — In-Memory Reactivity Event Bus
 *
 * Provides a pub-sub mechanism across the local data layer.
 * Whenever mutations occur in SQLite, notifying DataEvents triggers
 * automatic updates in any active screens (Dashboard, Expenses, Budgets, Income).
 */

export type DataEventType =
  | 'EXPENSES_CHANGED'
  | 'INCOME_CHANGED'
  | 'BUDGETS_CHANGED'
  | 'CATEGORIES_CHANGED'
  | 'RECURRING_CHANGED'
  | 'SYNC_OUTBOX_CHANGED'
  | 'WALLETS_CHANGED';

type EventListener = () => void;

class DataEventBus {
  private listeners: Map<DataEventType, Set<EventListener>> = new Map();

  subscribe(eventType: DataEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return un-subscribe function
    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(listener);
      }
    };
  }

  notify(eventType: DataEventType): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          // Prevent one subscriber error from interrupting others
          console.error(`[DataEvents] Error in subscriber for ${eventType}:`, err);
        }
      });
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const DataEvents = new DataEventBus();
