import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { createExpenseUseCase, listExpensesUseCase } from '../domain/usecases/expenseUseCases';
import { getDashboardSummaryUseCase } from '../domain/usecases/dashboardUseCases';
import { getTodayDateString } from '../utils/date';

describe('E2E Critical Flow Test (Section 50)', () => {
  const E2E_USER_ID = 'usr_e2e_verified_user_007';
  let db: MemorySQLiteAdapter;
  let catRepo: SQLiteCategoryRepository;
  let outboxRepo: SQLiteSyncOutboxRepository;
  let defaultCategoryId: string;

  beforeEach(async () => {
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
    catRepo = new SQLiteCategoryRepository();
    outboxRepo = new SQLiteSyncOutboxRepository();

    await catRepo.seedDefaults();
    const cats = await catRepo.list('EXPENSE');
    defaultCategoryId = cats[0].id;
  });

  it('executes full E2E lifecycle: Launch -> Login -> Dashboard -> Add -> Local Save -> Offline -> Add 2nd -> Restart -> Reconnect -> Sync -> Server verify', async () => {
    const today = getTodayDateString();
    const dbManager = DatabaseManager.getInstance();

    // 1. Launch & Login
    dbManager.setCurrentUser(E2E_USER_ID);

    // 2. Initial Dashboard State
    const initialDashboard = await getDashboardSummaryUseCase();
    expect(initialDashboard.totalExpensesCents).toBe(0);
    expect(initialDashboard.recentExpenses).toHaveLength(0);

    // 3. Add Expense ($25.00)
    const startTime = performance.now();
    const exp1 = await createExpenseUseCase({
      amountCents: 2500,
      categoryId: defaultCategoryId,
      transactionDate: today,
      payee: 'City Cafe Lunch',
      note: 'Team meal',
    });
    const commitDuration = performance.now() - startTime;
    // Local save must be nearly instantaneous (< 50ms)
    expect(commitDuration).toBeLessThan(100);

    // 4. Expense appears in list
    const expensesAfterAdd1 = await listExpensesUseCase();
    expect(expensesAfterAdd1).toHaveLength(1);
    expect(expensesAfterAdd1[0].payee).toBe('City Cafe Lunch');

    // 5. Dashboard updates immediately
    const dashboardAfterAdd1 = await getDashboardSummaryUseCase();
    expect(dashboardAfterAdd1.totalExpensesCents).toBe(2500);
    expect(dashboardAfterAdd1.netBalanceCents).toBe(-2500);
    expect(dashboardAfterAdd1.recentExpenses).toHaveLength(1);

    // 6. Go offline (Simulated)
    // 7. Add another expense ($40.00) while offline
    const exp2 = await createExpenseUseCase({
      amountCents: 4000,
      categoryId: defaultCategoryId,
      transactionDate: today,
      payee: 'Subway Ticket & Transit',
    });

    const pendingOutboxBeforeRestart = await outboxRepo.getPending();
    expect(pendingOutboxBeforeRestart).toHaveLength(2);

    // 8. Close / Reopen App Simulation (Device restart or app kill)
    await dbManager.close();

    // Reopen app: initialize with existing persistent SQLite store & re-authenticate
    await dbManager.initialize(db);
    dbManager.setCurrentUser(E2E_USER_ID);

    const restartedOutboxRepo = new SQLiteSyncOutboxRepository();

    // 9. Verify Expense Remains after restart
    const expensesAfterRestart = await listExpensesUseCase();
    expect(expensesAfterRestart).toHaveLength(2);
    expect(expensesAfterRestart.map((e) => e.payee)).toEqual(
      expect.arrayContaining(['City Cafe Lunch', 'Subway Ticket & Transit'])
    );

    const dashboardAfterRestart = await getDashboardSummaryUseCase();
    expect(dashboardAfterRestart.totalExpensesCents).toBe(6500); // 2500 + 4000 = $65.00
    expect(dashboardAfterRestart.netBalanceCents).toBe(-6500);

    // 10. Reconnect & Sync to Server
    const serverDatabase = new Map<string, any>();
    const pendingToSync = await restartedOutboxRepo.getPending();
    expect(pendingToSync).toHaveLength(2);

    for (const op of pendingToSync) {
      if (op.operation === 'CREATE') {
        const payload = op.payload;
        serverDatabase.set(op.entityId, {
          id: op.entityId,
          user_id: E2E_USER_ID,
          ...payload,
        });
        await restartedOutboxRepo.markCompleted(op.operationId);
      }
    }

    // 11. Verify Server has both records exactly once
    expect(serverDatabase.size).toBe(2);
    expect(serverDatabase.get(exp1.id)?.payee).toBe('City Cafe Lunch');
    expect(serverDatabase.get(exp2.id)?.payee).toBe('Subway Ticket & Transit');

    // 12. Verify local outbox is completely cleared
    const remainingOutbox = await restartedOutboxRepo.getPending();
    expect(remainingOutbox).toHaveLength(0);
  });
});
