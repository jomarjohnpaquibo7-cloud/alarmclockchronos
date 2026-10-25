import { router, json, error, db } from '@appdeploy/sdk';

type AppState = { schedules: unknown[]; notes: unknown[] };
function safeKey(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) return null;
  return value;
}
function tableFor(key: string) {
  return `chronos_${key}`;
}

export const handler = router({
  'GET /api/state': [
    async ({ query }) => {
      const key = safeKey(query.clientKey);
      if (!key) return error('A valid client key is required.', 400);
      const result = await db.get<AppState>(tableFor(key), ['state']);
      return json(result[0] || { schedules: [], notes: [] });
    },
  ],
  'PUT /api/state': [
    async ({ body }) => {
      const input = body as { clientKey?: unknown; state?: AppState } | null;
      const key = safeKey(input?.clientKey);
      if (!key) return error('A valid client key is required.', 400);
      const state = input?.state;
      if (
        !state ||
        !Array.isArray(state.schedules) ||
        !Array.isArray(state.notes)
      ) {
        return error('Invalid state payload.', 400);
      }
      if (JSON.stringify(state).length > 200000)
        return error('State is too large.', 413);
      const table = tableFor(key);
      const current = await db.get<AppState>(table, ['state'], {
        consistent: true,
      });
      if (current[0]) {
        const [updated] = await db.update(table, [
          { id: 'state', record: state as unknown as Record<string, unknown> },
        ]);
        if (!updated) return error('Could not save state.', 503);
      } else {
        const [created] = await db.add(table, [{ id: 'state', ...state }]);
        if (!created) return error('Could not create state record.', 503);
      }
      return json({ saved: true });
    },
  ],
});
