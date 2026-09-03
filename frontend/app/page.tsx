import { requireCurrentUser } from "@/features/auth/api/server";
import { LogoutButton } from "@/features/auth/components/logout-button";

export default async function HomePage() {
  await requireCurrentUser();

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Itemshelf</h1>

        <p className="mt-2 text-sm opacity-70">ログインしています。</p>
      </div>

      <LogoutButton />
    </main>
  );
}
