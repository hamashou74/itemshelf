import { redirect } from "next/navigation";

import { LogoutButton } from "@/app/logout-button";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <section className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Itemshelf
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Signed in
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              User ID: <span className="font-mono">{user.id}</span>
            </p>
          </div>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
