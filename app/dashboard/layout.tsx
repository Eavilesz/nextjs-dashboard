import SideNav from '@/app/ui/dashboard/sidenav';

// partial prerendering. This needs suspense on inner components. Also, don't forget to modify the next.config.json file with the ppr field.
export const experimental_ppi = true;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      <div className="flex-grow p-6 md:overflow-y-auto md:p-12">{children}</div>
    </div>
  );
}
