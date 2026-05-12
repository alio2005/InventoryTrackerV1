import HideInventoryShell from "@/components/hide-inventory-shell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HideInventoryShell />
      {children}
    </>
  );
}