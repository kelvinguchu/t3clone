interface Props {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export default async function ShareLayout({ children }: Readonly<Props>) {
  return <>{children}</>;
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
