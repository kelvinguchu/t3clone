interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({ children }: Readonly<Props>) {
  return (
    <div className="min-h-screen bg-purple-50 dark:bg-dark-bg">{children}</div>
  );
}

export function generateMetadata() {
  return {
    title: {
      template: "%s | T3 Chat",
      default: "T3 Chat",
    },
    description: "View shared AI conversations on T3 Chat",
  };
}
