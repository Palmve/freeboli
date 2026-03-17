import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) redirect("/auth/login");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-amber-400">Administración</h1>
      {children}
    </div>
  );
}
