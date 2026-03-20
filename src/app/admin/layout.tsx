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
    <div className="space-y-6 sm:space-y-8 pb-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-400 text-center sm:text-left tracking-tight">
        Administración
      </h1>
      <AdminNav />
      <div className="min-h-[60vh]">{children}</div>
    </div>
  );
}
