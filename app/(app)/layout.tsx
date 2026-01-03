import AppShell from "@/components/app-shell/AppShell";

export default function Layout({
  children,
}: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}