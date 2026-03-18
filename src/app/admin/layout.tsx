import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/current-user";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/auth/login");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-amber-400">Administración</h1>
      <AdminNav />
      <div>{children}</div>
    </div>
  );
}
