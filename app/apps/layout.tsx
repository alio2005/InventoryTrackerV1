import HideInventoryShell from "@/components/hide-inventory-shell";

export default function AppsLayout({
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