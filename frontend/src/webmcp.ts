import { api } from './api';
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal }
  ) => void | Promise<void>;
};
export function registerPointReader() {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!context?.registerTool) return;
  const controller = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'list_saved_points',
          title: '保存したポイントを確認',
          description:
            'このアプリのDBに保存されたポイント一覧を読み取ります。登録・更新・削除はしません。',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input) {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error('引数は空のオブジェクトにしてください。');
            return { points: await api.list() };
          },
        },
        { signal: controller.signal }
      )
    ).catch(() => {});
  } catch {
    /* 未対応ブラウザーでは通常の画面操作を使う */
  }
  return () => controller.abort();
}
