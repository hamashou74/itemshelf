import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/api/server";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "ログイン",
};

export default async function LoginPage() {
  const currentUser = await getCurrentUser();

  if (currentUser !== null) {
    redirect("/home");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <section className="flex w-full max-w-sm flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold">Itemshelf</h1>

          <p className="mt-2 text-sm opacity-70">
            アカウントにログインしてください。
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
