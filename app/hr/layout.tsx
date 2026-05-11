import HideInventoryShell from "@/components/hide-inventory-shell";

export default function HRLayout({
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