// Layout for translation job pages — wraps review in AppShell
// so the sidebar and TopBar persist on all job-level routes.
import { AppShell } from "../../components/AppShell";

export default function TranslationJobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
