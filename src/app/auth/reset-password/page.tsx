import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { token?: string | string[] };
}) {
  const tokenParam = searchParams?.token;
  const token =
    typeof tokenParam === "string" ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : "";

  return <ResetPasswordClient token={token} />;
}

