import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from '../services/notificationService';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { createRecurringUseCase } from '../domain/usecases/recurringUseCases';
import { createBudgetUseCase } from '../domain/usecases/budgetUseCases';
import { createExpenseUseCase } from '../domain/usecases/expenseUseCases';

describe('Notification & Reminder Engine Tests (Section 15, 16, 17)', () => {
  let memoryDb: MemorySQLiteAdapter;
  const userId = 'notif_user_test_01';
  const notificationService = NotificationService.getInstance();

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);
    await notificationService.resetDelivered();
    await notificationService.updateSettings({
      recurringRemindersEnabled: true,
      budgetAlertsEnabled: true,
    });
  });

  it('generates deterministic stable IDs for recurring and budget notifications', () => {
    const recId = notificationService.generateRecurringReminderId('rec-123', '2026-09-15');
    expect(recId).toBe('rec_rec-123_2026-09-15');

    const budgetWarnId = notificationService.generateBudgetAlertId('b-99', '2026-09', 'warning_80');
    expect(budgetWarnId).toBe('budget_b-99_2026-09_warning_80');

    const budgetExceedId = notificationService.generateBudgetAlertId('b-99', '2026-09', 'exceeded_100');
    expect(budgetExceedId).toBe('budget_b-99_2026-09_exceeded_100');
  });

  it('schedules recurring reminder and deduplicates on subsequent runs', async () => {
    const today = '2026-09-15';
    await createRecurringUseCase({
      categoryId: 'c1',
      title: 'Netflix Subscription',
      amountCents: 1599,
      frequency: 'MONTHLY',
      startDate: '2026-08-15',
      nextDueDate: today,
    });

    // Run first check
    const firstRun = await notificationService.checkRecurringReminders(today);
    expect(firstRun).toHaveLength(1);
    expect(firstRun[0].title).toBe('Recurring Bill Due Today');
    expect(firstRun[0].id).toContain('2026-09-15');

    // Run second check immediately (simulating sync or app reboot)
    const secondRun = await notificationService.checkRecurringReminders(today);
    expect(secondRun).toHaveLength(0); // Deduplicated!
  });

  it('schedules budget warning at >=80% and deduplicates unchanged condition', async () => {
    const currentMonth = '2026-09';
    // Create an overall budget of $100.00
    await createBudgetUseCase({
      periodStart: `${currentMonth}-01`,
      limitAmountCents: 10000,
    });

    // Add expense of $85.00 (85% consumed)
    await createExpenseUseCase({
      categoryId: 'c1',
      amountCents: 8500,
      transactionDate: `${currentMonth}-05`,
      paymentMethod: 'CREDIT_CARD',
    });

    // Check budget alert
    const firstRun = await notificationService.checkBudgetAlerts(currentMonth);
    expect(firstRun).toHaveLength(1);
    expect(firstRun[0].title).toBe('Approaching Budget Limit');
    expect(firstRun[0].id).toContain('warning_80');

    // Subsequent check for unchanged condition
    const secondRun = await notificationService.checkBudgetAlerts(currentMonth);
    expect(secondRun).toHaveLength(0); // Deduplicated!
  });

  it('respects user settings when disabled', async () => {
    await notificationService.updateSettings({
      recurringRemindersEnabled: false,
      budgetAlertsEnabled: false,
    });

    await createRecurringUseCase({
      categoryId: 'c1',
      title: 'Spotify',
      amountCents: 999,
      frequency: 'MONTHLY',
      startDate: '2026-08-15',
      nextDueDate: '2026-09-15',
    });

    const notifs = await notificationService.checkRecurringReminders('2026-09-15');
    expect(notifs).toHaveLength(0);
  });
});
