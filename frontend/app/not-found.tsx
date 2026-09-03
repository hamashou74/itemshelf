import { requireCurrentUser } from "@/features/auth/api/server";

export default async function NotFound() {
  await requireCurrentUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">ページが見つかりません</h1>

      <p className="text-sm opacity-70">指定されたページは存在しません。</p>
    </main>
  );
}
