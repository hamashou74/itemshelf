import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/api/server";

export default async function RootPage() {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect("/login");
  }

  redirect("/home");
}
