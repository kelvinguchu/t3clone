export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-purple-900">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
